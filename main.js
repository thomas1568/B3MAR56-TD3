import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { GLTFLoader } from 'three/addons/webxr/GLTFLoader.js';
import { OrbitControls } from 'three/addons/webxr/OrbitControls.js';
import { HDRLoader } from 'three/addons/webxr/HDRLoader.js';

let scene;
let camera;
let renderer;
let reticle;
let controls;
let placeButton;
let clearButton;
let actionButtons;

let hitTestSource = null;
let hitTestSourceRequested = false;
let activeSession = null;
let hitTestRetryAt = 0;
let placementPoseValid = false;
const placementMatrix = new THREE.Matrix4();
let surfacePlane = null;
let hitTestState = 'inactif';
let lastAction = 'aucune';
let lastError = '';
let selectedObject = null;
let selectionHelper = null;
let interactionMode = 'move';
let drag = null;
let moveButton;
let rotateButton;
let selectionActions;
let arStatus;
let diagnosticText;
const selectionRaycaster = new THREE.Raycaster();
const rayMatrix = new THREE.Matrix4();
const dragPoint = new THREE.Vector3();
const DRAG_THRESHOLD = 6; // CSS pixels: a tap must never transform an object.
let xrAddShortcutHeld = false;
let xrClearShortcutHeld = false;

let current_object = null;
let loading_model = 0;
let modelLoading = false;

// Modèle actuellement sélectionné dans le menu
let selected_model = '1';

// Tous les modèles déjà placés
let placed_objects = [];

init();

