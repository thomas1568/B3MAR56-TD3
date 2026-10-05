import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../build/three.core.js';

// Run the actual application functions with Three.js and mock only DOM/WebXR.
// No WebGL context or phone tracking is simulated by these regression tests.
const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
    .replace(/^import .*;$/gm, '').replace(/^init\(\);$/m, '');

function app() {
    const elements = new Map();
    const listeners = new Map();
    const node = id => {
        if (!elements.has(id)) elements.set(id, {
            style: {}, hidden: false, disabled: false, textContent: '',
            classList: { add() {}, remove() {} },
            addEventListener(type, fn) { listeners.set(id + ':' + type, fn); },
            setAttribute() {}, focus() {}, appendChild() {},
            getBoundingClientRect: () => ({left: 0, top: 0, width: 400, height: 800}),
            setPointerCapture(id) { this.captured = id; },
            hasPointerCapture(id) { return this.captured === id; },
            releasePointerCapture() { this.captured = null; }
        });
        return elements.get(id);
    };
    const logs = [];
    const context = vm.createContext({ THREE, assert, URLSearchParams,
        window: {location: {search: ''}, innerWidth: 400, innerHeight: 800},
        document: {getElementById: node},
        console: {info() {}, warn() {}, error: (...args) => logs.push(args)},
        $: () => ({click() {}}),
        GLTFLoader: class { load(url, success) { context.modelRequests.push({url, success}); } },
        modelRequests: []
    });
    vm.runInContext(source, context);
    const run = code => vm.runInContext(code, context);
    run(`scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(70, 0.5, 0.01, 20);
        camera.position.set(0, 2, 3); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
        activeSession = {domOverlayState: {type: 'screen'}, inputSources: [], visibilityState: 'visible'};
        renderer = {xr: {isPresenting: true, updateCamera() {}, getCamera: () => ({cameras: [camera]}),
            getSession: () => activeSession, getReferenceSpace: () => ({})}, render() {}};
        reticle = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.2, 32), new THREE.MeshBasicMaterial());
        reticle.visible = false; reticle.matrixAutoUpdate = false; scene.add(reticle);
        placeButton = document.getElementById('placeButton'); clearButton = document.getElementById('clearButton');
        moveButton = document.getElementById('moveButton'); rotateButton = document.getElementById('rotateButton');
        selectionActions = document.getElementById('selectionActions'); arStatus = document.getElementById('arStatus');
        diagnosticText = document.getElementById('diagnosticText');
        const sharedGeometry = new THREE.BoxGeometry(1, 1, 1), sharedMaterial = new THREE.MeshBasicMaterial();
        function addObject(x) {
            const root = new THREE.Group(), inner = new THREE.Group();
            inner.add(new THREE.Mesh(sharedGeometry, sharedMaterial)); root.add(inner);
            root.position.x = x; root.rotation.y = 0.2; root.scale.setScalar(1.2);
            scene.add(root); placed_objects.push(root); return root;
        }
        const first = addObject(0), second = addObject(3), third = addObject(-3);
        function rayAt(x) {
            return new THREE.Ray(new THREE.Vector3(x, 2, 3), new THREE.Vector3(0, -2, -3).normalize());
        }
        const p0 = new THREE.Vector2(200, 400);
        function validFrame(matrix = new THREE.Matrix4().makeTranslation(0, 0, -1).elements) {
            return {getHitTestResults: () => [{getPose: () => ({transform: {matrix}})}]};
        }
        function primeHitTest() { hitTestSourceRequested = true; hitTestSource = {cancel() {}}; }
    `);
    return {context, run, node, logs, listeners};
}

test('submesh taps select exactly one root without changing any transform', () => {
    const {run} = app();
    run(`const initial = first.matrix.clone(); const initialPosition = first.position.clone();
        beginDrag(rayAt(0), 1, p0); assert.equal(selectedObject, first);
        updateGesture(rayAt(0.02), p0.clone().addScalar(1));
        assert.equal(drag.moved, false); stopDrag();
        assert.ok(first.position.equals(initialPosition)); assert.ok(first.visible);
        assert.equal(placed_objects.length, 3);
        beginDrag(rayAt(3), 2, p0); assert.equal(selectedObject, second); stopDrag();
        assert.equal(scene.children.filter(child => child.type === 'BoxHelper').length, 1);`);
});

