/**
 * Native adaptation of Kokonut UI AvatarPicker, @dorianbaffier (MIT).
 * https://kokonutui.com/r/avatar-picker.json
 * Uses the project's persisted avatars and existing photo/crop workflow.
 */
export function createAvatarPicker(form) {
  const preview = form.querySelector('#profilePreview');
  const selection = form.querySelector('.selected-avatar');
  const fieldset = form.querySelector('fieldset');
  const choices = form.querySelector('#avatarChoices');
  const upload = form.querySelector('.photo-import');
  const root = document.createElement('section');
  root.className = 'profile-avatar-picker'; root.dataset.noSwipe = '';
  root.setAttribute('aria-label', 'Choisir votre image de profil');
  const intro = document.createElement('div');
  intro.className = 'avatar-picker-intro';
  intro.innerHTML = '<h2>Votre image, votre signature.</h2><p>Choisissez un avatar ou importez votre photo.</p>';
  const bezel = document.createElement('div');
  bezel.className = 'avatar-picker-bezel';
  bezel.setAttribute('aria-hidden', 'true');
  const ns = 'http://www.w3.org/2000/svg';
  const dial = document.createElementNS(ns, 'svg');
  dial.setAttribute('viewBox', '0 0 180 180');
  for (let i = 0; i < 48; i++) {
    const angle = i * Math.PI / 24, radius = i % 4 === 0 ? 76 : 80;
    const line = document.createElementNS(ns, 'line');
    for (const [key, value] of Object.entries({
      x1: 90 + Math.sin(angle) * radius, y1: 90 - Math.cos(angle) * radius,
      x2: 90 + Math.sin(angle) * 85, y2: 90 - Math.cos(angle) * 85,
    })) line.setAttribute(key, String(value));
    dial.append(line);
  }
  bezel.append(dial);
  const portrait = document.createElement('div');
  portrait.className = 'avatar-picker-portrait';
  portrait.append(bezel, preview);
  const name = document.createElement('p');
  name.className = 'avatar-picker-name';
  const shuffle = document.createElement('button');
  shuffle.id = 'shuffleAvatar'; shuffle.type = 'button'; shuffle.className = 'avatar-picker-shuffle';
  shuffle.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="8" cy="8" r="1"/><circle cx="16" cy="8" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/></svg><span>Au hasard</span>';
  shuffle.setAttribute('aria-label', 'Choisir un autre avatar au hasard');
  const live = document.createElement('p'); live.className = 'sr-only'; live.setAttribute('role', 'status');
  selection.prepend(portrait, name);
  fieldset.append(shuffle);
  root.append(intro, selection, fieldset, upload, live);
  form.prepend(root);
  choices.setAttribute('role', 'toolbar');
  choices.setAttribute('aria-label', 'Avatars de Corte');
  preview.setAttribute('role', 'img');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  const listen = (node, type, handler) => node.addEventListener(type, handler, { signal: controller.signal });
  let previousKey = null, animation = null;
  const buttons = () => [...choices.querySelectorAll('button')];
  function setTabStop(button) { for (const option of buttons()) option.tabIndex = option === button ? 0 : -1; }
  listen(choices, 'focusin', event => {
    const option = event.target.closest('button'); if (option) setTabStop(option);
  });
  listen(choices, 'keydown', event => {
    const options = buttons(), current = options.indexOf(event.target.closest('button'));
    if (current < 0) return;
    const keys = { ArrowRight: current + 1, ArrowDown: current + 1, ArrowLeft: current - 1, ArrowUp: current - 1, Home: 0, End: options.length - 1 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const option = options[(keys[event.key] + options.length) % options.length];
    setTabStop(option); option.focus({ preventScroll: true });
  });
  listen(shuffle, 'click', () => {
    const options = buttons().filter(option => !option.disabled && option.getAttribute('aria-pressed') !== 'true');
    options[Math.floor(Math.random() * options.length)]?.click();
  });
  listen(reduced, 'change', () => { if (reduced.matches) animation?.cancel(); });
  return {
    update(profile) {
      const selected = buttons().find(button => button.getAttribute('aria-pressed') === 'true');
      const label = profile.photoURL ? 'Votre photo personnelle' : selected?.querySelector('.avatar-name')?.textContent || 'La citadelle';
      name.textContent = profile.pseudo.trim() || 'Votre profil';
      preview.setAttribute('aria-label', label);
      if (!choices.contains(document.activeElement)) setTabStop(selected || buttons()[0]);
      const key = profile.photoURL || profile.avatar;
      if (previousKey !== key) {
        live.textContent = label;
        animation?.cancel();
        if (previousKey !== null && !reduced.matches && preview.animate) {
          animation = preview.animate([
            { opacity: .4, transform: 'scale(.85) rotateY(-25deg)' },
            { opacity: 1, transform: 'scale(1) rotateY(0)' }
          ], { duration: 260, easing: 'cubic-bezier(.23,1,.32,1)' });
          animation.id = 'memoria-avatar-picker';
        }
        previousKey = key;
      }
    },
    destroy() { controller.abort(); animation?.cancel(); }
  };
}
