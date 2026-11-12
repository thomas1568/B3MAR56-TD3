/** Native adaptation of Kokonut UI CardStack, @dorianbaffier (MIT).
 * Original: https://kokonutui.com/r/card-stack.json
 * React reference: components/kokonutui/card-stack.tsx
 */
export function createCardStack(root, cards, { onChange = () => {} } = {}) {
  root.classList.add('place-card-stack');
  root.dataset.noSwipe = '';
  root.setAttribute('role', 'region');
  root.setAttribute('aria-roledescription', 'carrousel');
  root.setAttribute('aria-label', 'Les lieux, autrement');
  const stage = document.createElement('div');
  stage.className = 'card-stack-stage';
  const controls = document.createElement('div');
  controls.className = 'card-stack-controls';
  const arrow = '<svg class="icon" aria-hidden="true" focusable="false"><use href="#icon-arrow"/></svg>';
  controls.innerHTML = `<button type="button" class="card-stack-prev" aria-label="Lieu précédent">${arrow}</button><p class="card-stack-count" role="status" aria-live="polite" aria-atomic="true"></p><button type="button" class="card-stack-next" aria-label="Lieu suivant">${arrow}</button>`;
  const hint = document.createElement('p');
  hint.className = 'card-stack-hint';
  hint.textContent = 'Faites glisser la photo pour changer de lieu.';
  stage.append(...cards);
  root.replaceChildren(stage, controls, hint);
  const previous = controls.querySelector('.card-stack-prev'), next = controls.querySelector('.card-stack-next');
  const counter = controls.querySelector('.card-stack-count');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  const listen = (node, name, handler, options = {}) => node.addEventListener(name, handler, { ...options, signal: controller.signal });
  let index = 0, gesture = null, animation = null, busy = false, destroyed = false;
  for (const card of cards) {
    card.classList.add('stack-card');
    card.setAttribute('role', 'group');
    card.setAttribute('aria-roledescription', 'diapositive');
    const image = card.querySelector('img');
    if (image) image.draggable = false;
  }
  function render() {
    cards.forEach((card, i) => {
      const depth = (i - index + cards.length) % cards.length;
      card.style.setProperty('--stack-depth', Math.min(depth, 3));
      card.style.setProperty('--stack-angle', depth ? (depth % 2 ? -2 : 2) + 'deg' : '0deg');
      card.style.zIndex = String(cards.length - depth);
      card.inert = depth !== 0;
      card.setAttribute('aria-hidden', String(depth !== 0));
      card.setAttribute('aria-label', (i + 1) + ' sur ' + cards.length);
      card.classList.toggle('is-top', depth === 0);
    });
    counter.textContent = cards.length ? String(index + 1).padStart(2, '0') + ' / ' + String(cards.length).padStart(2, '0') : 'Aucun lieu';
    previous.disabled = next.disabled = cards.length < 2;
    hint.hidden = cards.length < 2;
    root.dataset.activePlace = cards[index]?.dataset.place || '';
  }
  async function cycle(direction) {
    if (busy || cards.length < 2 || destroyed) return;
    busy = true;
    const card = cards[index], restoreFocus = card.contains(document.activeElement);
    if (!reduced.matches && card.animate) {
      animation = card.animate([
        { transform: card.style.transform || 'translateX(0) rotate(0)', opacity: 1 },
        { transform: 'translateX(' + -direction * 65 + '%) rotate(' + -direction * 14 + 'deg)', opacity: 0 }
      ], { duration: 240, easing: 'cubic-bezier(.2,.7,.2,1)' });
      await animation.finished.catch(() => {});
      animation = null;
    }
    if (destroyed) return;
    card.style.transform = '';
    index = (index + direction + cards.length) % cards.length;
    render();
    if (restoreFocus) (direction > 0 ? next : previous).focus({ preventScroll: true });
    busy = false;
    onChange(cards[index], index);
  }
  listen(previous, 'click', () => cycle(-1));
  listen(next, 'click', () => cycle(1));
  listen(root, 'keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault(); cycle(event.key === 'ArrowRight' ? 1 : -1);
  });
  listen(stage, 'pointerdown', event => {
    if (busy || cards.length < 2 || event.isPrimary === false || event.button > 0 || !event.target.closest('.is-top .card-visual')) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dragging: false };
  });
  listen(stage, 'pointermove', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (!gesture.dragging) {
      if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { gesture = null; return; }
      if (Math.abs(dx) < 10) return;
      gesture.dragging = true;
      stage.setPointerCapture(event.pointerId);
      cards[index].classList.add('is-dragging');
    }
    event.preventDefault();
    gesture.dx = dx;
    const offset = Math.max(-stage.clientWidth * .5, Math.min(stage.clientWidth * .5, dx));
    if (!reduced.matches) cards[index].style.transform = 'translateX(' + offset + 'px) rotate(' + offset / stage.clientWidth * 18 + 'deg)';
  }, { passive: false });
  function release(event, cancelled = false) {
    if (!gesture || gesture.id !== event.pointerId) return;
    const { dx, dragging } = gesture;
    gesture = null;
    cards[index].classList.remove('is-dragging');
    if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    if (!cancelled && dragging && Math.abs(dx) > Math.min(80, stage.clientWidth * .25)) cycle(dx < 0 ? 1 : -1);
    else cards[index].style.transform = '';
  }
  listen(stage, 'pointerup', event => release(event));
  listen(stage, 'pointercancel', event => release(event, true));
  listen(stage, 'lostpointercapture', event => { if (event.target === stage) release(event, true); });
  listen(reduced, 'change', () => { if (reduced.matches) animation?.finish(); });
  render();
  return { next: () => cycle(1), previous: () => cycle(-1), getIndex: () => index,
    destroy() { destroyed = true; controller.abort(); animation?.cancel(); }
  };
}
