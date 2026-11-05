# Validation de la refonte Memoria Corti

## Résultats exécutés

- Suite Node : **66 tests réussis, 0 échec, 1 ignoré**. Le contrôle eSpeak réel reste optionnel et nécessite les outils vocaux documentés.
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
fiche du point GPS et photo du Palazzu sont vérifiés.

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
