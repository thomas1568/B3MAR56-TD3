# Validation de la refonte Memoria Corti

## Résultats exécutés

- Suite Node : **70 tests réussis, 0 échec, 1 ignoré**. Le contrôle eSpeak réel reste optionnel et nécessite les outils vocaux documentés.
- `node tests/shell-browser.mjs` : **réussi**, dans Chrome, sous le chemin `/B3MAR56-TD3/`.
- `node tests/browser-smoke.mjs` : **réussi**, dans Chrome avec WebGL et événements tactiles réels, poses XR et caméra simulées.
- Rendu examiné sur des captures de **320, 390, 768 et 1440 px**.
- Cette validation a été réalisée localement avant la publication demandée ensuite.

Le scénario principal vérifie les cinq destinations, le glissement de la lentille,
la conservation du défilement et des filtres, le retour/avance, le lien direct après
actualisation, la réduction des animations et les commandes clavier. Il vérifie
aussi la continuité de lecture audio, les transcriptions, le recadrage tactile de
photo et la persistance du profil.

## Carte et trajet

Le navigateur utilise le véritable moteur Leaflet et l’extrait OpenStreetMap local
pour reproduire une panne des tuiles. L’attribution est contrôlée comme visible et
cliquable. Recherche, marqueurs, déplacement tactile, panneau à trois positions,
fiche de l’IUT et photo du Palazzu sont vérifiés.

Le calcul reproductible utilise une réponse IGN réelle enregistrée dans
`tests/fixtures/ign-corte-walk.json`, uniquement côté test. Le tracé, les distances,
la durée et les indications sont contrôlés. Les erreurs réseau, la réponse
malformée, l’annulation, le refus GPS, un lieu inconnu et une autorisation GPS
arrivant après l’effacement du trajet sont couverts.

Un appel réel au service IGN a été effectué séparément avec l’origine GitHub Pages :
HTTP 200 et autorisation CORS. IUT → Palazzu : 1 236,88 m et 1 114,192 s estimées,
125 points de géométrie. Voir [la configuration et les limites](cartographie.md).

Les positions continues du test sont des callbacks simulés de `watchPosition`.
Le test confirme l’avancement sur la géométrie, la reprise après une erreur
temporaire, l’absence de recalcul automatique et l’arrêt du suivi. La précision
pendant une marche réelle reste à vérifier sur téléphone.

## Contenus, comptes et AR

Les archives de production manquantes restent signalées. Une image injectée
uniquement par le test permet de vérifier l’agrandissement et le retour de focus,
sans ajouter de faux document historique à l’application. La vue 360° fonctionne.

Le profil local, le pseudo, les avatars et l’import photo sont testés dans Chrome.
L’authentification, les requêtes REST et le stockage privé sont vérifiés sur un
serveur HTTP de test. Aucun compte distant réel n’est créé. Pour utiliser Supabase,
renseigner `ACCOUNT_CONFIG` et appliquer `supabase/setup.sql`.

Le scénario AR vérifie les cinq repères, le placement, les modes visite/édition,
la sélection, les ajouts/suppressions répétés, la disposition persistée, la musique,
la sortie et le redémarrage. L’accueil ne télécharge pas Three.js ni les modèles.
La caméra réelle, les permissions de l’appareil, le hit-test, la stabilité du
placement et le suivi physique exigent encore un téléphone HTTPS/WebXR compatible.
Ces contrôles ne constituent pas un audit WCAG exhaustif.

## Captures

Les profils affichés sont des données de test. Les captures ci-dessous sont
conservées sur le poste de validation dans `artifacts/refonte/`. Ce dossier est
exclu du dépôt Git ; ces liens sont donc destinés à la consultation locale.

- [Accueil mobile](../artifacts/refonte/home-390.png)
- [Explorer mobile](../artifacts/refonte/explore-390.png)
- [Parcours mobile, plan local de secours](../artifacts/refonte/map-390.png)
- [Écouter mobile](../artifacts/refonte/listen-390.png)
- [Profil mobile](../artifacts/refonte/profile-390.png)
- [Trajet calculé, réponse IGN enregistrée pour le test](../artifacts/refonte/walking-route-mobile.png)
- [Accueil sur ordinateur](../artifacts/refonte/home-1440.png)
- [Vue 360°](../artifacts/refonte/panorama-mobile.png)
- [AR avec poses et caméra simulées](../artifacts/refonte/ar-simulee.png)

