# AR selon le navigateur et l’appareil

Le site propose plusieurs accès à la même scène d’évocation de l’IUT. Un site ne
peut pas activer un suivi spatial que le navigateur ou le téléphone ne fournit pas.
L’adresse publique reste la même et aucun compte de service AR n’est nécessaire.

| Accès | Conditions | Expérience |
| --- | --- | --- |
| WebXR dans le navigateur | HTTPS, appareil et navigateur prenant en charge immersive-ar, hit-test et DOM Overlay | Placement, cinq repères, récits, édition et sauvegarde de disposition existants. |
| Quick Look Apple | iPhone/iPad compatible ; Safari est la voie de référence, d’autres navigateurs iOS peuvent transmettre le lien au système | Scène USDZ, placement et manipulation dans la visionneuse Apple. |
| Scene Viewer Android | Navigateur Android transmettant les liens natifs ; application Google et services AR compatibles pour le placement | Scène GLB en AR quand elle est disponible, sinon visionneuse 3D ou retour au site. |
| Consultation web | Autres configurations | Fiches, transcriptions et vue 360° existante, sans simulation de suivi spatial. |

Les commandes JavaScript de Memoria Corti ne s’exécutent pas dans les visionneuses
natives. Les récits et l’édition propre au mode WebXR ne sont donc pas transférés à
Quick Look ou Scene Viewer. Le son web est arrêté au départ ; les récits et leurs
transcriptions restent accessibles au retour. Les déplacements faits dans la
visionneuse native ne sont pas enregistrés dans la disposition WebXR.

La détection privilégie les capacités déclarées et tient compte des plateformes
iOS/iPadOS et Android. L’application Google intégrée sur iOS ne reçoit pas de lien
Quick Look : le message invite à ouvrir Safari. Les navigateurs intégrés à d’autres
applications peuvent également limiter les ouvertures natives.

## Fichiers et chargement

- assets/ar/iut-scene-v1.glb : scène autonome, cinq repères et textures embarquées.
- assets/ar/iut-scene-v1.usdz : scène autonome compatible Quick Look.
- assets/ar/iut-scene-preview.webp : aperçu réellement rendu depuis la scène.
- assets/ar/manifest.json : origine, unités et points exportés.

Ces fichiers sont produits par :

```sh
node scripts/export-native-ar.mjs
```

Chrome et Node.js sont requis pour cette génération locale. Les exporteurs Three.js
r180 et fflate sont conservés avec leurs licences dans vendor/three-r180. Ils ne sont
pas téléchargés par le visiteur. Les modèles ne sont pas chargés sur l’accueil.
Sur Apple, le modèle est préparé à l’ouverture de l’étape puis présenté avec le type
MIME model/vnd.usdz+zip, même si l’hébergement statique ne connaît pas ce type.
Une erreur de chargement propose une nouvelle tentative et laisse la vue 360° accessible.

L’ouverture native reste une action explicite. Android utilise ar_preferred et
prévoit un retour vers #etape/iut?vue=360 si la visionneuse ne peut pas être ouverte.
Le lien de retour ne transmet pas les paramètres de recherche de l’adresse courante.
Lors d’une modification du modèle, changer son nom de version et les URLs correspondantes
pour préserver la cohérence du cache.

## Vérifications et limites

Les tests contrôlent les plateformes candidates, les liens sous /B3MAR56-TD3/, le
contenu GLB, les cinq repères, les textures embarquées, l’absence de compression ZIP
et l’alignement de 64 octets requis pour USDZ. Le scénario navigateur contrôle la
préparation Apple, le type MIME effectif, une erreur réseau, la nouvelle tentative
et la construction du lien Android. Les profils iOS et Android sont émulés dans
Chrome ; ils ne remplacent pas une exécution des visionneuses natives.

La caméra réelle, le placement Quick Look/Scene Viewer et leur retour au navigateur
restent à vérifier sur iPhone/iPad et Android compatibles. Le scénario WebXR utilise
WebGL et des événements tactiles réels, avec des poses XR simulées.

Sources officielles :
[Apple Quick Look](https://developer.apple.com/quick-look-gallery/),
[intégration Safari et rel=ar](https://webkit.org/blog/8421/viewing-augmented-reality-assets-in-safari-for-ios/),
[Google Scene Viewer](https://developers.google.com/ar/develop/scene-viewer),
[différences entre les modes AR](https://modelviewer.dev/examples/augmentedreality/).