function init() {

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
        70,
        window.innerWidth / window.innerHeight,
        0.01,
        20
    );

    const light = new THREE.HemisphereLight(
        0xffffff,
        0xbbbbff,
        3
    );

    light.position.set(
        0.5,
        1,
        0.25
    );

    scene.add(light);

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });

    renderer.setPixelRatio(
        window.devicePixelRatio
    );

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

    // Reçoit le focus clavier pendant la session XR sur PC.
    renderer.domElement.tabIndex = 0;

    renderer.xr.enabled = true;

    document.body.appendChild(
        renderer.domElement
    );

    // DOM overlay handles touch coordinates; native XR input is the fallback.
    const overlay = document.getElementById('content');
    overlay.addEventListener('beforexrselect', event => event.preventDefault());
    overlay.addEventListener('pointerdown', onARPointerDown);
    overlay.addEventListener('pointermove', onARPointerMove);
    overlay.addEventListener('pointerup', onARPointerEnd);
    overlay.addEventListener('pointercancel', onARPointerEnd);
    overlay.addEventListener('lostpointercapture', onARPointerEnd);

    controls = new OrbitControls(
        camera,
        renderer.domElement
    );

    controls.target.set(
        0,
        0,
        0
    );

    controls.update();

    placeButton = document.getElementById('placeButton');
    clearButton = document.getElementById('clearButton');
    actionButtons = document.getElementById('actionButtons');

    placeButton.addEventListener(
        'click',
        placeSelectedObject
    );

    clearButton.addEventListener('click', deleteSelectedObject);
    moveButton = document.getElementById('moveButton');
    rotateButton = document.getElementById('rotateButton');
    selectionActions = document.getElementById('selectionActions');
    arStatus = document.getElementById('arStatus');
    diagnosticText = document.getElementById('diagnosticText');
    document.getElementById('stopARButton').addEventListener('click', () => {
        activeSession?.end().catch(error => reportARError('Fin de session', error));
    });
    moveButton.addEventListener('click', () => setInteractionMode('move'));
    rotateButton.addEventListener('click', () => setInteractionMode('rotate'));
    document.getElementById('clearAllButton').addEventListener('click', clearPlacedObjects);
    // Commands have one activation route (click), never scene pointer/XR routes.
    overlay.addEventListener('click', event => {
        if (event.target.closest('button, a, #menuButton')) event.stopPropagation();
    });
    updateSelectionUI();

    // Le toucher sur le bouton ne doit jamais atteindre la simulation.
    placeButton.addEventListener(
        'pointerdown',
        function (event) {
            event.stopPropagation();
        }
    );

    clearButton.addEventListener(
        'pointerdown',
        function (event) {
            event.stopPropagation();
        }
    );

    const options = {

        requiredFeatures: [
            'hit-test'
        ],

        // Certaines configurations de l'Immersive Web Emulator ne
        // prennent pas en charge cette fonctionnalité. Elle doit donc
        // rester optionnelle pour pouvoir entrer dans la simulation.
        optionalFeatures: [
            'dom-overlay'
        ],

        domOverlay: {
            root: document.getElementById(
                'content'
            )
        }
    };

    document.body.appendChild(
        ARButton.createButton(
            renderer,
            options
        )
    );

    const geometry =
        new THREE.RingGeometry(
            0.15,
            0.20,
            32
        );

    geometry.rotateX(
        -Math.PI / 2
    );

    const material =
        new THREE.MeshBasicMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false
        });

    reticle = new THREE.Mesh(
        geometry,
        material
    );

    reticle.renderOrder = 10;
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;

    scene.add(reticle);


    // -------------------------------------------------
    // DEBUT DE SESSION AR
    // -------------------------------------------------

    renderer.xr.addEventListener(
        'sessionstart',
        function () {

            activeSession = renderer.xr.getSession();
            hitTestSource = null;
            hitTestSourceRequested = false;
            hitTestRetryAt = 0;
            lastError = '';
            hitTestState = 'demande en cours';
            invalidatePlacement();
            xrAddShortcutHeld = false;
            xrClearShortcutHeld = false;
            activeSession.addEventListener('selectstart', onXRSelectStart);
            activeSession.addEventListener('selectend', onXRSelectEnd);
            activeSession.addEventListener('inputsourceschange', onXRInputsChanged);
            activeSession.addEventListener('visibilitychange', onXRVisibilityChange);
            overlay.style.pointerEvents = 'auto';
            overlay.style.touchAction = 'none';
            overlay.classList.add('ar-active');
            if (!activeSession.domOverlayState) {
                console.warn('DOM Overlay indisponible : commandes tactiles AR non affichees.');
            }
            resetSelection();
            showPlaceButton();
            updateARStatus();

            // Immersive Web Emulator donne parfois le focus au canvas.
            // On le conserve pour que les raccourcis A et E soient reçus.
            renderer.domElement.focus({ preventScroll: true });

            // Le modèle en attente de placement est caché
            if (current_object) {
                current_object.visible = false;
            }

            if (controls) {
                controls.enabled = false;
            }
        }
    );


    // -------------------------------------------------
    // FIN DE SESSION AR
    // -------------------------------------------------

    renderer.xr.addEventListener(
        'sessionend',
        function () {

            if (activeSession) {
                activeSession.removeEventListener('selectstart', onXRSelectStart);
                activeSession.removeEventListener('selectend', onXRSelectEnd);
                activeSession.removeEventListener('inputsourceschange', onXRInputsChanged);
                activeSession.removeEventListener('visibilitychange', onXRVisibilityChange);
            }
            activeSession = null;
            cancelPlacementSource();
            hitTestSourceRequested = false;
            hitTestState = 'inactif';
            invalidatePlacement();
            xrAddShortcutHeld = false;
            xrClearShortcutHeld = false;
            resetSelection();
            overlay.style.pointerEvents = '';
            overlay.style.touchAction = '';
            overlay.classList.remove('ar-active');
            actionButtons.style.display = 'none';

            if (controls) {
                controls.enabled = true;
            }

            // Le modèle non placé revient à sa position initiale
            if (current_object) {

                current_object.position.set(
                    0,
                    0,
                    -2
                );

                current_object.visible = true;
            }
        }
    );


    window.addEventListener(
        'resize',
        onWindowResize
    );

    // Capture : le raccourci est lu avant les contrôles de l'émulateur XR.
    document.addEventListener(
        'keydown',
        onKeyboardShortcut,
        true
    );


    renderer.setAnimationLoop(
        animate
    );


    // Modèle chargé au démarrage
    loadModel('1');
}


