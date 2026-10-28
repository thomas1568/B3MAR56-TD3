# Memoria Corti — première étape IUT

Application statique ES modules : Three.js r180, WebXR (`immersive-ar`), hit-test, DOM Overlay, GLTFLoader et OrbitControls déjà présents. Aucune dépendance d’exécution ajoutée au site. Les outils de génération vocale restent dans un dossier local ignoré par Git. Le chargement de jQuery a été retiré ; les commandes utilisent les événements DOM natifs.

## Accueil personnalisé et profil

L’application propose désormais un accueil « Bonghjornu, [pseudo] », une reprise du dernier repère consulté, les sections **Explorer Corte** et **À écouter**, un parcours et un profil. La navigation principale est **Accueil, Explorer, Parcours, Écouter, Profil**. La préparation de l’IUT ouvre la navigation contextuelle existante **Préparer, Placer, Découvrir, Écouter, Quitter** ; « Accueil » dans l’en-tête revient à l’application hors AR. L’IUT est la seule étape disponible ; le Palazzu Naziunale est annoncé en préparation, avec une fiche d’information et un accès à la première étape.

La page IUT, les cinq fiches, les récits, les archives, les conseils AR et la consultation 360° partagent maintenant les illustrations et les cartes de l’accueil. L’ouverture d’une étape présente son visuel et son introduction avant les commandes de préparation. Les liens de marque et de retour reviennent au nouvel accueil.

La sélection de la barre principale se déplace sous le doigt : glisser d’une entrée à une autre puis relâcher ouvre cet onglet. Un glissement horizontal dans le contenu ouvre aussi la page voisine ; le défilement vertical et les champs de formulaire conservent leurs gestes habituels. Les flèches du clavier, Début et Fin fonctionnent dans la barre. La transition est courte, la position de défilement de chaque page est conservée, et la préférence de réduction des animations est respectée. Ces gestes ne s’appliquent pas à la scène AR.

Le bouton principal **Créer mon profil** ouvre directement le choix du pseudo et de l’image, sans passer par un formulaire d’authentification indisponible. Il fonctionne sans Supabase et annonce explicitement la conservation sur l’appareil. Le bouton distinct **Créer un compte connecté** apparaît lorsque Supabase est configuré. Sans configuration, l’information sur la synchronisation propose une action réelle pour créer le profil local au lieu d’un formulaire bloqué.

Le projet intègre quatre photographies réelles de Corte et de la Restonica, téléchargées depuis Wikimedia Commons dans `assets/photos/` avec auteurs, sources et licences vérifiées dans `credits.json`. L’accueil, la galerie et la card du Palazzu utilisent ces photos avec crédits visibles. Les visuels SVG de transmission et de récits restent clairement identifiés comme illustrations ; aucune photo de la ville n’est présentée comme une photographie de l’IUT ou une archive historique. Les cards n’affichent pas de durées inventées. La progression correspond précisément au nombre de fiches distinctes consultées parmi les cinq repères de l’IUT.

Sept avatars SVG sont proposés : citadelle, livre, voix, montagne, rivière, boussole et initiales. Une photo JPEG, PNG ou WebP de 5 Mo maximum peut être importée, déplacée directement au doigt et agrandie par pincement, avec un seul curseur de zoom et des boutons +/−. Un masque circulaire montre le cadrage final ; « Recentrer » réinitialise la vue et « Utiliser cette photo » reste visible dans le pied du dialogue. Les flèches, +/− et Début permettent aussi le cadrage au clavier. Les limites empêchent les bords vides. L’export carré JPEG de 640 px retire les métadonnées du fichier original. Une modification d’image est immédiatement visible dans le profil, l’en-tête et l’onglet Profil ; hors première utilisation, le choix d’image est enregistré automatiquement. Le pseudo est enregistré avec le bouton du formulaire. Les champs de saisie utilisent au minimum 16 px pour éviter le zoom automatique de mise au point sur iPhone, sans désactiver le zoom manuel de la page.

### Carte de Corte et médias locaux

