# CarouselCards dans Explorer

Le carrousel remplace uniquement la grille de lieux dans Explorer. La pile de cartes de l’Accueil reste indépendante.

Glissez horizontalement sur mobile ou faites glisser une photo à la souris. Les boutons SVG précédent/suivant centrent la carte voisine. Au clavier, placez le focus sur le carrousel puis utilisez les flèches gauche/droite, Début ou Fin. La navigation s’arrête aux extrémités.

La recherche et les filtres reconstruisent le carrousel : un seul résultat masque les commandes ; aucun résultat affiche le message existant. Les actions, disponibilités et crédits photo sont conservés.

## Utilisation native

```js
import { createCarouselCards } from './carousel-cards.js?v=1';

const carousel = createCarouselCards(document.getElementById('explorePlaces'), {
  onChange: (article, index) => console.log(article.dataset.place, index),
});
carousel.setCards(places.map(placeCard));
carousel.goTo(1);
carousel.getIndex();

// Après une recherche :
carousel.setCards(matches.map(placeCard));
// Pour retirer les écouteurs et l'observateur :
carousel.destroy();
```

Les articles sont des éléments DOM avec leurs actions existantes. Les styles dans `memoria/shell.css` ciblent seulement `#explorePlaces`.

## Origine

Commande demandée : `npx shadcn@latest add https://kokonutui.com/r/carousel-cards.json`.
Le CLI demande une configuration React absente de ce projet natif. Le fichier original, sous licence MIT (@dorianbaffier), est conservé dans `components/kokonutui/carousel-cards.tsx` comme référence, sans être chargé par le site.

L’adaptation native reprend le rail centré, le glissement à la souris avec projection du mouvement, le défilement tactile et la profondeur visuelle. Elle utilise le défilement et le calage natifs du navigateur au lieu de la simulation de ressort originale. Les tarifs, notes et favoris de démonstration ne sont pas ajoutés. La réduction des animations désactive le défilement animé et la profondeur ; les navigateurs sans animations liées au défilement gardent des cartes plates.

Source : https://kokonutui.com/r/carousel-cards.json