// -------------------------------------------------
// CHARGEMENT D'UN MODELE
// -------------------------------------------------

function loadModel(model) {

    const requestId = ++loading_model;
    modelLoading = true;
    updateARStatus();

    selected_model = model;

    const loader = new GLTFLoader();

    loader.load(

        'model/' + model + '.glb',

        function (gltf) {

            // Si un autre modèle a été sélectionné
            // pendant le chargement, on ignore celui-ci
            if (loading_model !== requestId) {
                return;
            }


            // Supprime uniquement le modèle qui était
            // en attente de placement.
            //
            // Les modèles déjà placés ne sont PAS supprimés.
            if (current_object) {

                scene.remove(
                    current_object
                );

                current_object = null;
            }


            modelLoading = false;

            // Nouveau modèle en attente
            current_object =
                gltf.scene;

            scene.add(
                current_object
            );


            // Centre le modèle
            const box =
                new THREE.Box3()
                    .setFromObject(
                        current_object
                    );

            const center =
                box.getCenter(
                    new THREE.Vector3()
                );

            current_object.position.sub(
                center
            );


            // Position de départ
            current_object.position.set(
                0,
                0,
                -2
            );


            current_object.visible = true;


            // Pendant l'AR, il sera affiché
            // uniquement après détection d'une surface
            if (renderer.xr.isPresenting) {

                current_object.visible = false;
            }
            updateARStatus();
        },

        undefined,

        function (error) {

            console.error(
                'Erreur lors du chargement de ' +
                model +
                '.glb',
                error
            );
            if (loading_model === requestId) reportARError('Chargement du modele', error);
        }
    );
}


// -------------------------------------------------
// MENU : CHANGEMENT DE MODELE
// -------------------------------------------------

$('.ar-object').click(function (event) {

    event.preventDefault();

    const model =
        $(this).attr('id');


    // On mémorise le modèle sélectionné
    selected_model = model;


    // On prépare un nouveau modèle
    loadModel(model);


    // Ferme le menu
    closeNav();
});


// -------------------------------------------------
// PLACEMENT D'UN MODELE
// -------------------------------------------------

function placeSelectedObject() {

    if (!renderer.xr.isPresenting || drag) return;
    if (!placementPoseValid || !reticle.visible) {
        recordAction('ajout refuse : aucune pose valide');
        return;
    }

    // Aucun modèle à placer
    if (!current_object || modelLoading) {
        return;
    }


    // Aucune surface détectée
    if (!reticle.visible) {
        return;
    }


    // Place le modèle à l'endroit du reticle
    current_object.position.setFromMatrixPosition(
        placementMatrix
    );

    current_object.visible = true;


    // On ajoute le modèle à la liste
    // des modèles définitivement placés
    placed_objects.push(
        current_object
    );


    // Il n'est plus le modèle en attente
    current_object = null;
    recordAction('ajout');
    updateARStatus();


    // -------------------------------------------------
    // IMPORTANT :
    // On recharge automatiquement une nouvelle copie
    // du MEME modèle.
    //
    // Ainsi, si item 1 est sélectionné :
    //
    // clic -> item 1
    // clic -> item 1
    // clic -> item 1
    // clic -> item 1
    // ...
    //
    // sans avoir besoin de retourner dans le menu.
    // -------------------------------------------------

    loadModel(
        selected_model
    );
}


// -------------------------------------------------
// ANIMATION
// -------------------------------------------------

function animate(
    timestamp,
    frame
) {

    // Pas de session AR
    if (!frame) {

        renderer.render(
            scene,
            camera
        );

        return;
    }

    const session = renderer.xr.getSession();
    const referenceSpace = renderer.xr.getReferenceSpace();
    if (session !== activeSession || !referenceSpace) {
        invalidatePlacement();
        renderer.render(scene, camera);
        return;
    }

    // Placement and rendering remain independent from editing interactions.
    updatePlacement(frame, session, referenceSpace, timestamp);
    try {
        updateARDrag(frame);
        handleXRControllerShortcuts();
        if (selectionHelper && selectedObject) selectionHelper.update();
    } catch (error) {
        stopDrag();
        reportARError('Interaction AR', error);
    }
    updateARStatus();
    renderer.render(scene, camera);
}

