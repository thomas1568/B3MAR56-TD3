/**
 * Native adaptation of Kokonut UI Typewriter, @dorianbaffier (MIT).
 * https://kokonutui.com/r/type-writer.json
 * One accessible, layout-stable sequence; pauses outside the visible page.
 */
export function createTypewriter(title, {
  text = title.innerText, typingSpeed = 55, startDelay = 250,
  canRun = () => true, watch = [],
} = {}) {
  const original = [...title.childNodes];
  const readable = document.createElement('span'); readable.className = 'sr-only'; readable.textContent = text;
  const visual = document.createElement('span'); visual.className = 'typewriter-visual'; visual.setAttribute('aria-hidden', 'true');
  const reserve = document.createElement('span'); reserve.className = 'typewriter-reserve'; reserve.textContent = text;
  const current = document.createElement('span'); current.className = 'typewriter-current';
  const typed = document.createTextNode(text);
  const caret = document.createElement('span'); caret.className = 'typewriter-caret'; caret.hidden = true;
  current.append(typed, caret); visual.append(reserve, current); title.replaceChildren(readable, visual);
  const chars = Array.from(text), reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  let position = 0, timer = null, visible = false, started = false, done = false;
  function stop() { clearTimeout(timer); timer = null; caret.hidden = true; }
  function finish() { stop(); position = chars.length; typed.textContent = text; done = true; title.dataset.typing = 'complete'; }
  function allowed() { return visible && !document.hidden && canRun(); }
  function tick() {
    timer = null;
    if (!allowed()) { stop(); return; }
    if (!started) { started = true; typed.textContent = ''; }
    caret.hidden = false;
    typed.textContent = chars.slice(0, ++position).join('');
    if (position >= chars.length) { finish(); return; }
    timer = setTimeout(tick, typingSpeed);
  }
  function sync() {
    if (reduced.matches) { finish(); return; }
    if (done) return;
    if (!allowed()) { stop(); return; }
    title.dataset.typing = 'running';
    if (timer === null) timer = setTimeout(tick, started ? typingSpeed : startDelay);
  }
  const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }, { threshold: .1 });
  observer.observe(title);
  const mutations = new MutationObserver(sync);
  for (const node of watch) mutations.observe(node, { attributes: true, attributeFilter: ['hidden', 'inert'] });
  document.addEventListener('visibilitychange', sync, { signal: controller.signal });
  reduced.addEventListener('change', sync, { signal: controller.signal });
  title.dataset.typing = 'pending';
  sync();
  return { finish, refresh: sync, destroy() { stop(); observer.disconnect(); mutations.disconnect(); controller.abort(); title.replaceChildren(...original); delete title.dataset.typing; } };
}
