# StackPanel — Paramètres du profil

Dans Profil, les paramètres sont organisés en trois pages :
- **Identité et photo** : pseudo, avatars, importation et recadrage de photo, enregistrement.
- **Compte et connexion** : informations de stockage, connexion et déconnexion.
- **Mon parcours** : progression et accès au parcours.

Ouvrir une ligne pour accéder à sa page. Le bouton Retour, Échap ou un glissement vers la droite sur l’en-tête ramène au menu. Le focus revient à la ligne d’origine. Les formulaires restent dans le DOM pour conserver les brouillons. La première création du profil utilise toujours le formulaire complet.

## Utilisation

```js
import { createStackPanel } from './stack-panel.js?v=1';

const panel = createStackPanel(document.getElementById('profileSettings'), {
  title: 'Paramètres',
  pages: [
    { id: 'identity', title: 'Identité et photo', content: editorElement },
    { id: 'account', title: 'Compte et connexion', content: accountElement },
    { id: 'progress', title: 'Mon parcours', content: progressElement },
  ],
  canNavigate: () => !busy,
});
panel.setDetail('identity', 'Lisandra');
panel.open('identity');
panel.reset();
```

Chaque `content` est un élément DOM existant, déplacé sans perdre ses événements.
`reset()` revient au menu sans déplacer le focus. `destroy()` retire les écouteurs.
Les styles sont dans `memoria/shell.css`.

## Source

Commande demandée : `npx shadcn@latest add https://kokonutui.com/r/stack-panel.json`.
Le CLI nécessite une configuration React absente du projet. Le code original MIT de @dorianbaffier est conservé dans `components/kokonutui/stack-panel.tsx` ; le site utilise l’adaptation native `memoria/stack-panel.js`.

Cette adaptation conserve les pages, les transitions, le retour et la gestion du focus, avec les fonctions réelles du profil. Elle ne reproduit pas le déplacement du titre ni la physique du composant React. Aucun réglage fictif de facturation, thème ou notification n’est ajouté.

Source : https://kokonutui.com/r/stack-panel.json
