// Scroll reactions are progressive: content remains visible if motion is unavailable.
export function createPageMotion({ view, header, canAnimate = () => true }) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const seen = new WeakSet(), running = new Set();
  const targets = '.welcome-line,.hero-copy h2,.hero-copy>p,.hero-actions,.section-heading,.editorial-card:not(.stack-card):not(.carousel-card),.story-card,.resume-card,.corte-photo-card,.quiet-note,.listen-intro,.profile-identity,.profile-aside';
  let lastY = Math.max(0, view.scrollTop), distance = 0, frame = 0;
  function conceal(hidden) {
    if (header.contains(document.activeElement)) hidden = false;
    header.classList.toggle('is-concealed', hidden);
    header.inert = hidden;
    if (hidden) header.setAttribute('aria-hidden', 'true'); else header.removeAttribute('aria-hidden');
  }
  function updateHeader(reset = false) {
    const y = Math.max(0, view.scrollTop), delta = y - lastY;
    lastY = y;
    header.classList.toggle('is-over-content', y > 72);
    if (reset) { distance = 0; conceal(y > 72); return; }
    if (y < 24) { distance = 0; conceal(false); return; }
    if (Math.sign(delta) !== Math.sign(distance)) distance = 0;
    distance += delta;
    if (y > 72 && distance > 10) conceal(true);
    else if (distance < -12) conceal(false);
  }
  view.addEventListener('scroll', () => {
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; updateHeader(); });
  }, { passive: true });
  header.addEventListener('focusin', () => conceal(false));

  function reveal(nodes) {
    nodes.forEach((node, index) => {
      if (seen.has(node)) return;
      seen.add(node); observer?.unobserve(node);
      if (reduced.matches || !node.animate) return;
      const animation = node.animate(
        [{ opacity: .04, transform: 'translateY(16px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 480, delay: Math.min(index * 55, 165), easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' }
      );
      animation.id = 'memoria-reveal'; running.add(animation);
      animation.finished.catch(() => {}).finally(() => running.delete(animation));
    });
  }
  const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    if (!canAnimate()) return;
    reveal(entries.filter(entry => entry.isIntersecting).map(entry => entry.target));
  }, { root: view, threshold: .12, rootMargin: '0px 0px -28px 0px' }) : null;
  function observe() {
    if (!observer) return;
    for (const node of view.querySelectorAll(targets)) {
      if (seen.has(node)) continue;
      observer.unobserve(node); observer.observe(node);
    }
  }
  reduced.addEventListener('change', () => {
    if (reduced.matches) for (const animation of running) animation.cancel();
    observe();
  });
  observe();
  return { refresh() { updateHeader(true); observe(); } };
}
