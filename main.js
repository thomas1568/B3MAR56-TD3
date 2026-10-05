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

// Selection and single-finger translation state.
let selectedObject = null;
let selectionHelper = null;
let drag = null;
let dragHitSource = null;
let dragHitPending = false;
let dragHitRay = null;
const selectionRaycaster = new THREE.Raycaster();
const rayMatrix = new THREE.Matrix4();
const dragPoint = new THREE.Vector3();

let xrAddShortcutHeld = false;
let xrClearShortcutHeld = false;

let current_object = null;
let loading_model = null;

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

    clearButton.addEventListener(
        'click',
        clearPlacedObjects
    );

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
            color: 0xffffff
        });

    reticle = new THREE.Mesh(
        geometry,
        material
    );

    reticle.matrixAutoUpdate = false;
    reticle.visible = false;

    scene.add(reticle);


    // -------------------------------------------------
    // DEBUT DE SESSION AR
    // -------------------------------------------------

    renderer.xr.addEventListener(
        'sessionstart',
        function () {

            hitTestSource = null;
            hitTestSourceRequested = false;
            xrAddShortcutHeld = false;
            xrClearShortcutHeld = false;

            reticle.visible = false;

            const session = renderer.xr.getSession();
            session.addEventListener('selectstart', onXRSelectStart);
            session.addEventListener('selectend', onXRSelectEnd);
            session.addEventListener('inputsourceschange', onXRInputsChanged);
            overlay.style.pointerEvents = 'auto';
            overlay.style.touchAction = 'none';
            resetSelection();
            showPlaceButton();

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

            hitTestSource = null;
            hitTestSourceRequested = false;
            xrAddShortcutHeld = false;
            xrClearShortcutHeld = false;

            reticle.visible = false;

            resetSelection();
            overlay.style.pointerEvents = '';
            overlay.style.touchAction = '';
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

    loading_model = model;

    selected_model = model;

    const loader = new GLTFLoader();

    loader.load(

        'model/' + model + '.glb',

        function (gltf) {

            // Si un autre modèle a été sélectionné
            // pendant le chargement, on ignore celui-ci
            if (loading_model !== model) {
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
        },

        undefined,

        function (error) {

            console.error(
                'Erreur lors du chargement de ' +
                model +
                '.glb',
                error
            );
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

    if (drag) return; // A drag never also places a model.

    // Aucun modèle à placer
    if (!current_object) {
        return;
    }


    // Aucune surface détectée
    if (!reticle.visible) {
        return;
    }


    // Place le modèle à l'endroit du reticle
    current_object.position.setFromMatrixPosition(
        reticle.matrix
    );

    current_object.visible = true;


    // On ajoute le modèle à la liste
    // des modèles définitivement placés
    placed_objects.push(
        current_object
    );


    // Il n'est plus le modèle en attente
    current_object = null;


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

    // En Play mode, certaines touches deviennent des entrées de manette XR.
    updateARDrag(frame);
    if (selectionHelper && selectedObject) selectionHelper.update();
    handleXRControllerShortcuts();


    const referenceSpace =
        renderer.xr.getReferenceSpace();

    const session =
        renderer.xr.getSession();


    // -------------------------------------------------
    // DEMANDE DU HIT TEST
    // -------------------------------------------------

    if (!hitTestSourceRequested) {

        hitTestSourceRequested = true;

        session
            .requestReferenceSpace(
                'viewer'
            )

            .then(
                function (viewerSpace) {

                    return session
                        .requestHitTestSource({
                            space: viewerSpace
                        });
                }
            )

            .then(
                function (source) {

                    hitTestSource =
                        source;
                }
            )

            .catch(
                function (error) {

                    console.error(
                        'Erreur Hit Test :',
                        error
                    );

                    hitTestSourceRequested =
                        false;
                }
            );
    }


    // -------------------------------------------------
    // RECUPERATION DU HIT TEST
    // -------------------------------------------------

    if (hitTestSource) {

        const hitTestResults =
            frame.getHitTestResults(
                hitTestSource
            );


        if (
            hitTestResults.length > 0
        ) {

            const hit =
                hitTestResults[0];


            const pose =
                hit.getPose(
                    referenceSpace
                );


            if (pose) {

                reticle.visible = true;

                reticle.matrix.fromArray(
                    pose.transform.matrix
                );
            }

        } else {

            reticle.visible = false;
        }
    }


    // -------------------------------------------------
    // AFFICHAGE
    // -------------------------------------------------

    renderer.render(
        scene,
        camera
    );
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

function clearPlacedObjects() {

    resetSelection();

    placed_objects.forEach(
        function (object) {
            scene.remove(object);
        }
    );

    placed_objects = [];
}


// -------------------------------------------------
// SELECTION ET DEPLACEMENT DES MODELES POSES
// -------------------------------------------------

// Selection and translation use the same local XR space as placement.
function stopDrag() {
    drag = null;
    if (dragHitSource) dragHitSource.cancel();
    dragHitSource = null;
    dragHitRay = null;
}

function resetSelection() {
    stopDrag();
    selectedObject = null;
    if (selectionHelper) {
        scene.remove(selectionHelper);
        selectionHelper.dispose();
        selectionHelper = null;
    }
}

function beginDrag(ray, owner) {
    if (drag) return;
    scene.updateMatrixWorld(true);
    selectionRaycaster.ray.copy(ray);
    const hit = selectionRaycaster.intersectObjects(placed_objects, true)
        .find(result => result.object.visible);
    resetSelection();
    if (!hit) return;
    selectedObject = hit.object;
    while (!placed_objects.includes(selectedObject)) selectedObject = selectedObject.parent;
    selectionHelper = new THREE.BoxHelper(selectedObject, 0x80d8ff);
    selectionHelper.material.transparent = true;
    selectionHelper.material.opacity = 0.55;
    scene.add(selectionHelper);
    const origin = selectedObject.getWorldPosition(new THREE.Vector3());
    // Fixed horizontal plane through the origin; camera-facing at grazing angles.
    const normal = Math.abs(ray.direction.y) > 0.15
        ? new THREE.Vector3(0, 1, 0) : ray.direction.clone().negate();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, origin);
    const initial = ray.intersectPlane(plane, new THREE.Vector3());
    drag = { owner, ray: ray.clone(), plane,
        planeOffset: initial ? origin.clone().sub(initial) : null,
        surfaceOffset: null, moved: false, lastOrigin: origin.clone() };
}

function applyDragPoint(point, surface, ray) {
    if (!drag || !selectedObject || !point ||
        ![point.x, point.y, point.z].every(Number.isFinite)) return;
    const key = surface ? 'surfaceOffset' : 'planeOffset';
    // Rebase on projection changes to avoid jumps when tracking changes.
    if (!drag[key]) drag[key] = drag.lastOrigin.clone().sub(point);
    if (!drag.moved) return;
    const position = point.clone().add(drag[key]);
    selectedObject.position.copy(selectedObject.parent.worldToLocal(position.clone()));
    selectedObject.updateMatrixWorld(true);
    drag.lastOrigin.copy(position);
    if (surface) {
        const fallback = ray.intersectPlane(drag.plane, new THREE.Vector3());
        if (fallback) drag.planeOffset = position.clone().sub(fallback);
    } else drag.surfaceOffset = null;
}

function pointerRay(event) {
    const rect = document.getElementById('content').getBoundingClientRect();
    renderer.xr.updateCamera(camera);
    const xrCamera = renderer.xr.getCamera();
    const viewCamera = xrCamera.cameras[0] || xrCamera;
    selectionRaycaster.setFromCamera(new THREE.Vector2(
        (event.clientX - rect.left) / rect.width * 2 - 1,
        -(event.clientY - rect.top) / rect.height * 2 + 1
    ), viewCamera);
    return selectionRaycaster.ray.clone();
}

function onARPointerDown(event) {
    if (!renderer.xr.isPresenting || !event.isPrimary || event.button !== 0 ||
        event.target.closest('button, a, #menuButton, #mySidenav')) return;
    event.preventDefault();
    beginDrag(pointerRay(event), event.pointerId);
    if (drag) event.currentTarget.setPointerCapture(event.pointerId);
}

function onARPointerMove(event) {
    if (!drag || drag.owner !== event.pointerId) return;
    event.preventDefault();
    drag.ray.copy(pointerRay(event));
    drag.moved = true;
}

function onARPointerEnd(event) {
    if (!drag || drag.owner !== event.pointerId) return;
    // Commit the final finger position even when no XR frame ran after pointermove.
    if (event.type === 'pointerup' && drag.moved) {
        const ray = pointerRay(event);
        applyDragPoint(ray.intersectPlane(drag.plane, dragPoint), false, ray);
    }
    stopDrag();
}

function inputRay(frame, inputSource) {
    const pose = frame.getPose(inputSource.targetRaySpace, renderer.xr.getReferenceSpace());
    if (!pose) return null;
    rayMatrix.fromArray(pose.transform.matrix);
    return new THREE.Ray(new THREE.Vector3().setFromMatrixPosition(rayMatrix),
        new THREE.Vector3(0, 0, -1).transformDirection(rayMatrix));
}

function onXRSelectStart(event) {
    if (renderer.xr.getSession().domOverlayState || event.inputSource.targetRayMode !== 'screen') return;
    const ray = inputRay(event.frame, event.inputSource);
    if (ray) beginDrag(ray, event.inputSource);
}

function onXRSelectEnd(event) {
    if (drag && drag.owner === event.inputSource) stopDrag();
}

function onXRInputsChanged(event) {
    if (drag && event.removed.includes(drag.owner)) stopDrag();
}

function updateARDrag(frame) {
    if (!drag) return;
    if (typeof drag.owner !== 'number') {
        const ray = inputRay(frame, drag.owner);
        if (!ray) return;
        if (ray.direction.distanceToSquared(drag.ray.direction) > 1e-8 ||
            ray.origin.distanceToSquared(drag.ray.origin) > 1e-8) drag.moved = true;
        drag.ray.copy(ray);
    }
    // Query real geometry under the finger, not under the central reticle.
    // Serialize requests; ignore sources belonging to an ended gesture/session.
    if (dragHitSource) {
        const results = frame.getHitTestResults(dragHitSource);
        const pose = results[0]?.getPose(renderer.xr.getReferenceSpace());
        const ray = dragHitRay;
        if (pose) {
            dragPoint.setFromMatrixPosition(rayMatrix.fromArray(pose.transform.matrix));
            applyDragPoint(dragPoint, true, ray);
        } else applyDragPoint(ray.intersectPlane(drag.plane, dragPoint), false, ray);
        dragHitSource.cancel();
        dragHitSource = null;
    }
    if (typeof XRRay === 'undefined') {
        applyDragPoint(drag.ray.intersectPlane(drag.plane, dragPoint), false, drag.ray);
        return;
    }
    if (!dragHitPending) {
        const gesture = drag;
        const session = renderer.xr.getSession();
        const ray = drag.ray.clone();
        dragHitPending = true;
        session.requestHitTestSource({
            space: renderer.xr.getReferenceSpace(),
            offsetRay: new XRRay(
                { x: ray.origin.x, y: ray.origin.y, z: ray.origin.z, w: 1 },
                { x: ray.direction.x, y: ray.direction.y, z: ray.direction.z, w: 0 }
            )
        }).then(source => {
            if (drag !== gesture || renderer.xr.getSession() !== session) source.cancel();
            else { dragHitSource = source; dragHitRay = ray; }
        }).catch(() => {
            if (drag === gesture) applyDragPoint(ray.intersectPlane(drag.plane, dragPoint), false, ray);
        }).finally(() => { dragHitPending = false; });
    }
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
        clearPlacedObjects();
    }
}


// -------------------------------------------------
// RACCOURCIS VIA MANETTES XR / IMMERSIVE WEB EMULATOR
// - A en Play mode : stick gauche vers la gauche => ajout
// - Bouton A / X : ajout
// - Bouton B / Y : suppression
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

            if (!gamepad) {
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
        clearPlacedObjects();
    }

    xrAddShortcutHeld = addPressed;
    xrClearShortcutHeld = clearPressed;
}


// -------------------------------------------------
// BOUTON DE PLACEMENT MOBILE
// -------------------------------------------------

function showPlaceButton() {

    // Les styles en ligne évitent que le DOM Overlay WebXR ne replace
    // le bouton en haut de l'écran sur certains téléphones/émulateurs.
    Object.assign(
        actionButtons.style,
        {
            display: 'flex',
            visibility: 'visible',
            opacity: '1',
            pointerEvents: 'auto',
            position: 'fixed',
            top: 'auto',
            right: '20px',
            bottom: '20px',
            left: 'auto',
            transform: 'none',
            zIndex: '2147483647',
            gap: '12px',
            flexDirection: 'row',
            flexWrap: 'nowrap',
            alignItems: 'center',
            justifyContent: 'flex-end',
            width: '124px',
            height: '56px',
            whiteSpace: 'nowrap'
        }
    );

    // Annule les anciennes positions fixes éventuelles sur les boutons.
    [placeButton, clearButton].forEach(
        function (button) {
            Object.assign(
                button.style,
                {
                    display: 'inline-block',
                    position: 'static',
                    top: 'auto',
                    right: 'auto',
                    bottom: 'auto',
                    left: 'auto',
                    width: '56px',
                    height: '56px',
                    flex: '0 0 56px',
                    transform: 'none'
                }
            );
        }
    );
}