function cancelPlacementSource() {
    if (hitTestSource) {
        try { hitTestSource.cancel(); }
        catch (error) { console.warn('Annulation du hit-test', error); }
    }
    hitTestSource = null;
}

function invalidatePlacement() {
    placementPoseValid = false;
    surfacePlane = null;
    reticle.visible = false;
}

function updatePlacement(frame, session, referenceSpace, timestamp) {
    // A result with no pose must also invalidate the previous frame's pose.
    invalidatePlacement();
    if (!hitTestSourceRequested && timestamp >= hitTestRetryAt) {
        hitTestSourceRequested = true;
        hitTestState = 'demande en cours';
        Promise.resolve().then(() => session.requestReferenceSpace('viewer')).then(viewerSpace => {
            if (session !== activeSession) return null;
            return session.requestHitTestSource({ space: viewerSpace });
        }).then(source => {
            if (!source) return;
            if (session !== activeSession) { source.cancel(); return; }
            hitTestSource = source;
            hitTestState = 'actif';
        }).catch(error => {
            if (session !== activeSession) return;
            hitTestSourceRequested = false;
            hitTestRetryAt = timestamp + 2000;
            hitTestState = 'erreur';
            reportARError('Initialisation du hit-test', error);
        });
    }
    if (!hitTestSource) return;
    try {
        const results = frame.getHitTestResults(hitTestSource);
        const pose = results[0]?.getPose(referenceSpace);
        if (!pose || pose.transform.matrix.length !== 16 || !Array.from(pose.transform.matrix).every(Number.isFinite)) {
            hitTestState = results.length ? 'pose indisponible' : 'aucune surface';
            return;
        }
        placementMatrix.fromArray(pose.transform.matrix);
        reticle.matrix.copy(placementMatrix);
        reticle.matrixWorldNeedsUpdate = true;
        reticle.visible = true;
        placementPoseValid = true;
        hitTestState = 'surface et pose valides';
        // The detected surface normal is the local Y axis of the hit-test pose.
        const normal = new THREE.Vector3(0, 1, 0).transformDirection(placementMatrix);
        surfacePlane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal,
            new THREE.Vector3().setFromMatrixPosition(placementMatrix));
    } catch (error) {
        cancelPlacementSource();
        hitTestSourceRequested = false;
        hitTestRetryAt = timestamp + 2000;
        hitTestState = 'erreur';
        reportARError('Lecture du hit-test', error);
    }
}

function reportARError(context, error) {
    lastError = context + ' : ' + (error.message || String(error));
    console.error(context, error);
    updateARStatus();
}

function recordAction(action) {
    lastAction = action;
    if (new URLSearchParams(window.location.search).has('arDebug')) {
        console.info('[AR]', action, 'objets:', placed_objects.length);
    }
    updateARStatus();
}

function updateARStatus() {
    if (!placeButton || !arStatus) return;
    placeButton.disabled = !renderer.xr.isPresenting || !placementPoseValid || !current_object || modelLoading || !!drag;
    const message = !placementPoseValid
        ? 'Deplacez doucement le telephone pour scanner une surface.'
        : (!current_object || modelLoading) ? 'Chargement du modele...'
        : selectedObject ? (interactionMode === 'rotate'
            ? 'Rotation : glissez horizontalement sur l’objet.'
            : 'Deplacement : glissez sur l’objet.')
        : 'Surface detectee. Appuyez sur Ajouter.';
    const status = lastError ? message + ' Erreur AR : ouvrez le diagnostic.' : message;
    if (arStatus.textContent !== status) arStatus.textContent = status;
    const diagnostic = 'Hit-test : ' + hitTestState + '\nPose : ' + placementPoseValid +
        '\nDOM Overlay : ' + !!activeSession?.domOverlayState +
        '\nObjets : ' + placed_objects.length + '\nSelection : ' +
        (selectedObject?.uuid || 'aucune') + '\nMode : ' + interactionMode +
        '\nAction : ' + lastAction + '\nErreur : ' + (lastError || 'aucune');
    if (diagnosticText && diagnosticText.textContent !== diagnostic) diagnosticText.textContent = diagnostic;
}


