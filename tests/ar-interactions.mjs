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
        document: {getElementById: node, querySelectorAll: () => []},
        console: {info() {}, warn() {}, error: (...args) => logs.push(args)},
        $: () => ({click() {}}),
        GLTFLoader: class { load(url, success) { context.modelRequests.push({url, success}); } },
        modelRequests: []
    });
    vm.runInContext(source, context);
    const run = code => vm.runInContext(code, context);
    run(`experienceMode = 'edit'; scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(70, 0.5, 0.01, 20);
        camera.position.set(0, 2, 3); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
        pickingCamera.matrixWorld.copy(camera.matrixWorld);
        pickingCamera.matrixWorldInverse.copy(camera.matrixWorldInverse);
        pickingCamera.projectionMatrix.copy(camera.projectionMatrix);
        pickingCamera.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
        pickingCameraReady = true;
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
            return {getViewerPose: () => ({views: [{transform: {matrix: camera.matrixWorld.elements}, projectionMatrix: camera.projectionMatrix.elements}]}), getHitTestResults: () => [{getPose: () => ({transform: {matrix}})}]};
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
        animate(0,{getViewerPose:()=>null, getHitTestResults(){throw new Error('source inactive');}});
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

test('there are no keyboard or gamepad paths that add or delete objects', () => {
    const {run} = app();
    run(`selectObject(first); activeSession.inputSources = [{targetRayMode:'screen', handedness:'left',
        gamepad:{mapping:'xr-standard', axes:[-1], buttons:Array.from({length:6},()=>({pressed:true}))}}];
        assert.equal(typeof handleXRControllerShortcuts, 'undefined');
        assert.equal(typeof onKeyboardShortcut, 'undefined');
        assert.equal(placed_objects.length,3); assert.equal(selectedObject,first);`);
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

// These failures model an exception without claiming it occurred on a phone.
test('a render exception must not escape and stop the next XR frame', () => {
    const {run, logs} = app();
    run(`primeHitTest(); selectObject(first);
        renderer.render = () => { throw new Error('render failed after selection'); };
        assert.doesNotThrow(() => animate(0, validFrame()));
        assert.ok(lastError.includes('render failed after selection'));
        assert.equal(placed_objects.length,3); assert.ok(first.visible);
        renderer.render = () => {}; animate(16,validFrame());
        assert.equal(reticle.visible,true); assert.equal(placementPoseValid,true);`);
    assert.ok(logs.length > 0);
});

test('a capture exception must release interaction without cancelling placement', () => {
    const {run, node, context} = app();
    context.overlay = node('content');
    context.overlay.setPointerCapture = () => { throw new Error('pointer capture unavailable'); };
    run(`primeHitTest(); updatePlacement(validFrame(),activeSession,{},0);
        const source = hitTestSource, position = first.position.clone();
        assert.doesNotThrow(() => onARPointerDown({type:'pointerdown',isPrimary:true,button:0,pointerId:7,
            clientX:200,clientY:400,target:{closest:()=>null},currentTarget:overlay,preventDefault(){}}));
        assert.equal(drag,null); assert.equal(hitTestSource,source);
        assert.ok(first.position.equals(position)); assert.ok(first.visible);
        updatePlacement(validFrame(),activeSession,{},16); assert.ok(reticle.visible);`);
});

test('nonfinite coordinates in parent space must not poison an object transform', () => {
    const {run} = app();
    run(`beginDrag(rayAt(0),1,p0); const position = first.position.clone();
        scene.scale.setScalar(0); scene.updateMatrixWorld(true);
        updateGesture(rayAt(1),new THREE.Vector2(220,400));
        assert.ok(first.position.equals(position));
        assert.ok(first.position.toArray().every(Number.isFinite));`);
});


test('raycasting uses an XR view snapshot without modifying the renderer camera', () => {
    const {run} = app();
    run(`const eye = camera.clone(); eye.position.set(1,2,3); eye.lookAt(first.position); eye.updateMatrixWorld(true);
        const frame = {getViewerPose: () => ({views: [{transform: {matrix: eye.matrixWorld.elements}, projectionMatrix: eye.projectionMatrix.elements}]})};
        updatePickingCamera(frame, {});
        const mainMatrix = camera.matrixWorld.clone();
        renderer.xr.updateCamera = () => { throw new Error('input must not write the XR camera'); };
        const projected = first.position.clone().project(eye);
        const event = {clientX:(projected.x+1)*200,clientY:(1-projected.y)*400};
        assert.equal(pickPlacedObject(pointerRay(event)), first);
        assert.ok(camera.matrixWorld.equals(mainMatrix));
        eye.position.x = 50; eye.updateMatrixWorld(true);
        assert.equal(pickPlacedObject(pointerRay(event)), first);`);
});

test('tracking loss blocks input until a valid camera pose returns', () => {
    const {run} = app();
    run(`primeHitTest(); const source=hitTestSource;
        updatePickingCamera({getViewerPose:()=>null},{});
        assert.equal(pointerRay({clientX:200,clientY:400}),null);
        assert.equal(hitTestSource,source);
        updatePickingCamera(validFrame(),{}); assert.ok(pickingCameraReady);
        assert.equal(pickPlacedObject(pointerRay({clientX:200,clientY:400})),first);`);
});

test('a raycast exception is diagnosed without hiding objects or losing the hit-test', () => {
    const {run, node, context} = app();
    context.overlay=node('content');
    run(`primeHitTest(); const source=hitTestSource;
        first.children[0].children[0].raycast = () => {throw new Error('mesh raycast failed');};
        onARPointerDown({type:'pointerdown',pointerId:7,button:0,isPrimary:true,clientX:200,clientY:400,
            target:{closest:()=>null},currentTarget:overlay,preventDefault(){}});
        assert.equal(drag,null); assert.equal(hitTestSource,source);
        assert.ok(first.visible); assert.equal(first.parent,scene); assert.equal(placed_objects.length,3);
        assert.ok(lastError.includes('mesh raycast failed'));
        animate(16,validFrame()); assert.ok(reticle.visible);`);
});

test('diagnostic differentiates removal, hiding, invalid transforms and out-of-view objects', () => {
    const {run} = app();
    run(`lastInspectedObject=first; assert.equal(inspectedObjectState(),'present dans le champ');
        first.visible=false; assert.equal(inspectedObjectState(),'masque'); first.visible=true;
        first.position.x=NaN; assert.equal(inspectedObjectState(),'transformation invalide');
        first.position.x=50; first.updateMatrixWorld(true); assert.equal(inspectedObjectState(),'present hors champ');
        removePlacedObject(first); assert.equal(inspectedObjectState(),'retire de la liste');`);
});

test('selection, editing, deselection and deletion keep the placement source alive', () => {
    const {run} = app();
    run(`primeHitTest(); let cancellations=0; hitTestSource.cancel=()=>cancellations++;
        const source=hitTestSource;
        updatePlacement(validFrame(),activeSession,{},0);
        beginDrag(rayAt(0),1,p0); stopDrag(); assert.equal(selectedObject,first);
        setInteractionMode('rotate'); beginDrag(rayAt(0),2,p0);
        updateGesture(rayAt(0.5),new THREE.Vector2(230,400));stopDrag();
        selectObject(null); selectObject(second); deleteSelectedObject();
        assert.equal(hitTestSource,source); assert.equal(cancellations,0);
        animate(32,validFrame()); assert.ok(reticle.visible); assert.equal(placementPoseValid,true);
        assert.ok(inputTrace.length<=8);`);
});

test('visit taps open one content card, swipes and cancellation never edit the scene', () => {
    const {run,context}=app();const opened=[];
    context.testExperience={openPoint:id=>opened.push(id),setPlacementReady(){},updateHotspots(){}};
    run("experience=testExperience; experienceMode='visit'; first.userData.poiId='naissance'; const pos=first.position.clone(), quat=first.quaternion.clone(); beginDrag(rayAt(0),1,p0); assert.equal(selectedObject,null); finishGesture(false);");
    assert.deepEqual(opened,['naissance']);
    run("beginDrag(rayAt(0),2,p0);updateGesture(rayAt(1),new THREE.Vector2(240,400));finishGesture(false);beginDrag(rayAt(0),3,p0);finishGesture(true);beginDrag(rayAt(15),4,p0);finishGesture(false);assert.ok(first.position.equals(pos));assert.ok(first.quaternion.equals(quat));assert.equal(placed_objects.length,3);assert.equal(drag,null);");
    assert.deepEqual(opened,['naissance']);
});

test('visit mode guards add, delete and rotation commands', () => {
    const {run}=app();
    run("selectObject(first); experienceMode='visit'; primeHitTest();updatePlacement(validFrame(),activeSession,{},0);current_object=new THREE.Group();scene.add(current_object);deleteSelectedObject();placeSelectedObject();setInteractionMode('rotate');assert.equal(placed_objects.length,3);assert.equal(interactionMode,'move');assert.ok(first.parent===scene);assert.ok(hitTestSource);assert.equal(reticle.visible,true);");
});

test('new stage UI surfaces never enter scene picking', () => {
    const {run,context}=app();
    let selector;
    context.target={closest:value=>{selector=value;return value.includes('[data-ui]')?{}:null;}};
    run("onARPointerDown({type:'pointerdown',isPrimary:true,button:0,pointerId:1,target,clientX:200,clientY:400});assert.equal(drag,null);assert.equal(placed_objects.length,3);");
    assert.ok(selector.includes('[data-ui]'));
});


test('GLTF cleanup keeps shared resources alive while a pending model uses them', () => {
    const {run}=app();
    run(`let freed=0;sharedGeometry.addEventListener('dispose',()=>freed++);
        sharedMaterial.addEventListener('dispose',()=>freed++);
        const pending=new THREE.Group();pending.add(new THREE.Mesh(sharedGeometry,sharedMaterial));
        current_object=pending;ownedModelRoots.add(first);ownedModelRoots.add(second);ownedModelRoots.add(third);ownedModelRoots.add(pending);
        for(const object of placed_objects)object.removeFromParent();placed_objects=[];
        releaseModelResources();assert.equal(freed,0);assert.equal(ownedModelRoots.size,1);
        current_object=null;releaseModelResources();assert.equal(freed,2);assert.equal(ownedModelRoots.size,0);`);
});
