# Memoria Corti

Application culturelle de découverte des lieux, mémoires et patrimoines de Corte.
L’IUT est la première expérience disponible ; le Palazzu reste en préparation.
HTML, CSS et JavaScript natifs, hébergement statique GitHub Pages.

## Lancer en local

Prérequis : Node.js 22 ou version plus récente.

```sh
node scripts/serve.mjs
```

Ouvrir **http://127.0.0.1:8080/B3MAR56-TD3/#accueil**.
Le port peut être changé avec la variable `PORT`.
Aucune compilation ni installation npm n’est nécessaire.
La carte en ligne et le calcul piéton nécessitent Internet.

## Navigation et identité

Cinq destinations : **Accueil, Explorer, Parcours, Écouter, Profil**.
La carte, la liste des étapes et le calcul d’itinéraire sont intégrés à Parcours.
L’accueil associe une photographie documentée de Corte, une action Commencer/Reprendre,
des lieux et des récits. Le lecteur commun reste actif entre les destinations.
Les transcriptions sont accessibles sous les récits.

Palette : vert profond `#273B31`, cuivre `#B86D4E`, ivoire `#F4F0E8`,
beige `#EBE5D9`, texte `#202823`. Titres éditoriaux Georgia, commandes et textes Arial.
Les surfaces de lecture restent opaques ; le verre est réservé aux commandes
superposées. Le rendu Web de la lentille repose sur CSS, sans réfraction native.

## Liens et GitHub Pages

Les liens sont des fragments, compatibles avec le sous-chemin du dépôt :

- `#accueil`, `#explorer`, `#parcours`, `#ecouter`, `#profil`
- `#parcours?lieu=palazzu`
- `#etape/iut?point=paoli`

Le retour/avance du navigateur et l’actualisation restaurent l’écran ciblé.
Le défilement, les filtres, la sélection de lieu et le brouillon de profil restent
en mémoire pendant la session. Un guidage GPS ne redémarre pas automatiquement
après une actualisation ou une fermeture.

## Organisation

- `main.js` : démarrage léger, interface et chargement différé de l’AR.
- `memoria/shell.js`, `navigation.js` : cinq destinations, historique, profils et lentille.
- `memoria/immersive-map.js`, `routing.js` : Leaflet, lieux, calcul et suivi piéton.
- `memoria/ar-runtime.js` : Three.js, WebXR, placement, édition et fin de session.
- `memoria/experience.js` : contenus, transcriptions, dialogues et lecteur commun.
- `memoria/panorama.js` : consultation 360°, chargée à l’ouverture.
- `main.css` : fondations, contrôles, dialogues, lecteur.
- `memoria/shell.css` : écrans, comptes, accueil et navigation.
- `memoria/city.css` : carte, trajet et recadrage de profil.
- `memoria/experience.css`, `ar.css` : contenus et commandes immersives.
- `content/` : contenus documentés, ressources et données à compléter.
- `vendor/leaflet/` : bibliothèque locale et licence.

Les anciennes feuilles correctives `modern.css` et `refinements.css` sont retirées.
Les fonctions 3D sont chargées à l’ouverture d’une étape ; aucun modèle n’est
téléchargé sur l’accueil. Le panorama dispose de son propre chargement différé.
La fin de session AR arrête la boucle de rendu, libère les modèles de la session,
annule le hit-test et arrête les sons.

## Carte, services et configuration

Voir [la documentation cartographique](docs/cartographie.md) : fournisseurs,
conditions, paramètres, erreurs, confidentialité et limites de précision.
Le calcul principal se déroule dans l’application avec le service piéton IGN.
Le plan externe reste une action secondaire.
`MAP_CONFIG` est public et ne contient aucun secret.

Pour les comptes : renseigner `ACCOUNT_CONFIG` dans `memoria/config.js` avec l’URL
Supabase et sa clé **publique**. Exécuter `supabase/setup.sql` pour les tables et
le bucket privé des avatars. Configurer les URLs de retour avec l’adresse du site
GitHub Pages et l’origine locale. Ne jamais exposer de clé `service_role`.
Sans Supabase, le mode invité garde le profil et la progression sur cet appareil
et s’annonce explicitement comme local.

## Médias et contenus

Les photographies originales de Corte et leurs licences sont dans
[assets/photos/README.md](assets/photos/README.md) et `credits.json`.
Les versions WebP 320/768/1280 px conservent le cadrage entier, les sujets et les droits.
Elles sont produites par `node scripts/optimize-photos.mjs` (Chrome requis).
Les originaux sont conservés ; les tailles exportées figurent dans `variants.json`.
Les images secondaires sont chargées à la demande.

Les voix générées, la musique originale, les illustrations d’évocation et les
archives restent clairement distinguées. Voir [les notes sur les contenus et l’AR](docs/contenus-et-ar.md)
et [les narrations](assets/audio/README.md).
La photographie du campus, les archives autorisées, les témoignages et les ambiances
de terrain non fournis ne sont pas remplacés par de faux documents. La fiche du
point GPS conserve un état neutre.

## Vérifications

```sh
node --test tests/accounts.mjs tests/ar-interactions.mjs tests/memoria.mjs tests/music.mjs tests/narration-and-entry.mjs tests/french-phonemes.mjs tests/city-and-crop.mjs tests/immersive-map.mjs tests/routing.mjs
node tests/shell-browser.mjs
node tests/browser-smoke.mjs
```

Chrome est nécessaire aux parcours navigateur ; définir `CHROME_PATH` si besoin.
Le scénario principal sert les fichiers sous `/B3MAR56-TD3/` et vérifie historique,
liens directs, audio, profils, carte, calcul, erreurs et géolocalisation simulée.
Les réponses de calcul reproductibles sont enregistrées explicitement comme fixtures
de test. Un appel réel IGN a aussi été vérifié séparément.
Les captures principales sont écrites dans `artifacts/refonte/`.

Le scénario AR utilise WebGL et de vrais événements tactiles, avec des poses XR
simulées. La caméra, les permissions, le hit-test et le suivi physique restent à
vérifier sur un téléphone compatible HTTPS/WebXR/DOM Overlay.
La vue 360° et les fiches sont disponibles lorsque l’AR ne l’est pas.
Le contrôle eSpeak optionnel demande les outils de génération vocale documentés.

Cette validation technique ne constitue pas un audit WCAG exhaustif.
Aucune publication distante n’est effectuée par les scripts de développement ou de test.

## Démarrage après une mise à jour

L’adresse publique reste `https://thomas1568.github.io/B3MAR56-TD3/`.
Les suffixes de version concernent les ressources internes, pas l’adresse à ouvrir.

Le correctif de démarrage aligne les imports locaux sur la version 31. L’ancienne
interface chargeait `content/corte.js` sans version ; après une mise à jour, sa copie
en cache pouvait manquer l’export `photoVariants` attendu par le nouveau module
d’interface. L’import échouait avant la construction des écrans.

Le chargement principal est désormais intercepté : en cas d’erreur, un écran lisible
propose de réessayer à la même adresse. Il ne supprime pas le profil local.
Lors d’une prochaine version, mettre à jour ensemble les versions des imports et
celles des ressources dans `index.html`.

```sh
node tests/startup-browser.mjs
```

Ce scénario conserve une vraie ancienne version du module Corte dans le cache HTTP
de Chrome, puis ouvre l’adresse normale avec le profil invité enregistré. Il vérifie
aussi une erreur de chargement du module principal, le message de récupération et
une nouvelle tentative réussie sans paramètre d’URL.