// -------------------------------------------------
// RESIZE
// -------------------------------------------------

function onWindowResize() {

    camera.aspect =
        window.innerWidth /
        window.innerHeight;

    camera.updateProjectionMatrix();


    if (!renderer.xr.isPresenting) {

        renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );
    }
}


// -------------------------------------------------
// SUPPRESSION DES MODELES POSES
// -------------------------------------------------

function removePlacedObject(object) {
    // No XRAnchor is created in this project. Roots stay in the local XR space.
    // Leave GLTF materials/geometries/textures intact: they can be shared.
    object.removeFromParent();
    placed_objects = placed_objects.filter(candidate => candidate !== object);
}

function deleteSelectedObject() {
    if (!selectedObject || drag) return;
    const object = selectedObject;
    resetSelection();
    removePlacedObject(object);
    recordAction('suppression individuelle');
}

function clearPlacedObjects() {
    if (drag) return;
    resetSelection();
    [...placed_objects].forEach(removePlacedObject);
    recordAction('suppression de tous les objets');
}

function stopDrag() {
    const gesture = drag;
    drag = null;
    if (gesture?.captureTarget?.hasPointerCapture(gesture.owner)) {
        gesture.captureTarget.releasePointerCapture(gesture.owner);
    }
    updateARStatus();
}

function resetSelection() {
    stopDrag();
    selectedObject = null;
    interactionMode = 'move';
    if (selectionHelper) {
        scene.remove(selectionHelper);
        selectionHelper.dispose(); // Only the helper owns these resources.
        selectionHelper = null;
    }
    updateSelectionUI();
}

function selectObject(object) {
    if (selectedObject === object) return;
    resetSelection();
    selectedObject = object;
    if (object) {
        selectionHelper = new THREE.BoxHelper(object, 0x80d8ff);
        selectionHelper.material.transparent = true;
        selectionHelper.material.opacity = 0.65;
        selectionHelper.material.depthWrite = false;
        scene.add(selectionHelper);
    }
    updateSelectionUI();
    recordAction(object ? 'selection' : 'deselection');
}

function updateSelectionUI() {
    if (!selectionActions) return;
    selectionActions.hidden = !selectedObject;
    moveButton.setAttribute('aria-pressed', String(interactionMode === 'move'));
    rotateButton.setAttribute('aria-pressed', String(interactionMode === 'rotate'));
    clearButton.disabled = !selectedObject;
    updateARStatus();
}

function setInteractionMode(mode) {
    if (!selectedObject || drag) return;
    interactionMode = mode;
    updateSelectionUI();
    recordAction(mode === 'rotate' ? 'mode rotation' : 'mode deplacement');
}

function pickPlacedObject(ray) {
    scene.updateMatrixWorld(true);
    selectionRaycaster.ray.copy(ray);
    for (const hit of selectionRaycaster.intersectObjects(placed_objects, true)) {
        let object = hit.object;
        let visible = true;
        let root = null;
        while (object) {
            visible = visible && object.visible;
            if (placed_objects.includes(object)) root = object;
            object = object.parent;
        }
        if (visible && root) return root;
    }
    return null;
}

function beginDrag(ray, owner, screenPoint = null) {
    if (drag) return;
    const object = pickPlacedObject(ray);
    if (object) selectObject(object);
    const origin = object?.getWorldPosition(new THREE.Vector3());
    let plane = null;
    let offset = null;
    if (origin) {
        // Keep the detected AR surface fixed for this gesture; phone motion must
        // not move the plane. It is a local planar approximation of that surface.
        if (surfacePlane && Math.abs(surfacePlane.normal.dot(ray.direction)) > 0.05) {
            plane = surfacePlane.clone();
        } else {
            const normal = Math.abs(ray.direction.y) > 0.15
                ? new THREE.Vector3(0, 1, 0) : ray.direction.clone().negate();
            plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, origin);
        }
        const point = ray.intersectPlane(plane, new THREE.Vector3());
        if (point) offset = origin.clone().sub(point);
    }
    drag = { owner, object, mode: interactionMode, ray: ray.clone(),
        startRay: ray.clone(), screenPoint, plane, offset, moved: false,
        quaternion: object?.quaternion.clone(), captureTarget: null };
    updateARStatus();
}

