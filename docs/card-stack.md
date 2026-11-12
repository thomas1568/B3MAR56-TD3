# CardStack — Les lieux, autrement

La pile est affichée uniquement sur l’Accueil. Explorer conserve sa grille et ses filtres.
Glissez horizontalement sur la photo, utilisez les boutons SVG précédent/suivant ou les flèches gauche/droite au clavier lorsque le focus est dans la pile.
Les actions et les crédits photo sont conservés. Les cartes arrière sont inertes et masquées aux lecteurs d’écran. Le compteur annonce les changements et la réduction des animations est respectée.

## Utilisation

```js
import { createCardStack } from './card-stack.js?v=1';

const stack = createCardStack(
  document.getElementById('homePlaces'),
  places.map(placeCard),
  { onChange: (article, index) => console.log(article.dataset.place, index) }
);
stack.next();
stack.previous();
stack.getIndex();
```

Les articles DOM créés par `placeCard` conservent leurs photos, crédits et gestionnaires de clic.
Les styles sont dans `memoria/shell.css` et ciblent exclusivement `#homePlaces`.

## Source Kokonut UI

Commande demandée : `npx shadcn@latest add https://kokonutui.com/r/card-stack.json`.
Le CLI demande une configuration React absente de ce site JavaScript natif.
Le composant original React/Motion, sous licence MIT (@dorianbaffier), est conservé dans
`components/kokonutui/card-stack.tsx` comme référence et n’est pas chargé par le site.

L’adaptation native `memoria/card-stack.js` reprend la pile inclinée, le défilement circulaire et le glissement. Les détails restent sur les cartes ; la modale commerciale et la simulation physique du composant original ne sont pas reprises.

Source : https://kokonutui.com/r/card-stack.json