test('empty tap deselects, empty swipe does not change selection or scene', () => {
    const {run} = app();
    run(`selectObject(first); beginDrag(rayAt(15), 1, p0);
        updateGesture(rayAt(16), new THREE.Vector2(230, 400));
        stopDrag(); assert.equal(selectedObject, first);
        beginDrag(rayAt(15), 2, p0);
        if (!drag.moved && !drag.object) selectObject(null); stopDrag();
        assert.equal(selectedObject, null); assert.equal(placed_objects.length, 3);`);
});

test('movement keeps grab offset, rotation/scale and all other objects', () => {
    const {run} = app();
    run(`surfacePlane = new THREE.Plane(new THREE.Vector3(0,1,0), 0.4);
        const q = first.quaternion.clone(), scale = first.scale.clone(), other = second.position.clone();
        beginDrag(rayAt(0.2), 1, p0); assert.ok(first.position.length() === 0);
        updateGesture(rayAt(1.2), new THREE.Vector2(230, 400));
        assert.ok(Math.abs(first.position.x - 1) < 1e-9); assert.ok(Math.abs(first.position.y) < 1e-9);
        assert.ok(first.quaternion.equals(q)); assert.ok(first.scale.equals(scale));
        assert.ok(second.position.equals(other));
        const position = first.position.clone(); stopDrag();
        camera.position.x += 2; camera.updateMatrixWorld(true);
        assert.ok(first.position.equals(position));`);
});

test('fallback plane and failed intersections retain the last valid position', () => {
    const {run} = app();
    run(`surfacePlane = null; beginDrag(rayAt(0), 1, p0);
        assert.ok(Math.abs(drag.plane.distanceToPoint(first.position)) < 1e-9);
        updateGesture(rayAt(1), new THREE.Vector2(220, 400));
        const last = first.position.clone();
        updateGesture(new THREE.Ray(new THREE.Vector3(0,2,3), new THREE.Vector3(1,0,0)), new THREE.Vector2(250,400));
        assert.ok(first.position.equals(last));
        updateGesture(new THREE.Ray(new THREE.Vector3(NaN,2,3), rayAt(0).direction), new THREE.Vector2(260,400));
        assert.ok(first.position.equals(last)); stopDrag();`);
});

test('rotation mode changes only orientation around vertical axis', () => {
    const {run} = app();
    run(`selectObject(first); setInteractionMode('rotate');
        const pos = first.position.clone(), scale = first.scale.clone(), q = first.quaternion.clone();
        beginDrag(rayAt(0), 1, p0); updateGesture(rayAt(0.5), new THREE.Vector2(240,400));
        assert.ok(!first.quaternion.equals(q)); assert.ok(first.position.equals(pos)); assert.ok(first.scale.equals(scale));
        const expected = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),0.4).multiply(q);
        assert.ok(first.quaternion.angleTo(expected) < 1e-7); stopDrag();
        setInteractionMode('move'); assert.equal(interactionMode, 'move');`);
});

test('individual deletion preserves other objects and shared GLTF resources', () => {
    const {run} = app();
    run(`let disposals = 0; sharedGeometry.addEventListener('dispose', () => disposals++);
        sharedMaterial.addEventListener('dispose', () => disposals++);
        selectObject(second); const before = first.position.clone(); deleteSelectedObject();
        assert.equal(placed_objects.length,2); assert.ok(placed_objects.includes(first)); assert.ok(placed_objects.includes(third));
        assert.equal(second.parent,null); assert.equal(selectedObject,null); assert.equal(selectionHelper,null);
        assert.ok(first.position.equals(before)); assert.equal(disposals,0);`);
});

test('placement needs a current valid pose; repeated add works after deletion', () => {
    const {run, context} = app();
    run(`primeHitTest(); updatePlacement(validFrame(),activeSession,{},0);
        assert.equal(reticle.visible,true); assert.equal(placementPoseValid,true);
        selectObject(second); deleteSelectedObject();
        current_object = new THREE.Group(); scene.add(current_object); modelLoading = false;
        placeSelectedObject(); assert.equal(placed_objects.length,3); assert.equal(current_object,null);`);
    assert.equal(context.modelRequests.length, 1);
    context.modelRequests[0].success({scene: new THREE.Group()});
    run(`placeSelectedObject(); assert.equal(placed_objects.length,4); assert.equal(current_object,null);
        updatePlacement({getHitTestResults: () => []},activeSession,{},100);
        assert.equal(reticle.visible,false); assert.equal(placementPoseValid,false);
        current_object = new THREE.Group(); modelLoading = false; placeSelectedObject(); assert.equal(placed_objects.length,4);`);
});

