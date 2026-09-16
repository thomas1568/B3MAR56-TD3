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

// État des actions venant des manettes émulées (anti-répétition).
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

    placed_objects.forEach(
        function (object) {
            scene.remove(object);
        }
    );

    placed_objects = [];
}


// -------------------------------------------------
// RACCOURCIS CLAVIER (PC)
// A : ajoute le modèle sélectionné
// E : supprime tous les modèles posés
// -------------------------------------------------

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