L’onglet **Parcours** contient une carte interactive de Corte (Haute-Corse), fondée sur un extrait réel OpenStreetMap distribué dans `assets/maps/corte.json`. Le fond et les photos sont servis avec le site ; aucun compte cartographique, clé API, géolocalisation ou chargement de tuiles externes n’est nécessaire. Zoom, pincement, déplacement au doigt, clavier, recentrage et sélection des deux lieux sont disponibles. Un échec de chargement affiche un bouton de reprise et laisse les fiches accessibles.

Les marqueurs utilisent les positions des bâtiments OpenStreetMap **IUT di Corsica** (way `350787319`, centre approximatif `42.297383, 9.154338`) et **Palais National** (way `121178674`, centre approximatif `42.305007, 9.149190`). Le premier est disponible ; le second reste annoncé à venir. Une liaison indicative est calculée sur les voies piétonnes et rues connectées de l’extrait, en excluant les voies privées ou interdites aux piétons. Elle ne tient pas compte des changements temporaires ni des accès d’entrée précis ; le lien « Ouvrir ce lieu dans un plan » donne accès au lieu dans OpenStreetMap. La carte 2D est indépendante du placement AR manuel et ne prétend pas suivre la position de l’utilisateur.

Sources de localisation : [plan officiel des campus](https://www.universita.corsica/fr/universita/plan-des-campus/), [IUT dans OpenStreetMap](https://www.openstreetmap.org/way/350787319), [Palais National dans OpenStreetMap](https://www.openstreetmap.org/way/121178674). Les données cartographiques sont attribuées à OpenStreetMap et distribuées sous ODbL ; voir `assets/maps/README.md`. Les conditions de chaque photographie figurent dans `assets/photos/README.md` et dans le manifeste. Le script `node --use-system-ca scripts/fetch-corte-assets.mjs` reproduit le téléchargement et l’extraction ; il ne s’exécute pas dans l’application.

### Activer les véritables comptes Supabase

**Par défaut, aucun compte distant n’est activé.** Le mode invité fonctionne et s’annonce comme local à cet appareil. Il conserve le pseudo, l’avatar ou la photo et la progression dans le navigateur. Il ne prétend jamais être une session connectée et n’est pas synchronisé entre appareils. Le formulaire de connexion explique son indisponibilité tant que la configuration n’est pas fournie.

1. Créer un projet Supabase. Exécuter `supabase/setup.sql` dans son éditeur SQL : les tables de profils et de progression sont protégées par RLS, et le bucket privé `avatars` limite les accès au dossier de l’utilisateur authentifié.
2. Renseigner uniquement l’URL du projet et sa **clé publique publiable** (ou ancienne clé `anon`) dans `memoria/config.js`. Ne jamais ajouter de clé `service_role` ni de clé secrète. Aucun serveur applicatif ou outil de compilation n’est nécessaire ; le client utilise les API Auth, PostgREST et Storage de Supabase.
3. Activer l’authentification e-mail/mot de passe. Configurer la Site URL et les Redirect URLs avec `https://thomas1568.github.io/B3MAR56-TD3/` et l’origine de développement utilisée. La confirmation e-mail est prise en charge : sans jetons de session, l’application affiche un message de confirmation et attend la connexion. Les liens de confirmation reviennent vers le site, et leurs jetons sont retirés de l’URL avant chargement du profil.
4. Configurer un service SMTP adapté à la production et vérifier l’envoi des e-mails, les quotas et les politiques du projet Supabase. Tester l’inscription et la connexion avec un véritable compte, puis la restauration sur un autre appareil et l’isolation entre deux utilisateurs.

Avec Supabase configuré, le pseudo et la référence d’avatar sont enregistrés dans `memoria_profiles`, les fiches consultées dans `memoria_progress`, et les photos dans le bucket privé. Le navigateur conserve la session Auth pour retrouver le compte ; les jetons expirés sont renouvelés avant les requêtes. Les photos utilisent des URL signées. La déconnexion révoque la session courante côté service avant d’effacer la session locale. Le profil invité reste distinct du compte : aucune fusion implicite de ses données avec un compte distant n’est réalisée.

Références : [authentification par mot de passe](https://supabase.com/docs/guides/auth/passwords), [gestion des sessions](https://supabase.com/docs/guides/auth/sessions), [politiques Storage](https://supabase.com/docs/guides/storage/security/access-control).

### Vérifications de la nouvelle interface

```powershell
node --test --test-isolation=none tests/ar-interactions.mjs tests/memoria.mjs tests/accounts.mjs tests/city-and-crop.mjs tests/music.mjs tests/narration-and-entry.mjs tests/french-phonemes.mjs
node tests/shell-browser.mjs
node tests/browser-smoke.mjs
```

Les tests du profil couvrent les validations, le mode invité, la persistance après rechargement, les sept avatars, le déplacement, le pincement, le recentrage et l’import de photo, l’image dans la navigation, la progression et la reprise. La carte est contrôlée pour le chargement de données locales, la liaison entre les lieux, le zoom, le déplacement sans changement d’onglet et la sélection disponible/à venir. Le test Chrome exécute aussi une inscription avec confirmation e-mail, une connexion refusée puis réussie, le stockage de photo et la reconnexion **contre un serveur HTTP simulant Supabase**. Il ne crée aucun compte réel. Les contrôles des politiques RLS, de SMTP et des e-mails réels nécessitent la configuration du projet et restent à effectuer. Les vues mobiles, tablette et ordinateur sont contrôlées à 320, 390, 768 et 1440 px. Les tests AR utilisent toujours des poses simulées ; le suivi et les permissions sur téléphone restent à confirmer. Le rendu réel du clavier et du zoom Safari nécessite un contrôle sur iPhone.

## Interface et navigation

À chaque ouverture ou rechargement, une introduction courte présente l’emblème et le nom Memoria Corti sur un dégradé ivoire/beige/vert. Elle se ferme après la restauration du profil et environ une seconde, avec un fondu bref. « Passer l’introduction » et Échap permettent de la passer. La préférence de réduction des animations supprime le mouvement et l’attente esthétique. Le contenu est inactif pendant l’introduction, puis le focus rejoint l’accueil ou l’entrée du profil. Des délais de secours empêchent qu’un échec de démarrage laisse cette couche bloquée.

Dans **Préparer**, les cinq cartes ont des visuels distincts : illustration de campus contemporain, livre, photographie actuelle de la statue de Paoli, dossiers d’archives illustrés autour de 1981, et photographie de la citadelle. Le statut photo/illustration et les crédits des photographies sont visibles. Ces visuels ne remplacent pas les archives historiques encore manquantes. Dans **Découvrir**, le grand en-tête défile avec la page ; seule une petite commande de fermeture reste disponible en haut.

## Voix des récits

Les sept textes existants disposent de fichiers MP3 locaux avec une voix française **IA naturelle** : accueil, récit principal et cinq repères. La voix Kokoro `ff_siwis` remplace la voix par défaut du navigateur. Le lecteur indique sa provenance IA, la durée réelle et les états de chargement/erreur ; pause, reprise, volume, transcription et trois rythmes de lecture sont disponibles. Les préférences de rythme et de source sont conservées localement. La voix de l’appareil reste une option de secours, avec priorité aux voix françaises et choix explicite parmi celles installées.

Le modèle est utilisé uniquement pendant la génération, et ne figure pas dans le site déployé. Aucune clé API ni configuration de service vocal n’est nécessaire. Les crédits, limites de prononciation et instructions de régénération sont dans [assets/audio/README.md](assets/audio/README.md). Les enregistrements de véritables narrateurs humains restent une autre possibilité ; les fichiers intégrés sont clairement identifiés comme synthétiques.

La conversion des accents est explicitement UTF-8 : l’ancienne syntaxe d’encodage faisait prononcer « copyright » à la place de certains « é ». Les récits sont régénérés avec une normalisation des élisions et des acronymes, des pauses aux virgules et un journal phonétique par phrase. Les URL des MP3 incluent leur empreinte pour renouveler le cache. Les mentions IA et les crédits restent affichés, sans être lus dans les histoires. Les titres qui reçoivent le focus de navigation, dont « Bonghjornu, [pseudo] », n’affichent plus le contour automatique du navigateur ; les boutons et liens gardent leur focus clavier visible.

L’interface utilise le vert profond `#273B31`, le cuivre `#B86D4E`, l’ivoire `#F4F0E8`, le beige `#EBE5D9` et le texte `#202823`, avec Georgia pour les titres et Arial pour les textes et les commandes. Les pictogrammes partagent une même famille SVG locale, sans dépendance ni chargement externe.

La capsule contextuelle de l’étape reste accessible pendant sa préparation, en consultation 360° et dans le DOM Overlay AR :

- **Préparer** ouvre l’étape et ses indications ; pendant l’AR, affiche les conseils sans interrompre la session.
- **Placer** démarre l’AR après préparation, puis utilise la pose détectée pour placer ou recaler la scène. Sans surface détectée, explique le geste de scan. Sans WebXR, annonce l’indisponibilité et oriente vers le 360°.
- **Découvrir** ouvre le 360° hors AR, ou revient au mode Visite après placement dans l’AR.
- **Écouter** ouvre les récits, ambiances et transcriptions.
- **Quitter** arrête tous les sons, termine la session XR et libère la scène et le panorama, puis réinitialise le parcours.

Les prérequis sont exposés par `aria-disabled`, un indicateur sur les pictogrammes, des descriptions au survol et un message lors de l’activation. L’étape sélectionnée utilise `aria-current="step"`. Le verre associe transparence teintée, flou, reflet et bordure ; un fond opaque prend le relais sans prise en charge du flou ou avec une préférence de réduction de transparence. Les zones de sécurité, l’espace sous les contenus, les cibles tactiles de 44 px minimum et la préférence de réduction des animations sont pris en compte. Les boîtes de dialogue conservent le focus clavier et se ferment avec Échap ; le 360° rend l’accueil inactif et se ferme aussi avec Échap.

Les tests navigateur couvrent également les cinq commandes de la capsule, les prérequis, le retour du focus, la sortie complète et les géométries à 320, 390, 768 et 1440 px. Ils produisent des captures dans le dossier temporaire indiqué dans leur sortie. Sans autorisation de création de processus enfants, les tests Node peuvent s’exécuter avec `node --test --test-isolation=none tests/ar-interactions.mjs tests/memoria.mjs` ; le test navigateur nécessite le lancement de Chrome.

## Caméra, interface AR et ambiance

Le framebuffer Three.js est explicitement transparent (`setClearColor(0x000000, 0)`, `scene.background = null`). Pendant la session, les fonds `html`, `body`, de la racine DOM Overlay et de son `::backdrop` sont transparents ; les pages plein écran de l’application sont masquées. La caméra est composée par WebXR. Il n’y a aucun flux `getUserMedia` supplémentaire ni capture de l’environnement envoyée à un service. Le diagnostic affiche le mode de composition fourni par l’appareil et l’alpha WebGL pour examiner un écran opaque sur téléphone. La caméra réelle nécessite toujours un appareil WebXR compatible ; les tests Chrome valident les couches transparentes avec un fond simulé.

Référence du comportement de la couche HTML : [WebXR DOM Overlays, spécification](https://immersive-web.github.io/dom-overlays/).

Les commandes AR reprennent les cartes ivoire, le vert profond, le cuivre, Georgia/Arial et les icônes du site. L’en-tête regroupe Visite, Édition, Récits, Musique et Quitter. Les conseils et le diagnostic sont repliables. Le placement et la capsule contextuelle restent accessibles en bas, avec des dispositions portrait et paysage distinctes et des zones tactiles d’au moins 44 px.

**Petra · Memoria Corti** est une composition instrumentale originale, jouée par Web Audio : cordes pincées discrètes et notes tenues, 72 BPM. Le contexte sonore est déverrouillé pendant le geste de démarrage ; la partition commence uniquement une fois la session AR ouverte. La note de musique coupe ou relance le son, et le choix est conservé localement. Le volume est réduit pendant un récit. La sortie, le refus de session et la perte de visibilité arrêtent la partition et les autres lectures. Si le navigateur refuse le son, la commande Musique permet de réessayer ; l’expérience reste utilisable sans son. Aucun fichier commercial n’est chargé et aucune clé API n’est nécessaire.

## Vue 360°

Le panorama local `assets/panoramas/corte-evocation.jpg` remplace la sphère vide. Il s’agit d’une **illustration d’évocation créée avec IA**, explicitement identifiée dans l’écran, pas d’une photographie du campus ni d’une reconstruction de la ville. Ses cinq repères donnent accès aux récits sans prétendre les localiser dans le paysage. Le chargement et les erreurs sont annoncés, la fermeture reste visible pendant le défilement, le regard se déplace au toucher ou au clavier et « Recentrer » restaure la vue initiale. Les fiches restent accessibles si l’image échoue. Le prompt, la provenance et les limites de projection sont dans [les crédits du panorama](assets/panoramas/README.md).

## Utilisation

Servir ce dossier par HTTP pour consulter les fiches et le 360°. Sur téléphone, utiliser une origine HTTPS et un navigateur/appareil prenant en charge WebXR AR, hit-test et DOM Overlay. L’ouverture directe de `index.html` en `file://` ne convient pas aux modules ni à WebXR.

1. **Explorer l’étape IUT**, puis **Démarrer l’expérience AR**.
2. Autoriser la caméra, scanner doucement une surface plane et attendre le cercle blanc. **Placer la scène** installe le repère commun ; **Recaler la scène** repositionne ce repère sans perdre l’agencement interne.
3. En **Visite**, toucher un repère ou un élément ouvre sa fiche. Un glissement ne transforme rien. Les boutons de repères suivent leur projection 3D et des traits les relient au point réel lorsqu’ils sont espacés pour éviter les chevauchements.
4. En **Édition**, toucher un élément le sélectionne (cadre cuivre), glisser sur son maillage le déplace. **Tourner** active la rotation verticale par glissement horizontal ; **Déplacer** revient au déplacement. L’échelle reste inchangée. Toucher le vide désélectionne.
5. **Supprimer** enlève uniquement la sélection. **Ajouter un modèle** utilise le cercle ; le menu **Modèles** conserve les quatre GLB d’essai du projet. Aucun appui dans la scène n’ajoute ou ne supprime. Maximum : 16 éléments placés.
6. **Récits** ouvre l’accueil, le récit principal et le choix d’ambiance pendant l’AR. Les fiches ont leur propre écoute. La lecture est déclenchée par un bouton ; un seul récit joue à la fois. Pause, reprise, volume et transcription sont dans le lecteur. La synthèse vocale est annoncée comme lecture de texte. Le volume d’une voix peut dépendre du moteur du téléphone et prendre effet à la lecture suivante.
7. **Quitter AR** revient à la consultation ; **Quitter l’étape** referme l’étape et libère aussi la vue 360°. L’audio et les gestes sont arrêtés lors de la sortie ou d’une perte de visibilité.

## Positionnement et sauvegarde

Le projet ne contient aucune reconnaissance de façade, aucun GPS ni XRAnchor. Les objets utilisent l’espace de référence WebXR `local` déjà utilisé par ARButton. Leur pose n’est pas réécrite à chaque image par le hit-test.

Les éléments de l’étape sont enfants d’un groupe commun, placé manuellement sur une pose valide et orienté vers le visiteur. Les modèles d’essai déjà placés sont rattachés à ce groupe en conservant leur transformation mondiale ; les ajouts suivants utilisent le même repère.

Le déplacement utilise le plan de la surface AR détectée au début du geste, figé pendant ce geste. Si cette surface est indisponible ou presque parallèle au rayon, un plan cohérent passe par l’origine initiale de l’objet. Le décalage initial du point touché est conservé. Une intersection invalide conserve la dernière position valide. Le hit-test reste indépendant de la sélection.

**Enregistrer l’agencement** sauvegarde dans localStorage les transformations relatives et suppressions des sept éléments de l’étape, sous `memoria-corti:iut-layout:v1`. Les modèles GLB d’essai ajoutés ne sont pas sauvegardés. La pose mondiale du groupe n’est jamais enregistrée : après chaque session, il faut replacer la scène. **Réinitialiser la composition** restaure les sept éléments à leurs positions initiales et efface cette sauvegarde. Les transformations sauvegardées sont contrôlées avant application.

La stabilité du suivi et une éventuelle dérive nécessitent une validation sur appareil réel. Le placement manuel est une évocation installée près du lieu, sans promesse de reconnaissance automatique ou de persistance physique entre sessions.

## Organisation

- `index.html` / `main.css` : accueil, étape, modes, fiches, commandes, lecteur, archives et consultation 360°.
- `main.js` : session XR, hit-test/cercle, raycasts, gestes, modèles, repère commun et nettoyage.
- `content/iut.js` : textes, trois dates, cinq POI, transcriptions, positions/orientations, métadonnées, sources, crédits, droits et statuts.
- `memoria/scene.js` : table, livre ouvert, document, support de portrait, fenêtre d’archives et carte schématique ; ressources procédurales possédées par cette scène.
- `memoria/experience.js` : fiches, lecteur et navigation ; indépendant des poses XR.
- `memoria/audio.js` : récit unique, synthèse facultative, pause/reprise, volume, ambiances/musique, atténuation et nettoyage des lectures asynchrones.
- `memoria/panorama.js` : sphère 360°, image illustrée, points interactifs, rotation du regard tactile/clavier et recentrage.
- `memoria/music.js` : partition originale et synthèse Web Audio, déverrouillage mobile, arrêt et atténuation.
- `memoria/ar.css` : transparence du DOM Overlay, interface AR, musique et présentation du panorama.
- `memoria/hotspots.js` : espacement des boutons tactiles, sans déplacer les points 3D.
- `memoria/layout.js` : schéma, validation et sauvegarde des transformations relatives.
- `jsm/webxr/ARButton.js` : démarrage explicite, remontée des refus et maintien de la racine d’interface externe visible après la session.

Les cinq POI sont : IUT aujourd’hui, naissance de l’université, Pasquale Paoli, réouverture, Corte universitaire. Le livre et le document ouvrent la même fiche de 1765. Les questions de transmission, du choix de Corte et de la continuité actuelle figurent dans les fiches. La prochaine étape, Palazzu Naziunale, est annoncée comme **à préparer**.

## Contenus vérifiés et ressources à fournir

Les repères 1765/1981 ont été vérifiés auprès de l’[Université de Corse](https://www.universita.corsica/fr/universita/historique/), et 1983/campus Grimaldi auprès de l’[IUT de Corse](https://iut.universita.corsica/). Le Palazzu Naziunale de l’université historique est explicitement distingué du campus actuel. Les sources sont consultables dans chaque fiche.

Le projet intègre quatre photographies de Corte documentées dans `assets/photos/`, un panorama illustré créé avec IA et une partition originale pour l’AR. Les supports des cinq POI restent des évocations ; les archives, le portrait historique identifié de Paoli et les témoignages ne sont pas fabriqués. Les quatre GLB existants restent identifiés comme modèles d’essai, sans attribution historique ; leur provenance et leurs droits restent à documenter.

À fournir avec identification, date, crédit et conditions de réutilisation :

- Photographie actuelle de l’IUT, document lié à 1765, portrait historique identifié de Paoli et archive de 1981. La carte géographique 2D du parcours est désormais intégrée ; le support AR de Corte reste un schéma d’évocation.
- Photographie équirectangulaire 360° du lieu si une capture documentaire est souhaitée, puis calage des angles des POI. Le panorama actuel est une illustration d’évocation identifiée comme telle ; les fiches restent accessibles si WebGL échoue.
- Enregistrements de narrateurs humains si souhaités pour remplacer la narration IA intégrée. Les sept MP3 actuels disposent de durées calculées et de transcriptions identiques aux textes du parcours.
- Ambiances pages/écriture/murmures et campus ; une musique de fin facultative avec réutilisation autorisée. La partition instrumentale d’entrée AR est intégrée et originale.
- Deux images du **même lieu** uniquement si une comparaison avant/après pertinente est possible.

Renseigner les chemins `src` dans `content/iut.js` et passer `rights.status` à `autorise` après vérification, avec les crédits et conditions dans `rights.label`. Les images alimentent alors les fiches et l’agrandissement ; celles de Paoli et de 1981 alimentent aussi leur support 3D. `beforeAfter` reste `null` sans paire pertinente ; une paire exige `samePlace: true` et deux médias autorisés. Ne pas assimiler l’accès public d’une collection à une autorisation.

Collections possibles à examiner : [M3C](https://www.universita.corsica/fr/recherche/mediatheque-culturelle-de-corse-corses-m3c/) et [Musée de la Corse](https://www.museudiacorsica.corsica/fr/arts-graphiques/). [Archistoire](https://archistoire.com/) est une référence d’expérience, sans réutilisation de ses médias.

## Diagnostic et vérifications

Le panneau **Diagnostic AR** indique version, route d’entrée, sous-mesh/racine détectés, état du hit-test, pose, mode, sélection, action, geste et dernière erreur. L’objet observé est distingué comme supprimé, masqué, détaché, transformé invalidement ou hors champ. `?arDebug=1` ajoute la trace en console.

La disparition observée précédemment sur téléphone n’a pas été reproduite sur appareil réel dans cet environnement. Le code conserve la caméra de rendu XR intacte : le picking lit une copie de la dernière vue XR. Les erreurs de raycast/indicateur/rendu sont diagnostiquées sans supprimer les objets ni arrêter la boucle ou la source de placement. Les sprites de la nouvelle scène reçoivent une caméra de raycast explicite. Le masquage de toute l’interface par ARButton après la sortie d’une session a été corrigé.

Commandes exécutables sans nouvelle dépendance (Node 22 utilisé) :

```powershell
node --test tests/ar-interactions.mjs tests/memoria.mjs
node tests/browser-smoke.mjs
```

Le second test démarre Chrome sans fenêtre visible, via son protocole de débogage, avec un profil temporaire. Définir `CHROME_PATH` si l’exécutable n’est pas au chemin par défaut. Il utilise le véritable HTML, les modules, WebGL, les GLB et les événements tactiles Chrome. **Les poses/session XR sont simulées** par un pont ajouté uniquement dans le serveur de test ; aucun pont de test n’est livré dans l’application. Les tests audio utilisent des lecteurs/voix contrôlés. Ils ne valident pas le suivi, le son ou les permissions sur téléphone.

## Test sur téléphone

1. Charger par HTTPS, ouvrir l’étape IUT, vérifier les trois dates et la distinction des lieux.
2. Démarrer l’AR et autoriser la caméra. Vérifier que l’environnement est visible, que la musique commence doucement, que sa commande coupe et relance le son, et qu’aucun son ne continue après la sortie. Scanner une surface, vérifier le cercle blanc puis placer la scène. Sans surface, vérifier l’instruction et les boutons de placement désactivés. Si le fond reste opaque, relever le mode de composition et l’alpha dans « Conseils & détails » → « Diagnostic AR ».
3. En Visite, ouvrir les cinq fiches par leur repère puis par un sous-mesh (livre/document/support). Vérifier fermeture, défilement, sources, transcription et état de média manquant. Un glissement ne doit pas modifier la scène.
4. Ouvrir **Récits** et tester accueil/récit, pause/reprise, volume, changement de récit et transcription avec une voix disponible. Vérifier le message sans voix/enregistrement ; une ambiance manquante doit rester silencieuse. Tester l’atténuation après fourniture d’un fichier autorisé.
5. Passer en Édition : toucher le livre, vérifier qu’il reste visible avec un seul cadre. Glisser, puis **Tourner** et glisser horizontalement. Vérifier échelle, autres objets et stabilité en bougeant le téléphone.
6. Désélectionner dans le vide. Ajouter deux modèles par bouton. Sélectionner l’un puis supprimer par bouton ; vérifier que l’autre reste intact et qu’un troisième ajout est possible.
7. Enregistrer l’agencement relatif, quitter et redémarrer. Vérifier nettoyage des sons/gestes, retour de l’interface, cercle, nécessité d’un nouveau placement et restauration de l’agencement après ce placement.
8. Tester **Recaler la scène** puis **Réinitialiser la composition**, les interruptions (annulation du geste, téléphone mis en arrière-plan), et une nouvelle sélection/édition/pose après reprise.
9. Quitter AR et ouvrir le 360°. Vérifier le panorama illustré, son statut, le glissement du regard, les flèches clavier, le recentrage et les cinq fiches accessibles. Couper le réseau après chargement et vérifier que les ressources locales restent disponibles. Vérifier aussi le message d’erreur si l’image ne peut pas être chargée.

Restent à confirmer sur appareil réel : caméra visible et permissions, disponibilité de DOM Overlay, déverrouillage sonore à l’entrée AR, qualité d’écoute, rayons alignés avec l’image caméra, détection des surfaces, absence de saut et de dérive après édition/recalage, annulations tactiles, lisibilité dehors, performances et comportement du moteur vocal. Les quatre photos de Corte ont des crédits documentés ; les enregistrements historiques restent à fournir. Le panorama est une illustration et la musique une composition originale.
