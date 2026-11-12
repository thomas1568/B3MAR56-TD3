/**
 * Native adaptation of Kokonut UI ProfileDropdown (MIT), @dorianbaffier.
 * Source: https://kokonutui.com/r/profile-dropdown.json
 * Original React component: ../components/kokonutui/profile-dropdown.tsx
 */
import { renderAvatar } from './avatars.js?v=33';

export function createProfileDropdown(trigger, { onProfile, onRoute, onConnect, onSignOut }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'profile-dropdown';
  trigger.replaceWith(wrapper);
  wrapper.append(trigger);
  trigger.removeAttribute('data-page');
  trigger.setAttribute('aria-label', 'Ouvrir le menu du profil');
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', 'profileDropdownMenu');
  const panel = document.createElement('div');
  panel.id = 'profileDropdownMenu';
  panel.className = 'profile-dropdown-panel';
  panel.hidden = true;
  panel.innerHTML = `<div class="profile-dropdown-identity"><span class="avatar" data-profile-avatar></span><div><strong class="profile-dropdown-name"></strong><span class="profile-dropdown-status"></span></div></div><div role="menu" aria-label="Mon compte"><button id="profileMenuProfile" role="menuitem" type="button" tabindex="-1">Mon profil <span aria-hidden="true">↗</span></button><button id="profileMenuRoute" role="menuitem" type="button" tabindex="-1">Mon parcours <span aria-hidden="true">→</span></button><button id="profileMenuConnect" role="menuitem" type="button" tabindex="-1">Se connecter</button><hr role="separator"><button id="profileMenuLogout" role="menuitem" type="button" tabindex="-1" class="profile-dropdown-logout"></button></div>`;
  wrapper.append(panel);
  const items = () => [...panel.querySelectorAll('[role="menuitem"]')].filter(item => !item.hidden && !item.disabled);
  function close(restoreFocus = false) {
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger.focus({ preventScroll: true });
  }
  function open(last = false) {
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    (last ? items().at(-1) : items()[0])?.focus({ preventScroll: true });
  }
  const controller = new AbortController();
  const listen = (node, type, fn, options = {}) => node.addEventListener(type, fn, { ...options, signal: controller.signal });
  listen(trigger, 'click', () => panel.hidden ? open() : close(true));
  listen(trigger, 'keydown', event => {
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault(); open(event.key === 'ArrowUp');
    }
  });
  listen(panel, 'keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
    if (event.key === 'Tab') { close(true); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const buttons = items(), index = buttons.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  });
  listen(document, 'pointerdown', event => { if (!wrapper.contains(event.target)) close(); });
  listen(document, 'focusin', event => { if (!wrapper.contains(event.target)) close(); });
  listen(document.getElementById('appView'), 'scroll', () => close(), { passive: true });
  for (const [id, callback] of [['profileMenuProfile', onProfile], ['profileMenuRoute', onRoute], ['profileMenuConnect', onConnect], ['profileMenuLogout', onSignOut]]) {
    listen(panel.querySelector('#' + id), 'click', () => { close(true); callback(); });
  }
  return {
    close,
    update(state, preview = state.profile) {
      renderAvatar(panel.querySelector('.avatar'), preview);
      panel.querySelector('.profile-dropdown-name').textContent = preview.pseudo || 'Mon profil';
      panel.querySelector('.profile-dropdown-status').textContent = state.connected ? 'Compte connecté' : 'Invité · sur cet appareil';
      panel.querySelector('#profileMenuConnect').hidden = state.connected;
      panel.querySelector('#profileMenuLogout').textContent = state.connected ? 'Se déconnecter' : 'Quitter le mode invité';
    },
    destroy() { controller.abort(); wrapper.replaceWith(trigger); }
  };
}
