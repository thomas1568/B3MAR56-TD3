import * as THREE from 'three';
import { OrbitControls } from 'three/addons/webxr/OrbitControls.js';
import { layoutHotspots } from './hotspots.js';

export function createPanorama(container, step, onPoint) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.domElement.className = 'panorama-canvas';
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x153b3b);
  const camera = new THREE.PerspectiveCamera(70, 1, 0.001, 30);
  camera.position.set(0, 0, 0.01);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false; controls.enableZoom = false;
  controls.minDistance = controls.maxDistance = 0.01;
  controls.rotateSpeed = 0.5;
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), new THREE.MeshBasicMaterial({ color: 0x244747, side: THREE.BackSide }));
  scene.add(sphere);
  // This grid is a neutral consultation space, never a fabricated photograph.
  const grid = new THREE.Mesh(new THREE.SphereGeometry(9.95, 24, 12), new THREE.MeshBasicMaterial({ color: 0x46605d, wireframe: true, side: THREE.BackSide, transparent: true, opacity: 0.35 }));
  scene.add(grid);
  const leaders = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  leaders.classList.add('hotspot-leaders'); container.appendChild(leaders);
  const buttons = [], points = [];
  for (const poi of step.points) {
    const yaw = THREE.MathUtils.degToRad(poi.panorama.yaw), pitch = THREE.MathUtils.degToRad(poi.panorama.pitch);
    const object = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), new THREE.MeshBasicMaterial({ color: 0xd8bd83 }));
    object.position.set(Math.sin(yaw) * Math.cos(pitch) * 8.5, Math.sin(pitch) * 8.5, -Math.cos(yaw) * Math.cos(pitch) * 8.5);
    object.userData.poiId = poi.id; scene.add(object); points.push(object);
    const button = document.createElement('button'); button.className = 'world-hotspot'; button.textContent = poi.shortTitle;
    button.type = 'button'; button.dataset.ui = ''; button.addEventListener('click', () => onPoint(poi.id));
    container.appendChild(button);
    const line = document.createElementNS('http://www.w3.org/2000/svg','line'); leaders.appendChild(line);
    buttons.push({ object, button, line });
  }
  let disposed = false, active = true, frameId = null;
  if (step.panorama.src && step.panorama.rights.status === 'autorise') {
    new THREE.TextureLoader().load(step.panorama.src, texture => {
      if (disposed) { texture.dispose(); return; }
      texture.colorSpace = THREE.SRGBColorSpace; sphere.material.map = texture;
      sphere.material.color.set(0xffffff); sphere.material.needsUpdate = true; grid.visible = false;
    }, undefined, () => { container.dispatchEvent(new CustomEvent('panoramaerror')); });
  }
  const resize = () => {
    const { width, height } = container.getBoundingClientRect(); if (!width || !height) return;
    camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
  };
  const observer = new ResizeObserver(resize); observer.observe(container); resize();
  function frame() {
    if (!active || disposed) return;
    controls.update(); camera.updateMatrixWorld(true);
    const rect = container.getBoundingClientRect();
    const projected = buttons.map(({object,button}) => {
      const position = object.position.clone().project(camera);
      const inFront = object.position.clone().applyMatrix4(camera.matrixWorldInverse).z < 0;
      button.hidden = !inFront || position.z > 1 || position.z < -1 || Math.abs(position.x) > 0.95 || Math.abs(position.y) > 0.9;
      return { id:object.userData.poiId, x:(position.x+1)/2*rect.width, y:(1-position.y)/2*rect.height,
        visible:!button.hidden, width:button.offsetWidth, height:button.offsetHeight };
    });
    const positions = layoutHotspots(projected, {width:rect.width, top:12, bottom:rect.height-12});
    for (const {object,button,line} of buttons) {
      const position = positions.get(object.userData.poiId);
      button.hidden = !position; line.style.display = position ? '' : 'none';
      if (position) {
        button.style.left = position.x + 'px';button.style.top = position.y + 'px';
        line.setAttribute('x1',position.x);line.setAttribute('y1',position.y);
        line.setAttribute('x2',position.anchorX);line.setAttribute('y2',position.anchorY);
      }
    }
    renderer.render(scene, camera); frameId = requestAnimationFrame(frame);
  }
  const raycaster = new THREE.Raycaster(); let down = null;
  renderer.domElement.addEventListener('pointerdown', event => { if (event.isPrimary) down = [event.clientX, event.clientY]; });
  renderer.domElement.addEventListener('pointercancel', () => { down = null; });
  renderer.domElement.addEventListener('pointerup', event => {
    const initial = down; down = null;
    if (!initial || Math.hypot(event.clientX - initial[0], event.clientY - initial[1]) > 6) return;
    const rect = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), camera);
    const hit = raycaster.intersectObjects(points, true)[0];
    if (hit) onPoint(hit.object.userData.poiId);
  });
  frame();
  return {
    setActive(value) { active = value; cancelAnimationFrame(frameId); if (active) { resize(); frame(); } },
    dispose() {
      disposed = true; active = false; cancelAnimationFrame(frameId); observer.disconnect(); controls.dispose();
      scene.traverse(object => { object.geometry?.dispose(); if (object.material) { object.material.map?.dispose(); object.material.dispose(); } });
      renderer.dispose(); renderer.domElement.remove(); leaders.remove(); for (const {button} of buttons) button.remove();
    }
  };
}
