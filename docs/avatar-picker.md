# AvatarPicker — Image du profil

Dans **Profil → Identité et photo**, ainsi que lors de la création du profil :
- Un grand aperçu circulaire affiche l’avatar ou la photo actuelle.
- Cliquer sur un avatar de Corte pour le choisir ; **Au hasard** en choisit un différent.
- **Importer ma photo** ouvre le sélecteur de fichiers puis le recadrage existant.
- **Revenir à un avatar** retire la photo selon le fonctionnement existant.
- Dans la liste, les flèches, Début et Fin déplacent le focus ; Entrée ou Espace valide le choix.

L’image est enregistrée immédiatement pour un profil existant. Pendant la création initiale, elle reste un brouillon jusqu’à la validation du formulaire. Le pseudo conserve son bouton d’enregistrement.

## Utilisation

```js
import { createAvatarPicker } from './avatar-picker.js?v=1';

// Le formulaire contient les éléments existants : profilePreview,
// avatarChoices, .selected-avatar, fieldset et .photo-import.
const picker = createAvatarPicker(document.getElementById('profileForm'));

// Après rendu des avatars et mise à jour de leurs aria-pressed :
picker.update(draft);
// Nettoyage éventuel :
picker.destroy();
```

Le composant déplace les contrôles existants sans recréer leurs événements. Le bouton aléatoire active un bouton d’avatar existant. Les styles sont dans `memoria/shell.css`.

## Source Kokonut UI

Commande demandée : `npx shadcn@latest add https://kokonutui.com/r/avatar-picker.json`.
Le CLI demande une configuration React absente de ce site natif.
La source originale MIT de @dorianbaffier est conservée dans `components/kokonutui/avatar-picker.tsx`.
Le site utilise l’adaptation native `memoria/avatar-picker.js`.

Cette version reprend le cadran circulaire, le grand aperçu animé, les choix compacts et le tirage aléatoire, avec les avatars de Corte et la photo personnelle. La génération de visages, le morphing et la rotation physique du composant React ne sont pas repris. Les animations respectent la préférence de mouvement réduit.

Source : https://kokonutui.com/r/avatar-picker.json