function updateGesture(ray, screenPoint = null) {
    if (!drag) return;
    if (!drag.moved) {
        const distance = screenPoint && drag.screenPoint
            ? screenPoint.distanceTo(drag.screenPoint)
            : Math.acos(THREE.MathUtils.clamp(ray.direction.dot(drag.startRay.direction), -1, 1)) * 500;
        if (distance < DRAG_THRESHOLD) return;
        drag.moved = true;
        recordAction(drag.mode === 'rotate' ? 'rotation' : 'deplacement');
    }
    drag.ray.copy(ray);
    if (!drag.object || drag.object !== selectedObject) return;
    if (drag.mode === 'rotate') {
        const dx = screenPoint && drag.screenPoint
            ? screenPoint.x - drag.screenPoint.x
            : (ray.direction.x - drag.startRay.direction.x) * 500;
        if (!Number.isFinite(dx)) return;
        const parentRotation = drag.object.parent.getWorldQuaternion(new THREE.Quaternion());
        const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(parentRotation.invert());
        drag.object.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(axis, dx * 0.01)
            .multiply(drag.quaternion));
    } else if (drag.plane && drag.offset) {
        if (Math.abs(drag.plane.normal.dot(ray.direction)) < 0.01) return;
        const point = ray.intersectPlane(drag.plane, dragPoint);
        if (!point || ![point.x, point.y, point.z].every(Number.isFinite)) return;
        const position = point.clone().add(drag.offset);
        drag.object.position.copy(drag.object.parent.worldToLocal(position));
    }
    drag.object.updateMatrixWorld(true);
    if (selectionHelper) selectionHelper.update();
}

function pointerRay(event) {
    const rect = document.getElementById('content').getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    // WebXRManager updates these matrices before the app animation callback.
    renderer.xr.updateCamera(camera);
    const xrCamera = renderer.xr.getCamera();
    const viewCamera = xrCamera.cameras[0];
    if (!viewCamera) return null; // Tracking not ready: do not use a preview ray.
    selectionRaycaster.setFromCamera(new THREE.Vector2(
        (event.clientX - rect.left) / rect.width * 2 - 1,
        -(event.clientY - rect.top) / rect.height * 2 + 1
    ), viewCamera);
    return selectionRaycaster.ray.clone();
}

function onARPointerDown(event) {
    if (!renderer.xr.isPresenting || !activeSession?.domOverlayState || !event.isPrimary || event.button !== 0 || drag ||
        event.target.closest('button, a, #menuButton, #mySidenav, details')) return;
    const ray = pointerRay(event);
    if (!ray) return;
    event.preventDefault();
    beginDrag(ray, event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
    drag.captureTarget = event.currentTarget;
    event.currentTarget.setPointerCapture(event.pointerId);
}

function onARPointerMove(event) {
    if (!drag || drag.owner !== event.pointerId) return;
    event.preventDefault();
    const ray = pointerRay(event);
    if (ray) updateGesture(ray, new THREE.Vector2(event.clientX, event.clientY));
}

function onARPointerEnd(event) {
    if (!drag || drag.owner !== event.pointerId) return;
    if (event.type === 'pointerup') {
        const ray = pointerRay(event);
        if (ray) updateGesture(ray, new THREE.Vector2(event.clientX, event.clientY));
        if (!drag.moved && !drag.object) selectObject(null);
    }
    // No change of projection on release. Cancellation retains the last valid pose.
    stopDrag();
}

function inputRay(frame, inputSource) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    if (!referenceSpace) return null;
    const pose = frame.getPose(inputSource.targetRaySpace, referenceSpace);
    if (!pose) return null;
    rayMatrix.fromArray(pose.transform.matrix);
    return new THREE.Ray(new THREE.Vector3().setFromMatrixPosition(rayMatrix),
        new THREE.Vector3(0, 0, -1).transformDirection(rayMatrix));
}

