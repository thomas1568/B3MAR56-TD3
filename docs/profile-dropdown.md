# Menu du profil

Le rond en haut à droite ouvre le menu : identité, **Mon profil**, **Mon parcours**, connexion ou déconnexion. Cliquez ailleurs ou appuyez sur Échap pour fermer. Les flèches haut/bas, Début et Fin déplacent le focus ; Entrée active une action.

Le projet est en JavaScript natif, sans React ni Tailwind. La commande demandée :

```sh
npx shadcn@latest add https://kokonutui.com/r/profile-dropdown.json
```

propose de créer un projet React au lieu d'ajouter directement le composant. Le fichier original est conservé dans `components/kokonutui/profile-dropdown.tsx` comme référence ; il n'est pas chargé par le site. L'intégration fonctionnelle est une adaptation native de son menu, dans `memoria/profile-dropdown.js`, avec les couleurs du site et les actions existantes. Les options de démonstration (facturation, thèmes, comptes multiples et statuts) ne sont pas exposées. La déconnexion utilise un clic standard.

## Utilisation dans ce projet

```js
import { createProfileDropdown } from './profile-dropdown.js?v=2';

const menu = createProfileDropdown(document.getElementById('headerProfile'), {
  onProfile: () => showPage('profile'),
  onRoute: () => showPage('route'),
  onConnect: () => document.getElementById('connectFromProfile').click(),
  onSignOut: () => document.getElementById('logoutButton').click(),
});
menu.update(account.getState());
// À chaque mise à jour du compte :
account.subscribe(state => menu.update(state));
```

Le bouton doit être dans `#appView`. Charger aussi `memoria/shell.css`. Une seule instance est prévue par page. `menu.close()` ferme le panneau et `menu.destroy()` retire les écouteurs.

Source originale : [Kokonut UI ProfileDropdown](https://kokonutui.com/r/profile-dropdown.json), @dorianbaffier, licence MIT.