## Lancement

```sh
node scripts/serve.mjs
```

Ouvrir http://127.0.0.1:8080/B3MAR56-TD3/#accueil.
Aucune installation npm ni compilation n’est nécessaire. Les services en ligne
nécessitent Internet ; aucune clé n’est requise pour la configuration cartographique
actuelle. Les clés de comptes éventuelles restent publiques, jamais des secrets.

## Correctif de l’écran blanc après déploiement

Le défaut a été reproduit avec le module Corte de la version précédente conservé
dans le cache HTTP de Chrome. L’import de `photoVariants` échouait dans l’interface
avant la création de `appView` ; après fermeture de l’introduction, l’écran était vide.
Les tests précédents en session neuve ne reproduisaient pas ce mélange de versions.

Les imports locaux utilisent désormais une version cohérente et le chargement
principal dispose d’un écran de récupération avec nouvelle tentative. Le scénario
`node tests/startup-browser.mjs` passe : cache ancien, adresse normale sans paramètres,
profil et progression préservés, panne du module puis rechargement réussi.
Les deux scénarios navigateur existants et les 66 tests Node ont aussi été relancés
avec succès après ce correctif (le contrôle eSpeak reste ignoré).

## Photo IUT et animations de défilement

La photographie jointe par le contributeur remplace le livre sur les cartes de
l’IUT et dans la fiche de l’étape. L’original PNG 415 × 739 px est conservé ;
les variantes WebP de 320 et 415 px pèsent environ 20 et 31 Ko. Les crédits
distinguent cette image fournie pour le projet des photographies sous licence libre.

Le logo et les commandes de l’en-tête s’effacent en descendant et réapparaissent
en remontant. Un petit seuil évite les clignotements. Les cartes entrent dans la
fenêtre avec un fondu et un déplacement léger ; les images réagissent au survol.
Les contenus restent visibles sans moteur d’animation et la préférence de réduction
du mouvement annule les animations en cours.

Le scénario Chrome vérifie le masquage et le retour du logo, la nouvelle photo,
le défilement conservé entre onglets et le mode réduit. Les captures 320/390/768/1440 px
ont été régénérées et examinées. La suite Node reste à 66 succès et 1 contrôle optionnel
ignoré ; le scénario de démarrage avec ancien cache passe également.

## AR native, marqueur IUT unique et flèches SVG

Le point 42.297500, 9.154278 est désormais l’unique IUT de Corse, avec sa photo
et son accès à l’étape. Le marqueur IUT voisin et la fiche « Point GPS » ont été
retirés. L’ancien lien fixed-gps est migré vers iut sans perdre l’accès au parcours.
Les boutons « Sur le plan » utilisent une flèche SVG épaisse dans un cercle contrasté.

WebXR conserve le placement et l’édition interactifs existants. Apple Quick Look
et Android Scene Viewer ouvrent des modèles autonomes exportés depuis la scène
d’évocation, avec ses cinq repères. Les interactions propres au site et les récits
restent dans Memoria Corti ; les visionneuses natives gèrent leur propre placement.
Voir ar-navigateurs.md pour les appareils requis et les limites.

Validation : 70 tests Node réussis, 0 échec, 1 contrôle eSpeak optionnel ignoré.
Le scénario Chrome vérifie deux marqueurs, la migration du lien, la nouvelle flèche,
les plateformes natives émulées, le modèle Apple, son type MIME, l’erreur de chargement
et la nouvelle tentative, ainsi que le lien Android. Le scénario WebXR et le test
de démarrage avec ancien cache passent également. Le lancement réel de Quick Look
et Scene Viewer reste à contrôler sur téléphone compatible.

Captures locales : native-apple-mobile.png, native-android-mobile.png,
map-action-mobile.png et map-390.png dans artifacts/refonte.
