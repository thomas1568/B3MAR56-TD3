# Typewriter — Titre de l’Accueil

Le titre **Corte. La mémoire à chaque pas.** est écrit une seule fois, sur ses trois lignes.
L’animation dure environ deux secondes, s’arrête hors de la page visible et ne redémarre pas lors d’un retour à l’Accueil.
L’espace du titre complet est réservé pour éviter les déplacements de contenu.
Les lecteurs d’écran disposent du texte complet ; le mode de réduction des animations affiche immédiatement le titre fixe.

## Utilisation

```js
import { createTypewriter } from './type-writer.js?v=1';

const effect = createTypewriter(document.getElementById('homeTitle'), {
  text: 'Corte.\nLa mémoire\nà chaque pas.',
  typingSpeed: 55,
  startDelay: 250,
  canRun: () => !app.hidden && !app.inert && !homePage.hidden,
  watch: [app, homePage],
});
effect.finish(); // Afficher immédiatement tout le texte.
effect.destroy(); // Restaurer le titre original et retirer les écouteurs.
```

Les styles sont dans `memoria/shell.css`. Seul le grand titre de l’Accueil est concerné.

Commande demandée : `npx shadcn@latest add https://kokonutui.com/r/type-writer.json`.
Le projet étant en JavaScript natif, la source React/Motion est conservée dans
`components/kokonutui/type-writer.tsx` et une adaptation native est utilisée.
Les boucles, effacements et fautes de frappe simulées du composant original sont volontairement omis.

Source MIT, @dorianbaffier : https://kokonutui.com/r/type-writer.json