function rayScreenPoint(ray) {
    renderer.xr.updateCamera(camera);
    const viewCamera = renderer.xr.getCamera().cameras[0];
    if (!viewCamera) return null;
    const point = ray.origin.clone().add(ray.direction).project(viewCamera);
    return new THREE.Vector2((point.x + 1) * window.innerWidth / 2,
        (1 - point.y) * window.innerHeight / 2);
}

function onXRSelectStart(event) {
    // With DOM Overlay, pointer events are the sole scene interaction route.
    if (activeSession?.domOverlayState || event.inputSource.targetRayMode !== 'screen') return;
    const ray = inputRay(event.frame, event.inputSource);
    if (ray) beginDrag(ray, event.inputSource, rayScreenPoint(ray));
}

function onXRSelectEnd(event) {
    if (!drag || drag.owner !== event.inputSource) return;
    if (!drag.moved && !drag.object) selectObject(null);
    stopDrag();
}

function onXRInputsChanged(event) {
    if (drag && event.removed.includes(drag.owner)) stopDrag();
}

function onXRVisibilityChange() {
    if (activeSession?.visibilityState !== 'visible') {
        stopDrag();
        invalidatePlacement();
        updateARStatus();
    }
}

function updateARDrag(frame) {
    if (!drag || typeof drag.owner === 'number') return;
    const ray = inputRay(frame, drag.owner);
    if (ray) updateGesture(ray, rayScreenPoint(ray));
}


function onKeyboardShortcut(event) {

    const target = event.target;

    if (
        event.defaultPrevented ||
        event.repeat ||
        (
            target instanceof HTMLElement &&
            target.matches('input, textarea, select, [contenteditable="true"]')
        )
    ) {
        return;
    }

    if (event.key.toLowerCase() === 'a') {

        event.preventDefault();
        placeSelectedObject();
    }

    if (event.key.toLowerCase() === 'e') {

        event.preventDefault();
        if (event.shiftKey) clearPlacedObjects();
        else deleteSelectedObject();
    }
}


// -------------------------------------------------
// RACCOURCIS VIA MANETTES XR / IMMERSIVE WEB EMULATOR
// - A en Play mode : stick gauche vers la gauche => ajout
// - Bouton A / X : ajout
// - Bouton B / Y : suppression de la selection
// -------------------------------------------------

function handleXRControllerShortcuts() {

    const session = renderer.xr.getSession();

    if (!session) {
        return;
    }

    let addPressed = false;
    let clearPressed = false;

    session.inputSources.forEach(
        function (inputSource) {

            const gamepad = inputSource.gamepad;

            // A phone touchscreen may expose a gamepad: never read it as Meta Touch.
            if (inputSource.targetRayMode !== 'tracked-pointer' || !gamepad || gamepad.mapping !== 'xr-standard') {
                return;
            }

            // Dans le Play mode, A pilote le stick gauche vers la gauche.
            if (
                inputSource.handedness === 'left' &&
                gamepad.axes[0] <= -0.9
            ) {
                addPressed = true;
            }

            // Mapping standard Meta Touch : boutons 4 = A/X, 5 = B/Y.
            if (gamepad.buttons[4] && gamepad.buttons[4].pressed) {
                addPressed = true;
            }

            if (gamepad.buttons[5] && gamepad.buttons[5].pressed) {
                clearPressed = true;
            }
        }
    );

    if (addPressed && !xrAddShortcutHeld) {
        placeSelectedObject();
    }

    if (clearPressed && !xrClearShortcutHeld) {
        deleteSelectedObject();
    }

    xrAddShortcutHeld = addPressed;
    xrClearShortcutHeld = clearPressed;
}


// -------------------------------------------------
// BOUTON DE PLACEMENT MOBILE
// -------------------------------------------------

function showPlaceButton() {
    // Layout lives in CSS so labels and selection commands fit narrow screens.
    actionButtons.style.display = 'flex';
    updateSelectionUI();
}
