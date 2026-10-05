export const LAYOUT_KEY = 'memoria-corti:iut-layout:v1';
const finite = (value, length) => Array.isArray(value) && value.length === length && value.every(Number.isFinite);

export function serializeLayout(memoria, stepId) {
  return { version: 1, stepId, objects: memoria.objects.map(object => ({
    id: object.userData.layoutId, enabled: object.parent === memoria.root,
    position: object.position.toArray(), quaternion: object.quaternion.toArray(), scale: object.scale.toArray()
  })) };
}
export function validateLayout(data, stepId, ids) {
  if (data?.version !== 1 || data.stepId !== stepId || !Array.isArray(data.objects) || data.objects.length > ids.length) return false;
  const seen = new Set();
  return data.objects.every(item => {
    if (!ids.includes(item.id) || seen.has(item.id)) return false;
    seen.add(item.id);
    return typeof item.enabled === 'boolean' && finite(item.position, 3) && item.position.every(v => Math.abs(v) <= 10) &&
      finite(item.quaternion, 4) && Math.abs(Math.hypot(...item.quaternion) - 1) < 0.01 &&
      finite(item.scale, 3) && item.scale.every(v => v >= 0.1 && v <= 3);
  });
}
export function applyLayout(memoria, data, stepId) {
  if (!validateLayout(data, stepId, memoria.objects.map(object => object.userData.layoutId))) throw new Error('Agencement local invalide.');
  for (const state of data.objects) {
    const object = memoria.objects.find(item => item.userData.layoutId === state.id);
    object.position.fromArray(state.position); object.quaternion.fromArray(state.quaternion).normalize(); object.scale.fromArray(state.scale);
    if (state.enabled) memoria.root.add(object); else object.removeFromParent();
  }
}
export function saveLayout(storage, memoria, stepId) {
  // Deliberately excludes the root's world pose: every session requires recalibration.
  storage.setItem(LAYOUT_KEY, JSON.stringify(serializeLayout(memoria, stepId)));
}
export function loadLayout(storage, memoria, stepId) {
  const saved = storage.getItem(LAYOUT_KEY);
  if (saved) applyLayout(memoria, JSON.parse(saved), stepId);
  return !!saved;
}