test('no pose or invalid pose hides the circle and disables Add', () => {
    const {run} = app();
    run(`primeHitTest(); updatePlacement(validFrame(),activeSession,{},0); assert.ok(reticle.visible);
        updatePlacement({getHitTestResults: () => [{getPose: () => null}]},activeSession,{},1);
        updateARStatus(); assert.equal(reticle.visible,false); assert.ok(placeButton.disabled);
        const invalid = new THREE.Matrix4().elements; invalid[12] = NaN;
        updatePlacement(validFrame(invalid),activeSession,{},2); assert.equal(placementPoseValid,false);`);
});

test('hit-test errors are diagnosed and rendering continues', () => {
    const {run, logs} = app();
    run(`primeHitTest(); let renders=0; renderer.render=()=>renders++;
        animate(0,{getHitTestResults(){throw new Error('source inactive');}});
        assert.equal(renders,1); assert.equal(placementPoseValid,false); assert.equal(hitTestState,'erreur');
        assert.ok(lastError.includes('source inactive')); assert.equal(hitTestSource,null);`);
    assert.equal(logs.length, 1);
});

test('late hit-test source from an ended session is cancelled', async () => {
    const {run, context} = app();
    let resolve;
    let cancelled = 0;
    context.requestSource = () => new Promise(r => { resolve = r; });
    run(`activeSession.requestReferenceSpace = () => Promise.resolve({});
        activeSession.requestHitTestSource = requestSource;
        updatePlacement({getHitTestResults:()=>[]},activeSession,{},0);`);
    await new Promise(setImmediate);
    run('activeSession = null;');
    resolve({cancel() { cancelled++; }});
    await new Promise(setImmediate);
    assert.equal(cancelled, 1);
    run('assert.equal(hitTestSource,null);');
});

test('phone screen gamepads never invoke add/delete controller shortcuts', () => {
    const {run} = app();
    run(`selectObject(first); activeSession.inputSources = [{targetRayMode:'screen', handedness:'left',
        gamepad:{mapping:'xr-standard', axes:[-1], buttons:Array.from({length:6},()=>({pressed:true}))}}];
        handleXRControllerShortcuts(); assert.equal(placed_objects.length,3); assert.equal(selectedObject,first);`);
});

test('DOM buttons and native XR duplicates never enter scene interaction', () => {
    const {run, node, context} = app();
    context.overlay = node('content');
    run(`onARPointerDown({isPrimary:true,button:0,pointerId:1,target:{closest:()=>({})},currentTarget:overlay});
        assert.equal(drag,null);
        onXRSelectStart({inputSource:{targetRayMode:'screen'},frame:{getPose(){throw new Error('duplicate XR event');}}});
        assert.equal(drag,null); assert.equal(placed_objects.length,3);`);
});

test('pointer tap, final release and cancellation never reproject or delete an object', () => {
    const {run, node, context} = app();
    context.overlay = node('content');
    run(`function pointerEvent(type,x=200,y=400) {
        return {type,clientX:x,clientY:y,isPrimary:true,button:0,pointerId:7,target:{closest:()=>null},
            currentTarget:overlay,preventDefault(){}};
        }
        onARPointerDown(pointerEvent('pointerdown')); const original = first.position.clone();
        onARPointerMove(pointerEvent('pointermove',201)); onARPointerEnd(pointerEvent('pointerup',201));
        assert.ok(first.position.equals(original)); assert.equal(selectedObject,first); assert.equal(placed_objects.length,3);
        assert.equal(drag,null); assert.equal(overlay.captured,null);
        onARPointerDown(pointerEvent('pointerdown')); onARPointerMove(pointerEvent('pointermove',225));
        const last = first.position.clone(); onARPointerEnd(pointerEvent('pointercancel'));
        assert.ok(first.position.equals(last)); assert.equal(drag,null); assert.equal(overlay.captured,null);`);
});

test('another finger and loss of session visibility cannot leave a stuck gesture', () => {
    const {run} = app();
    run(`beginDrag(rayAt(0),1,p0); beginDrag(rayAt(3),2,p0); assert.equal(drag.owner,1);
        activeSession.visibilityState='hidden'; onXRVisibilityChange();
        assert.equal(drag,null); assert.equal(placementPoseValid,false);`);
});

test('the newest request wins even when the same GLB is loaded twice', () => {
    const {run, context} = app();
    run("loadModel('1'); loadModel('1');");
    const obsolete = new THREE.Group(), latest = new THREE.Group();
    context.modelRequests[0].success({scene: obsolete});
    context.modelRequests[1].success({scene: latest});
    context.latest = latest;
    run('assert.equal(current_object,latest); assert.equal(modelLoading,false); assert.equal(placed_objects.length,3);');
});
