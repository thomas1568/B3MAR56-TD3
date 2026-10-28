// A short, skippable introduction on every load. It never waits for AR or media.
const intro = document.getElementById('appIntro');
const content = document.getElementById('content');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const started = performance.now();
let finished = false, ready = false, closing = false;
intro.focus({ preventScroll: true });
function finish() {
  if (finished) return;
  finished = true; intro.hidden = true; content.inert = false;
  const target = [...document.querySelectorAll('#signupButton,#appView h1')].find(node => node.getClientRects().length);
  if (target) { if (target.tagName !== 'BUTTON') target.tabIndex = -1; target.focus({ preventScroll: true }); }
  document.dispatchEvent(new CustomEvent('memoria:intro-end'));
}
function close() {
  if (closing || finished) return;
  closing = true;
  if (reduced.matches) { finish(); return; }
  intro.classList.add('is-leaving');
  intro.addEventListener('transitionend', event => { if (event.target === intro) finish(); });
  setTimeout(finish, 360);
}
function reveal() {
  ready = true;
  const remaining = (reduced.matches ? 0 : 1000) - (performance.now() - started);
  if (remaining > 0) setTimeout(close, remaining); else close();
}
document.addEventListener('memoria:ready', reveal, { once: true });
document.getElementById('skipIntro').addEventListener('click', close);
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !finished) close(); });
// Slow network or startup errors must never trap the visitor behind a splash.
setTimeout(() => { if (!ready) close(); }, 2800);
