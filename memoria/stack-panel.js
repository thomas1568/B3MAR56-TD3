/**
 * Native adaptation of Kokonut UI StackPanel, @dorianbaffier (MIT).
 * https://kokonutui.com/r/stack-panel.json
 * Keeps existing DOM forms and event handlers alive across panel pages.
 */
export function createStackPanel(root, { title = 'Paramètres', pages, canNavigate = () => true }) {
  root.classList.add('settings-stack');
  root.dataset.noSwipe = '';
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', title);
  const header = document.createElement('header');
  header.className = 'settings-stack-header';
  header.innerHTML = '<button type="button" class="settings-stack-back" aria-label="Retour aux paramètres" hidden><svg class="icon" aria-hidden="true"><use href="#icon-arrow"/></svg><span>Retour</span></button><h2 tabindex="-1"></h2>';
  const heading = header.querySelector('h2'), back = header.querySelector('button');
  back.id = root.id + 'Back';
  const body = document.createElement('div');
  body.className = 'settings-stack-body';
  const menu = document.createElement('div');
  menu.className = 'settings-stack-menu';
  const pageNodes = new Map(), rows = new Map();
  for (const page of pages) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = root.id + '-' + page.id;
    button.className = 'settings-stack-row';
    button.setAttribute('aria-controls', root.id + '-page-' + page.id);
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<span class="settings-stack-label"></span><span class="settings-stack-detail"></span><svg class="icon" aria-hidden="true"><use href="#icon-arrow"/></svg>';
    button.querySelector('.settings-stack-label').textContent = page.title;
    button.querySelector('.settings-stack-detail').textContent = page.detail || '';
    menu.append(button); rows.set(page.id, button);
    const section = document.createElement('div');
    section.id = root.id + '-page-' + page.id;
    section.className = 'settings-stack-page'; section.hidden = true; section.inert = true;
    section.append(page.content); pageNodes.set(page.id, section);
  }
  body.append(menu, ...pageNodes.values());
  root.replaceChildren(header, body);
  let current = null, animation = null, gesture = null;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  const listen = (node, name, handler, options = {}) => node.addEventListener(name, handler, { ...options, signal: controller.signal });
  function show(id, { focus = true, animate = true, force = false } = {}) {
    if ((!force && !canNavigate()) || (id !== null && !pageNodes.has(id)) || id === current) return;
    const previous = current;
    animation?.cancel();
    current = id; root.dataset.stackPage = id || 'settings';
    menu.hidden = id !== null; menu.inert = id !== null;
    for (const [key, section] of pageNodes) {
      section.hidden = key !== id; section.inert = key !== id;
      rows.get(key).setAttribute('aria-expanded', String(key === id));
    }
    heading.textContent = pages.find(page => page.id === id)?.title || title;
    back.hidden = id === null;
    const active = id === null ? menu : pageNodes.get(id);
    if (animate && !reduced.matches && active.animate) {
      animation = active.animate([
        { opacity: .3, transform: 'translateX(' + (id === null ? '-24px' : '40px') + ')' },
        { opacity: 1, transform: 'translateX(0)' }
      ], { duration: 280, easing: 'cubic-bezier(.23,1,.32,1)' });
      animation.id = 'memoria-settings';
    }
    if (focus) {
      (id === null ? rows.get(previous) || heading : heading).focus({ preventScroll: true });
      header.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }
  }
  for (const [id, button] of rows) listen(button, 'click', () => show(id));
  listen(back, 'click', () => show(null));
  listen(root, 'keydown', event => {
    if (event.key === 'Escape' && current !== null) { event.preventDefault(); event.stopPropagation(); show(null); }
  });
  // Swipe only on the header: editing fields and cropping keep their own gestures.
  listen(header, 'pointerdown', event => {
    if (current === null || event.isPrimary === false || event.button > 0 || event.target.closest('button')) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
    header.setPointerCapture(event.pointerId);
  });
  listen(header, 'pointerup', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    gesture = null;
    if (header.hasPointerCapture(event.pointerId)) header.releasePointerCapture(event.pointerId);
    if (dx > 60 && dx > Math.abs(dy) * 1.5) show(null);
  });
  listen(header, 'pointercancel', () => { gesture = null; });
  listen(reduced, 'change', () => { if (reduced.matches) animation?.cancel(); });
  heading.textContent = title; root.dataset.stackPage = 'settings';
  return {
    open: id => show(id),
    reset: () => show(null, { focus: false, animate: false, force: true }),
    setDetail(id, text) { const row = rows.get(id); if (row) row.querySelector('.settings-stack-detail').textContent = text; },
    destroy() { controller.abort(); animation?.cancel(); }
  };
}
