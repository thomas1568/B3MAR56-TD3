export const AVATARS = [
  { id: 'citadelle', name: 'La citadelle', path: 'M14 43h36M19 43V25h9v-8h8v8h9v18M23 25v-5m18 5v-5M28 43V33h8v10M26 17h12' },
  { id: 'livre', name: 'Le livre', path: 'M32 23q-9-8-21-4v26q12-4 21 4 9-8 21-4V19q-12-4-21 4Zm0 0v26M18 26l8 3m-8 5 8 3m12-8 8-3m-8 11 8-3' },
  { id: 'voix', name: 'Les voix', path: 'M12 29v6m7-13v20m7-26v32m6-39v46m6-39v32m7-26v20m7-13v6' },
  { id: 'montagne', name: 'Les montagnes', path: 'm8 46 16-27 11 17 7-12 14 22H8Zm11-19 5 5 5-5m9 4 4 4 4-4' },
  { id: 'riviere', name: 'La rivière', path: 'M26 10c25 12-24 15 1 27s2 15-4 18M39 10c25 12-24 15 1 27s2 15-4 18M10 22l7-7 5 5m21 24 5-5 6 7' },
  { id: 'boussole', name: 'La boussole', path: 'M32 9v5m0 36v5M9 32h5m36 0h5M42 22l-6 14-14 6 6-14 14-6Z', circle: true },
  { id: 'initiales', name: 'Mes initiales', path: '' }
];
export function initials(pseudo = '') {
  return pseudo.trim().split(/\s+/u).filter(Boolean).map(word => [...word][0]).slice(0, 2).join('').toLocaleUpperCase('fr') || 'MC';
}
export function avatarSVG(id, pseudo = '') {
  const avatar = AVATARS.find(item => item.id === id) || AVATARS[0];
  // Initials are written as text nodes by callers; this SVG never interpolates user data.
  if (avatar.id === 'initiales') return '';
  return `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${avatar.circle ? '<circle cx="32" cy="32" r="20"/>' : ''}<path d="${avatar.path}"/></svg>`;
}
export function renderAvatar(node, profile) {
  node.replaceChildren(); node.classList.add('avatar');
  if (profile?.photoURL) {
    const img = document.createElement('img'); img.alt = ''; img.src = profile.photoURL;
    img.addEventListener('error', () => { node.replaceChildren(); node.textContent = initials(profile.pseudo); }, { once: true });
    node.appendChild(img);
  } else if (profile?.avatar === 'initiales') node.textContent = initials(profile.pseudo);
  else node.innerHTML = avatarSVG(profile?.avatar || 'citadelle');
}
