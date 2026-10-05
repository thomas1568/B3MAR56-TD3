import * as THREE from 'three';

// The generated geometry is an evocation. Nothing here is a reconstructed facade,
// a historical portrait or a facsimile of an archive.
export function makeLabel(text, width = 0.48, color = '#e2c789') {
  let texture = null;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 768; canvas.height = 160;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#173a39'; ctx.fillRect(0, 0, 768, 160);
      ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.strokeRect(4, 4, 760, 152);
      ctx.fillStyle = '#fff9ed'; ctx.font = 'bold 38px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, 384, 80, 728);
      texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
    }
  }
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, color: texture ? 0xffffff : 0xd9c58e, depthWrite: false }));
  label.scale.set(width, width * 160 / 768, 1);
  label.userData.ownedLabel = true;
  return label;
}

export function createMemoriaScene(step, { onAssetError = () => {} } = {}) {
  let disposed = false;
  const root = new THREE.Group();
  root.name = 'Memoria Corti · IUT · repère manuel';
  root.visible = false;
  const objects = [];
  const byPoint = new Map();
  const wood = new THREE.MeshStandardMaterial({ color: 0x795541, roughness: 0.85 });
  const paper = new THREE.MeshStandardMaterial({ color: 0xeadbb8, roughness: 0.95 });
  const green = new THREE.MeshStandardMaterial({ color: 0x245957, roughness: 0.8 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc4a36d, roughness: 0.5, metalness: 0.25 });

  const block = (parent, x, y, z, w, h, d, material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };
  function item(id, position, poi = null) {
    const object = new THREE.Group();
    object.name = id; object.userData.layoutId = id; object.userData.memoria = true;
    object.userData.poiId = poi?.id || null;
    object.position.fromArray(position); root.add(object); objects.push(object);
    if (poi) {
      if (!byPoint.has(poi.id)) byPoint.set(poi.id, object);
      const button = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), brass);
      // Each element and its clickable label move together in the common frame.
      button.position.set(0, id === 'naissance' || id === 'corte' ? 0.22 : 1.18, 0.05);
      button.userData.poiMarker = true;
      object.add(button);
      const tag = makeLabel(poi.shortTitle, 0.52);
      tag.position.copy(button.position).add(new THREE.Vector3(0, 0.11, 0));
      object.add(tag);
    }
    return object;
  }

  const table = item('table', [0, 0, 0.05]);
  block(table, 0, 0.73, 0, 1.08, 0.07, 0.65, wood);
  for (const x of [-0.44, 0.44]) for (const z of [-0.24, 0.24]) block(table, x, 0.36, z, 0.055, 0.72, 0.055, wood);
  const question = makeLabel('Pourquoi créer une université ?', 0.8);
  question.position.set(0, 0.49, 0.36); table.add(question);

  for (const poi of step.points) {
    const object = item(poi.id, poi.position, poi);
    object.rotation.fromArray([...poi.orientation, 'XYZ']);
    if (poi.id === 'naissance') {
      block(object, 0, 0.02, 0, 0.4, 0.04, 0.27, wood);
      for (const x of [-0.1, 0.1]) {
        const page = block(object, x, 0.055, 0, 0.19, 0.025, 0.25, paper);
        page.rotation.z = x < 0 ? 0.13 : -0.13;
      }
      const date = makeLabel('1765 · Évocation', 0.35); date.position.set(0, 0.1, -0.16); object.add(date);
    } else if (poi.id === 'iut') {
      block(object, 0, 0.15, 0, 0.34, 0.3, 0.22, green);
      block(object, 0, 0.32, 0, 0.38, 0.045, 0.26, brass);
      for (const x of [-0.1, 0, 0.1]) block(object, x, 0.2, 0.115, 0.05, 0.065, 0.01, paper);
      const tag = makeLabel('Campus Grimaldi · 1983', 0.48); tag.position.set(0, 0.58, 0); object.add(tag);
    } else if (poi.id === 'paoli' || poi.id === 'reouverture') {
      block(object, 0, 0.03, 0, 0.3, 0.06, 0.25, wood);
      block(object, 0, 0.38, 0, 0.03, 0.7, 0.04, brass);
      block(object, 0, 0.82, 0, 0.38, 0.5, 0.045, wood);
      block(object, 0, 0.82, 0.03, 0.32, 0.44, 0.02, paper);
      const empty = makeLabel(poi.id === 'paoli' ? 'Portrait à fournir' : 'Archive 1981 à fournir', 0.34);
      empty.position.set(0, 0.82, 0.06); object.add(empty);
      if (poi.image.src && poi.image.rights.status === 'autorise') {
        const picture = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide }));
        picture.position.set(0, 0.82, 0.045); picture.visible = false; object.add(picture);
        new THREE.TextureLoader().load(poi.image.src, texture => {
          if (disposed) { texture.dispose(); return; }
          const aspect = texture.image.width / texture.image.height || 1;
          const height = Math.min(0.44, 0.32 / aspect);
          picture.scale.set(height * aspect, height, 1);
          texture.colorSpace = THREE.SRGBColorSpace; picture.material.map = texture;
          picture.material.needsUpdate = true; picture.visible = true; empty.visible = false;
        }, undefined, onAssetError);
      }
    } else if (poi.id === 'corte') {
      block(object, 0, 0.025, 0, 0.35, 0.04, 0.28, green);
      block(object, -0.1, 0.052, 0, 0.065, 0.012, 0.065, brass);
      block(object, 0.1, 0.052, 0, 0.065, 0.012, 0.065, brass);
      block(object, 0, 0.052, 0, 0.14, 0.008, 0.012, paper);
      const tag = makeLabel('Corte · Schéma de parcours', 0.4); tag.position.set(0, 0.1, -0.2); object.add(tag);
    }
  }
  const documentPoint = step.points.find(poi => poi.id === 'naissance');
  const document = item('document', [0, 0.77, -0.15]);
  document.userData.poiId = documentPoint.id;
  const sheet = block(document, 0, 0.006, 0, 0.14, 0.01, 0.2, paper);
  sheet.rotation.y = -0.25;
  for (const z of [-0.1, 0.1]) {
    const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.15, 12), paper);
    roller.rotation.z = Math.PI / 2; roller.position.set(0, 0.014, z); document.add(roller);
  }
  const defaults = objects.map(object => ({ object, position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone() }));
  return {
    root, objects, byPoint,
    reset() {
      for (const state of defaults) {
        root.add(state.object); state.object.position.copy(state.position);
        state.object.quaternion.copy(state.quaternion); state.object.scale.copy(state.scale); state.object.visible = true;
      }
    },
    dispose() {
      disposed = true;
      // Include removed items: only this factory's resources are disposed.
      const geometries = new Set(), materials = new Set(), textures = new Set();
      for (const object of objects) object.traverse(child => {
        if (child.geometry) geometries.add(child.geometry);
        for (const material of (Array.isArray(child.material) ? child.material : child.material ? [child.material] : [])) {
          materials.add(material); if (material.map) textures.add(material.map);
        }
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
      root.removeFromParent();
    }
  };
}
