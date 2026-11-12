/**
 * Native adaptation of Kokonut UI CarouselCards / Momentum Rail.
 * @dorianbaffier, MIT — https://kokonutui.com/r/carousel-cards.json
 * Original React reference: components/kokonutui/carousel-cards.tsx
 */
export function createCarouselCards(root, { onChange = () => {} } = {}) {
  root.classList.add('places-carousel');
  root.dataset.noSwipe = '';
  root.setAttribute('role', 'region');
  root.setAttribute('aria-roledescription', 'carrousel');
  root.setAttribute('aria-label', 'Les lieux de Corte');
  const controls = document.createElement('div');
  controls.className = 'carousel-controls';
  const arrow = '<svg class="icon" aria-hidden="true" focusable="false"><use href="#icon-arrow"/></svg>';
  controls.innerHTML = `<p class="carousel-counter" role="status" aria-live="polite" aria-atomic="true"></p><button class="carousel-prev" type="button" aria-label="Lieu précédent">${arrow}</button><button class="carousel-next" type="button" aria-label="Lieu suivant">${arrow}</button>`;
  const viewport = document.createElement('div');
  viewport.className = 'carousel-viewport';
  viewport.tabIndex = 0;
  viewport.setAttribute('role', 'group');
  viewport.setAttribute('aria-label', 'Cartes des lieux : flèches gauche et droite pour naviguer');
  const track = document.createElement('div');
  track.className = 'carousel-track';
  viewport.append(track);
  root.replaceChildren(controls, viewport);
  const previous = controls.querySelector('.carousel-prev'), next = controls.querySelector('.carousel-next');
  const counter = controls.querySelector('.carousel-counter');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  const listen = (node, type, callback, options = {}) => node.addEventListener(type, callback, { ...options, signal: controller.signal });
  let cards = [], active = 0, target = null, drag = null, frame = 0, suppressUntil = 0;
  const clamp = value => Math.max(0, Math.min(cards.length - 1, value));
  const points = () => cards.map(card => card.offsetLeft + card.offsetWidth / 2 - viewport.clientWidth / 2);
  function nearest(position) {
    const stops = points();
    return stops.reduce((best, point, i) => Math.abs(point - position) < Math.abs(stops[best] - position) ? i : best, 0);
  }
  function sync() {
    if (!cards.length || !viewport.clientWidth) return;
    const index = nearest(viewport.scrollLeft), changed = index !== active;
    active = index;
    root.dataset.activePlace = cards[active].dataset.place || '';
    counter.textContent = String(active + 1).padStart(2, '0') + ' / ' + String(cards.length).padStart(2, '0');
    previous.setAttribute('aria-disabled', String(active === 0));
    next.setAttribute('aria-disabled', String(active === cards.length - 1));
    cards.forEach((card, i) => card.classList.toggle('is-current', i === active));
    if (changed) onChange(cards[active], active);
  }
  function goTo(index, instant = false) {
    if (!cards.length || !viewport.clientWidth) return;
    target = clamp(index);
    viewport.scrollTo({ left: points()[target], behavior: instant || reduced.matches ? 'instant' : 'smooth' });
    if (instant || reduced.matches) { target = null; sync(); }
  }
  listen(previous, 'click', () => goTo((target ?? active) - 1));
  listen(next, 'click', () => goTo((target ?? active) + 1));
  listen(viewport, 'scroll', () => {
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; sync(); });
  }, { passive: true });
  listen(viewport, 'scrollend', () => { target = null; sync(); });
  listen(viewport, 'keydown', event => {
    if (event.target !== viewport) return;
    const index = target ?? active;
    const keys = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: cards.length - 1 };
    if (!(event.key in keys)) return;
    event.preventDefault(); goTo(keys[event.key]);
  });
  listen(viewport, 'focusin', event => {
    const card = event.target.closest('.carousel-card');
    if (card) goTo(cards.indexOf(card));
  });
  listen(viewport, 'pointerdown', event => {
    target = null;
    if (event.pointerType !== 'mouse' || event.button !== 0 || event.target.closest('button,a,input,select,textarea')) return;
    viewport.scrollTo({ left: viewport.scrollLeft, behavior: 'instant' });
    drag = { id: event.pointerId, start: event.clientX, scroll: viewport.scrollLeft, lastX: event.clientX, lastTime: event.timeStamp, velocity: 0, moved: false };
  });
  listen(viewport, 'pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.start;
    if (!drag.moved && Math.abs(dx) < 5) return;
    if (!drag.moved) {
      drag.moved = true; viewport.classList.add('is-dragging');
      viewport.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    const elapsed = event.timeStamp - drag.lastTime;
    if (elapsed > 0) drag.velocity = (drag.lastX - event.clientX) / elapsed;
    drag.lastX = event.clientX; drag.lastTime = event.timeStamp;
    viewport.scrollLeft = drag.scroll - dx;
  });
  function release(event, cancelled = false) {
    if (!drag || drag.id !== event.pointerId) return;
    const current = drag; drag = null;
    viewport.classList.remove('is-dragging');
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    if (!current.moved) return;
    suppressUntil = performance.now() + 250;
    const velocity = cancelled || event.timeStamp - current.lastTime > 80 ? 0 : current.velocity;
    goTo(nearest(viewport.scrollLeft + velocity * 180));
  }
  listen(viewport, 'pointerup', event => release(event));
  listen(viewport, 'pointercancel', event => release(event, true));
  listen(viewport, 'lostpointercapture', event => { if (event.target === viewport) release(event, true); });
  listen(viewport, 'click', event => {
    if (performance.now() < suppressUntil) { event.preventDefault(); event.stopPropagation(); }
  }, { capture: true });
  listen(viewport, 'wheel', () => { target = null; }, { passive: true });
  listen(reduced, 'change', () => { if (reduced.matches) goTo(target ?? active, true); });
  const observer = new ResizeObserver(() => { if (viewport.clientWidth) goTo(active, true); });
  observer.observe(viewport);
  return {
    setCards(nextCards) {
      drag = null; target = null; active = 0;
      viewport.classList.remove('is-dragging');
      cards = nextCards;
      cards.forEach((card, index) => {
        card.classList.add('carousel-card');
        card.setAttribute('role', 'group');
        card.setAttribute('aria-roledescription', 'diapositive');
        card.setAttribute('aria-label', (index + 1) + ' sur ' + cards.length);
        const image = card.querySelector('img');
        if (image) image.draggable = false;
      });
      track.replaceChildren(...cards);
      root.hidden = cards.length === 0;
      controls.hidden = cards.length < 2;
      root.dataset.activePlace = cards[0]?.dataset.place || '';
      viewport.scrollTo({ left: 0, behavior: 'instant' });
      goTo(0, true);
    },
    goTo,
    getIndex: () => active,
    destroy() { controller.abort(); observer.disconnect(); cancelAnimationFrame(frame); }
  };
}
