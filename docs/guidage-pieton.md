# Guidage piéton dans Parcours

## Utilisation

Dans Parcours, choisir « Me guider vers le prochain point », vérifier le lieu puis
« Démarrer le guidage ». Le suivi GPS continu commence uniquement après cette
action et l’autorisation du navigateur. Le départ précis est envoyé à l’IGN pour
calculer un trajet piéton. Aucun historique de positions n’est enregistré.

Le panneau affiche le point visé, la précision reçue, le temps et la distance
restants. Recentrer réactive le suivi de la carte ; un déplacement manuel ou Vue
d’ensemble le désactive. Arrêter libère le suivi GPS et annule les calculs.
Quitter Parcours ou passer en arrière-plan met le guidage en pause. Au retour,
Reprendre le guidage demande une mesure récente.

L’IUT est actuellement la seule étape physique disponible. Ses cinq contenus AR
ne possèdent pas de coordonnées propres : ils ne deviennent pas des destinations
GPS. Lorsque tous ces contenus ont été consultés, le prochain lieu, Palazzu, est
signalé en préparation ; l’utilisateur peut choisir de rejoindre à nouveau l’IUT.
Le planificateur manuel conserve la possibilité de préparer un trajet vers
Palazzu, avec cette indisponibilité indiquée et sans bouton d’ouverture d’étape.

## Progression

`memoria/guidance.js` calcule les longueurs cumulées du chemin reçu de l’IGN.
Chaque mesure précise et récente est projetée sur les segments voisins de la
dernière progression acceptée. Une fenêtre de déplacement plausible et une
pénalité de distance parcourue évitent de sélectionner une rue parallèle ou un
segment beaucoup plus loin au croisement. Les mesures incohérentes sont ignorées.
Le retour en arrière doit être confirmé par plusieurs mesures.

La coupure est interpolée au milieu du segment : gris avant la coupure, vert
après, sur un contour ivoire. Le gris représente l’avancement estimé sur le
chemin conseillé, pas un historique du chemin réellement marché.

La fraction géométrique restante multiplie la distance et la durée totales de
l’IGN. Il s’agit d’une estimation moyenne, sans vitesse GPS instantanée ; en
absence de durée exploitable, le moteur utilise 1,2 m/s. Les valeurs restent
visibles mais ne sont pas annoncées à chaque mesure par le lecteur d’écran.
Le marqueur est interpolé pendant 350 ms entre deux positions reçues, sans
extrapolation, et respecte la réduction des mouvements.

Un écart durable propose Recalculer le trajet. Ce bouton utilise la dernière
mesure précise et récente, efface la géométrie précédente puis initialise une
nouvelle progression sur la réponse IGN. Une erreur reste visible et permet de
réessayer ; aucune ligne droite fictive n’est dessinée. Le GPS ne lance pas de
recalcul à chaque mesure.

L’arrivée exige plusieurs mesures proches et une faible distance restante.
Si le guidage commence déjà à proximité du point, deux mesures précises espacées
de trois secondes confirment cette proximité sans calculer un trajet de longueur nulle.
Elle arrête le suivi et propose « Ouvrir l’étape ». Elle ne modifie ni les visites
ni les récompenses : l’ouverture et la consultation restent des actions explicites.

## Paramètres ajustables

Constantes regroupées dans `GUIDANCE_CONFIG` de `memoria/guidance.js` :

| Paramètre | Valeur | Effet |
| --- | --- | --- |
| maxAccuracy / maxAge | 35 m / 15 s | Qualité minimale et fraîcheur |
| maxSpeed / maxStep | 3 m/s / 80 m | Fenêtre de déplacement plausible |
| jitter | 3 m | Filtre des petites variations |
| reverseDistance / reverseFixes | 10 m / 3 | Confirmation du retour en arrière |
| offRouteDistance / offRouteFixes / offRouteTime | 30 m / 3 / 6 s | Écart persistant |
| arrivalRadius / arrivalAccuracy | 25 m / 20 m | Proximité et précision d’arrivée |
| arrivalRemaining | 40 m | Distance géométrique restante maximale |
| arrivalFixes / arrivalTime | 2 / 3 s | Confirmation d’arrivée |
| interpolationMs | 350 ms | Animation du marqueur |
| recalculateCooldown | 10 s | Intervalle minimal de recalcul manuel |

Le routeur conserve aussi son quota local d’une requête par seconde, son cache
de cinq minutes et son délai maximal de vingt secondes. Modifier les seuils
demande une vérification sur le terrain, notamment dans les rues étroites.

## Vérification reproductible

```sh
node --test tests/guidance.mjs tests/routing.mjs tests/immersive-map.mjs
node tests/shell-browser.mjs
```

Les tests du moteur couvrent le départ, l’arrêt prolongé, la découpe dans un segment,
les positions anciennes/imprécises, les sauts, les croisements, les rues parallèles,
le retour en arrière, l’écart persistant, l’arrivée et le remplacement de géométrie.
Ils parcourent aussi par pas de 5 m les 125 coordonnées de la réponse IGN archivée.

Le test Chrome utilise de vrais composants Leaflet et des réponses HTTP/GPS
simulées sous `/B3MAR56-TD3/`. Il vérifie le suivi sans recalcul permanent, le
marqueur au-dessus du panneau, le déplacement manuel/recentrage, l’arrêt et la
reprise entre onglets, les callbacks tardifs, le refus GPS, les erreurs IGN,
le démarrage vers l’étape disponible et l’arrivée sans validation de visite.
Le trajet inverse utilisé pour cette dernière simulation est une fixture de
test, jamais un itinéraire injecté en production. Le même scénario contrôle les
autres onglets, l’audio, les profils, les fiches et la préparation AR, avec des
captures aux largeurs 320, 390, 768 et 1440 px.

## Contrôle restant sur iPhone réel

Les simulations Chrome ne remplacent pas une marche réelle. Vérifier dans Safari :
autorisation refusée puis accordée, localisation précise désactivée, dérive GPS
en rue étroite, arrêt et demi-tour, verrouillage/déverrouillage, changement
d’application, perte réseau, recalcul, portrait/paysage et tailles de texte.
Contrôler les zones de sécurité, les crédits, le lecteur audio et l’ouverture AR
sur le téléphone utilisé.

Safari peut suspendre la page et le GPS : aucun suivi continu en arrière-plan
ou écran verrouillé n’est promis. Le retour nécessite une reprise explicite et
une position récente. Le parcours conseillé ne garantit pas l’accessibilité ni
l’absence de fermeture sur place.

Références : [Geolocation watchPosition (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition),
[Leaflet 1.9.4](https://leafletjs.com/reference-1.9.4.html).
