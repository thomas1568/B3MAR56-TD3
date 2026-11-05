# Carte et itinéraire à pied

## Deux services distincts

- **Affichage** : Leaflet **1.9.4**, distribué localement dans `vendor/leaflet/`, licence BSD-2-Clause conservée. [Documentation stable](https://leafletjs.com/reference-1.9.4.html).
- **Fond** : tuiles standard OpenStreetMap, chargées à l’ouverture du parcours. Attribution visible et cliquable. Pas de téléchargement massif, préchargement ni cache hors ligne des tuiles. [Politique d’utilisation](https://operations.osmfoundation.org/policies/tiles/).
- **Calcul** : API publique de la Géoplateforme IGN, ressource **bdtopo-valhalla**, profil **pedestrian**, optimisation **shortest**, géométrie GeoJSON, distances en mètres et temps en secondes. [Documentation IGN](https://cartes.gouv.fr/aide/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme/calcul-itineraire/).

La documentation présente aussi OSRM, mais la ressource `bdtopo-osrm` n’était pas
disponible dans les capacités réellement retournées lors de cette intégration.
Valhalla a été vérifié sur un trajet IUT → Palazzu : 1 236,88 m, 1 114,192 secondes
estimées et 125 points de géométrie, jeu de données daté du 4 novembre 2026.
Cette mesure provient du départ de test 42.297383, 9.154338, antérieur au déplacement
du marqueur IUT demandé ensuite. Ce résultat n’est pas injecté dans l’application. Il est seulement archivé dans
`tests/fixtures/ign-corte-walk.json` pour les tests reproductibles.

## Configuration

`memoria/config.js` contient `MAP_CONFIG` : `tilesURL`, `routingURL`,
`routingResource`. Aucun compte, token ni secret n’est requis par ces services
publics. Les URLs utilisent HTTPS ; les appels piétons portent explicitement le
profil piéton. Si un autre fournisseur exige un secret, il faudra un serveur
intermédiaire : ne jamais l’ajouter à ce JavaScript public.

La documentation IGN annonce au maximum 5 requêtes par seconde et par IP ;
la réponse vérifiée expose une limite de 1 requête par seconde. L’application impose
au moins une seconde entre deux demandes, annule la précédente, mémorise un
résultat identique pendant cinq minutes et arrête une requête après vingt secondes.
Ce garde-fou est propre à chaque navigateur ; il ne remplace pas un quota global.
Les services publics sont externes et peuvent devenir indisponibles. Pour un
trafic important, prévoir un fond et un contrat de service adaptés.

## Départ et suivi

L’utilisateur choisit un lieu connu, des coordonnées WGS84 (latitude et longitude),
un point sur la carte, ou sa position après une action explicite et l’autorisation
du navigateur. La position de départ est envoyée à l’IGN pour le calcul ; elle n’est
ni stockée dans le compte ni enregistrée localement. Le suivi compare les positions
au tracé en mémoire. Il ne recalcule pas à chaque variation GPS. Un écart au tracé
propose un recalcul manuel. Les mesures trop imprécises ne font pas avancer la jauge.
L’utilisateur peut arrêter le suivi ou effacer le trajet. Le suivi est arrêté
lorsque la page passe en arrière-plan ou est fermée ; il faut le relancer au retour.

Les durées sont des estimations du service, pas des temps de marche garantis.
Le graphe peut rabattre le départ ou l’arrivée sur une voie voisine. Un décalage
supérieur à 200 m est refusé ; l’accès final est toujours à vérifier sur place.
La progression est une estimation géométrique sur le tracé, sans promesse de
précision GPS, d’accessibilité PMR ou de prise en compte des fermetures temporaires.

## Erreurs et données manquantes

Un fond indisponible déclenche le plan local OpenStreetMap existant ; les lieux
restent accessibles dans la liste. Ce plan local ne simule pas le service de calcul.
Un refus GPS propose un départ manuel. Un lien vers un lieu inconnu réaffiche
la liste et un message explicite ; aucun ancien trajet n’est conservé pour ce lien. Une réponse non piétonne, malformée ou sans
géométrie valide, un trajet absent et une erreur réseau restent des erreurs visibles.
Aucun segment droit n’est présenté comme un trajet praticable.

À la demande du contributeur, le point `42.297500, 9.154278` est désormais l’unique
marqueur de l’IUT de Corse. L’ancien marqueur voisin a été supprimé. Le lien historique
`#parcours?lieu=fixed-gps` ouvre la fiche IUT. La position de l’utilisateur reste
indépendante et n’apparaît qu’après autorisation.
