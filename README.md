# Memoria Corti — première étape IUT

Application statique ES modules : Three.js r180, WebXR (`immersive-ar`), hit-test, DOM Overlay, GLTFLoader et OrbitControls déjà présents. Aucune dépendance ajoutée. Le chargement de jQuery a été retiré ; les commandes utilisent les événements DOM natifs.

## Utilisation

Servir ce dossier par HTTP pour consulter les fiches et le 360°. Sur téléphone, utiliser une origine HTTPS et un navigateur/appareil prenant en charge WebXR AR, hit-test et DOM Overlay. L’ouverture directe de `index.html` en `file://` ne convient pas aux modules ni à WebXR.

1. **Explorer l’étape IUT**, puis **Démarrer l’expérience AR**.
2. Autoriser la caméra, scanner doucement une surface plane et attendre le cercle blanc. **Placer la scène** installe le repère commun ; **Recaler la scène** repositionne ce repère sans perdre l’agencement interne.
3. En **Visite**, toucher un repère ou un élément ouvre sa fiche. Un glissement ne transforme rien. Les boutons de repères suivent leur projection 3D et des traits les relient au point réel lorsqu’ils sont espacés pour éviter les chevauchements.
4. En **Édition**, toucher un élément le sélectionne (cadre bleu), glisser sur son maillage le déplace. **Tourner** active la rotation verticale par glissement horizontal ; **Déplacer** revient au déplacement. L’échelle reste inchangée. Toucher le vide désélectionne.
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
- `memoria/panorama.js` : sphère 360°, points interactifs, rotation du regard et solution de consultation sans AR.
- `memoria/hotspots.js` : espacement des boutons tactiles, sans déplacer les points 3D.
- `memoria/layout.js` : schéma, validation et sauvegarde des transformations relatives.
- `jsm/webxr/ARButton.js` : démarrage explicite, remontée des refus et maintien de la racine d’interface externe visible après la session.

Les cinq POI sont : IUT aujourd’hui, naissance de l’université, Pasquale Paoli, réouverture, Corte universitaire. Le livre et le document ouvrent la même fiche de 1765. Les questions de transmission, du choix de Corte et de la continuité actuelle figurent dans les fiches. La prochaine étape, Palazzu Naziunale, est annoncée comme **à préparer**.

## Contenus vérifiés et ressources à fournir

Les repères 1765/1981 ont été vérifiés auprès de l’[Université de Corse](https://www.universita.corsica/fr/universita/historique/), et 1983/campus Grimaldi auprès de l’[IUT de Corse](https://iut.universita.corsica/). Le Palazzu Naziunale de l’université historique est explicitement distingué du campus actuel. Les sources sont consultables dans chaque fiche.

Aucune photographie, archive, bande sonore ou image panoramique n’était présente dans le projet. Les supports sont des évocations : aucun visage de Paoli, manuscrit, témoignage ou façade historique n’a été inventé. Les quatre GLB existants restent identifiés comme modèles d’essai, sans attribution historique ; leur provenance et leurs droits restent à documenter.

À fournir avec identification, date, crédit et conditions de réutilisation :

- Photographie actuelle de l’IUT, document lié à 1765, portrait identifié de Paoli, archive de 1981, carte géographique vérifiée.
- Photographie équirectangulaire 360° du lieu, puis calage des angles des POI. L’état actuel est **Panorama à fournir**, avec un espace neutre et cinq fiches accessibles, y compris si WebGL échoue.
- Enregistrements de l’accueil (texte prévu pour 15–20 s), du récit (environ une minute) et des cinq points ; les durées réelles doivent être mesurées après enregistrement.
- Ambiances pages/écriture/murmures et campus ; musique d’entrée et de fin seulement avec réutilisation autorisée.
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
2. Démarrer l’AR, autoriser la caméra, scanner une surface. Vérifier le cercle blanc puis placer la scène. Sans surface, vérifier l’instruction et les boutons de placement désactivés.
3. En Visite, ouvrir les cinq fiches par leur repère puis par un sous-mesh (livre/document/support). Vérifier fermeture, défilement, sources, transcription et état de média manquant. Un glissement ne doit pas modifier la scène.
4. Ouvrir **Récits** et tester accueil/récit, pause/reprise, volume, changement de récit et transcription avec une voix disponible. Vérifier le message sans voix/enregistrement ; une ambiance manquante doit rester silencieuse. Tester l’atténuation après fourniture d’un fichier autorisé.
5. Passer en Édition : toucher le livre, vérifier qu’il reste visible avec un seul cadre. Glisser, puis **Tourner** et glisser horizontalement. Vérifier échelle, autres objets et stabilité en bougeant le téléphone.
6. Désélectionner dans le vide. Ajouter deux modèles par bouton. Sélectionner l’un puis supprimer par bouton ; vérifier que l’autre reste intact et qu’un troisième ajout est possible.
7. Enregistrer l’agencement relatif, quitter et redémarrer. Vérifier nettoyage des sons/gestes, retour de l’interface, cercle, nécessité d’un nouveau placement et restauration de l’agencement après ce placement.
8. Tester **Recaler la scène** puis **Réinitialiser la composition**, les interruptions (annulation du geste, téléphone mis en arrière-plan), et une nouvelle sélection/édition/pose après reprise.
9. Quitter AR et ouvrir le 360°. Vérifier **Panorama à fournir**, glissement du regard et cinq fiches accessibles. Après fourniture de médias autorisés, vérifier image/zoom, calage photographique et éventuelle comparaison avant/après.

Restent à confirmer sur appareil réel : permissions, disponibilité de DOM Overlay, rayons alignés avec l’image caméra, détection des surfaces, absence de saut et de dérive après édition/recalage, annulations tactiles, lisibilité dehors, performances et comportement du moteur vocal. Les médias réels, leurs durées, crédits et droits n’ont pas été validés puisqu’ils ne sont pas fournis.
