// Native pointer gestures: horizontal movement belongs to the tabs, vertical
// movement stays with the browser. No gestures are installed in the AR scene.
export function createTabNavigation({ nav, view, pages, getPage, navigate, canNavigate = () => true }) {
  nav.classList.add('gliding-nav');
  const pill = document.createElement('span'); pill.className = 'nav-active-pill'; pill.setAttribute('aria-hidden', 'true'); nav.prepend(pill);
  const buttons = [...nav.querySelectorAll('[data-page]')];
  let gesture = null, suppressClickUntil = 0;
  const reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function mark(page) {
    const button = buttons.find(node => node.dataset.page === page); if (!button || !nav.getClientRects().length) return;
    pill.style.width = button.offsetWidth + 'px'; pill.style.height = button.offsetHeight + 'px';
    pill.style.transform = `translate(${button.offsetLeft}px, ${button.offsetTop}px)`;
    for (const node of buttons) node.classList.toggle('is-preview', node === button);
  }
  function sync() { if (!gesture?.dragged) mark(getPage()); }
  function clear() { gesture = null; nav.classList.remove('is-dragging'); view.classList.remove('is-swiping'); sync(); }
  function pointerDown(event, surface) {
    if (!canNavigate() || event.isPrimary === false || event.button > 0 || (surface === 'page' && event.pointerType !== 'touch')) return;
    if (surface === 'page' && event.target.closest('button,a,input,select,textarea,summary,canvas,label,[role="slider"],[data-map],[data-no-swipe]')) return;
    suppressClickUntil = 0;
    if (gesture) { clear(); return; }
    gesture = { id: event.pointerId, surface, x: event.clientX, y: event.clientY, dragged: false, target: getPage(), rejected: false };
  }
  function pointerMove(event) {
    if (!gesture || gesture.id !== event.pointerId || gesture.rejected) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (!gesture.dragged) {
      if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { gesture.rejected = true; return; }
      if (Math.abs(dx) < 9 || Math.abs(dx) < Math.abs(dy) * 1.35) return;
      gesture.dragged = true;
      if (gesture.surface === 'nav') { nav.setPointerCapture(event.pointerId); nav.classList.add('is-dragging'); }
      else view.classList.add('is-swiping');
    }
    event.preventDefault();
    if (gesture.surface === 'nav') {
      const closest = buttons.reduce((a, b) => {
        const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
        return Math.abs(event.clientX - ar.left - ar.width / 2) < Math.abs(event.clientX - br.left - br.width / 2) ? a : b;
      });
      gesture.target = closest.dataset.page; mark(gesture.target);
    } else {
      const index = pages.indexOf(getPage()), direction = dx < 0 ? 1 : -1;
      gesture.target = Math.abs(dx) >= Math.min(72, view.clientWidth * .18) ? pages[Math.max(0, Math.min(pages.length - 1, index + direction))] : getPage();
      mark(gesture.target);
    }
  }
  function pointerUp(event) {
    if (!gesture || gesture.id !== event.pointerId) return;
    const { dragged, target } = gesture;
    if (dragged) {
      suppressClickUntil = performance.now() + 350;
      if (target !== getPage() && canNavigate()) navigate(target, { focus: false });
    }
    clear();
  }
  for (const [surface, node] of [['nav', nav], ['page', view]]) {
    node.addEventListener('pointerdown', event => pointerDown(event, surface));
    node.addEventListener('pointermove', pointerMove, { passive: false });
    node.addEventListener('pointerup', pointerUp);
    node.addEventListener('pointercancel', clear);
    node.addEventListener('lostpointercapture', event => { if (event.target === node && gesture) clear(); });
    node.addEventListener('click', event => { if (performance.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
  }
  nav.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key) || !canNavigate()) return;
    event.preventDefault();
    const current = pages.indexOf(getPage());
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? pages.length - 1 : Math.max(0, Math.min(pages.length - 1, current + (event.key === 'ArrowRight' ? 1 : -1)));
    navigate(pages[index], { focus: false }); buttons[index].focus();
  });
  const observer = new ResizeObserver(sync); observer.observe(nav);
  sync();
  return { sync, animate(node, direction) {
    if (reduced() || !node.animate) return;
    for (const animation of node.getAnimations()) animation.cancel();
    node.animate([{ opacity: .4, transform: `translateX(${direction * 18}px)` }, { opacity: 1, transform: 'translateX(0)' }], { duration: 210, easing: 'cubic-bezier(.2,.7,.25,1)' });
  } };
}
