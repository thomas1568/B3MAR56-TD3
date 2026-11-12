import { validCoordinate, distanceBetween } from './routing.js?v=41';

// All lengths are metres, times milliseconds unless explicitly named seconds.
export const GUIDANCE_CONFIG = Object.freeze({
  maxAccuracy: 35, maxAge: 15000, maxSpeed: 3, maxStep: 80,
  jitter: 3, reverseDistance: 10, reverseFixes: 3,
  offRouteDistance: 30, offRouteFixes: 3, offRouteTime: 6000,
  arrivalRadius: 25, arrivalAccuracy: 20, arrivalRemaining: 40,
  arrivalFixes: 2, arrivalTime: 3000, interpolationMs: 350,
  recalculateCooldown: 10000,
});
export function nextPhysicalStop(stops, completedIds = []) {
  const done = new Set(completedIds);
  const candidates = stops.filter(s => s.available && validCoordinate(s.coordinates));
  const next = stops.find(s => !done.has(s.id));
  return {
    destination: next?.available && validCoordinate(next.coordinates) ? next : null,
    alternatives: candidates,
    reason: !next ? 'Vous avez consulté toutes les étapes du parcours.' :
      !next.available ? next.title + ' est en préparation. Aucune prochaine étape disponible pour le moment.' :
      !validCoordinate(next.coordinates) ? 'Les coordonnées de ' + next.title + ' ne sont pas renseignées.' : '',
  };
}
export function routeGeometry(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2 || !coordinates.every(validCoordinate)) throw Error('Géométrie de trajet invalide.');
  const cumulative = [0];
  for (let i = 1; i < coordinates.length; i++) cumulative.push(cumulative[i - 1] + distanceBetween(coordinates[i - 1], coordinates[i]));
  if (!cumulative.at(-1)) throw Error('Trajet sans longueur.');
  return { coordinates, cumulative, total: cumulative.at(-1) };
}
export function splitRoute(geometry, progress) {
  const { coordinates: c, cumulative: d, total } = geometry;
  const at = Math.max(0, Math.min(total, progress));
  let i = 1;
  while (i < c.length - 1 && d[i] < at) i++;
  const t = (at - d[i - 1]) / (d[i] - d[i - 1] || 1);
  const point = [c[i - 1][0] + (c[i][0] - c[i - 1][0]) * t, c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t];
  return { point, traveled: [...c.slice(0, i), point], remaining: [point, ...c.slice(i)] };
}
function projections(point, geometry) {
  const k = Math.cos(point[1] * Math.PI / 180), result = [];
  const { coordinates: c, cumulative: d } = geometry;
  for (let i = 1; i < c.length; i++) {
    const a = c[i - 1], b = c[i], dx = (b[0] - a[0]) * k, dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * k * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    result.push({ progress: d[i - 1] + t * (d[i] - d[i - 1]), distance: distanceBetween(point, p) });
  }
  return result;
}
export function locationSample(position, now = Date.now(), config = GUIDANCE_CONFIG) {
  const coordinates = [position?.coords?.longitude, position?.coords?.latitude];
  const accuracy = position?.coords?.accuracy, timestamp = position?.timestamp;
  if (!validCoordinate(coordinates) || !Number.isFinite(accuracy) || accuracy < 0) return { state: 'invalid' };
  if (!Number.isFinite(timestamp) || now - timestamp > config.maxAge || timestamp > now + 1000) return { state: 'stale' };
  return { state: accuracy > config.maxAccuracy ? 'imprecise' : 'ok', coordinates, accuracy, timestamp };
}
export function createRouteProgress(route, options = {}) {
  const config = { ...GUIDANCE_CONFIG, ...options }, geometry = routeGeometry(route.coordinates);
  let progress = 0, last = null, seenTime = -Infinity, off = [], reverse = [], arrivals = [];
  function snapshot(state, extra = {}) {
    const fraction = Math.min(1, progress / geometry.total);
    return { state, progress, fraction, geometryRemaining: geometry.total - progress,
      distance: (route.distance || geometry.total) * (1 - fraction),
      duration: route.duration > 0 ? route.duration * (1 - fraction) : (geometry.total - progress) / 1.2,
      ...splitRoute(geometry, progress), ...extra };
  }
  return {
    geometry,
    getState: () => snapshot('waiting'),
    update(position, now = Date.now()) {
      const fix = locationSample(position, now, config);
      if (fix.state !== 'ok') { off = []; reverse = []; arrivals = []; return snapshot(fix.state); }
      if (fix.timestamp <= seenTime) return snapshot('duplicate');
      seenTime = fix.timestamp;
      const elapsed = last ? Math.max(0, (fix.timestamp - last.timestamp) / 1000) : 0;
      const window = Math.min(config.maxStep, Math.max(20, config.maxSpeed * Math.min(15, elapsed) + fix.accuracy * .5));
      // A teleport or a long gap cannot silently skip a section. Recalculation reacquires.
      if (last && distanceBetween(last.coordinates, fix.coordinates) > window + Math.min(20, fix.accuracy)) {
        reverse = []; arrivals = []; return snapshot('jump');
      }
      const candidates = projections(fix.coordinates, geometry);
      const nearest = candidates.reduce((a, b) => a.distance < b.distance ? a : b);
      const corridor = Math.max(config.offRouteDistance, fix.accuracy * 1.5);
      if (nearest.distance > corridor) {
        off.push(fix.timestamp); off = off.slice(-config.offRouteFixes); reverse = []; arrivals = [];
        // Keep the last actual fix for speed checks, never move route progress off the path.
        last = fix;
        return snapshot(off.length >= config.offRouteFixes && off.at(-1) - off[0] >= config.offRouteTime ? 'off-route' : 'uncertain', { crossTrack: nearest.distance });
      }
      off = [];
      const anchor = reverse.at(-1) ?? progress;
      const local = candidates.filter(c => !last || Math.abs(c.progress - anchor) <= window);
      const score = c => c.distance + (last ? Math.abs(c.progress - anchor) * .15 : c.progress * .0001);
      const match = local.sort((a, b) => score(a) - score(b))[0];
      if (!match || match.distance > corridor) { arrivals = []; return snapshot('jump'); }
      last = fix;
      const delta = match.progress - progress;
      if (delta < -Math.max(config.reverseDistance, fix.accuracy)) {
        if (reverse.length && match.progress > reverse.at(-1) + config.jitter) reverse = [];
        reverse.push(match.progress);
        if (reverse.length >= config.reverseFixes) { progress = match.progress; reverse = []; }
      } else {
        reverse = [];
        if (delta > config.jitter || !progress) progress = Math.max(progress, match.progress);
      }
      const near = fix.accuracy <= config.arrivalAccuracy &&
        distanceBetween(fix.coordinates, route.end || route.coordinates.at(-1)) <= config.arrivalRadius &&
        geometry.total - progress <= config.arrivalRemaining;
      if (near) { arrivals.push(fix.timestamp); arrivals = arrivals.slice(-config.arrivalFixes); } else arrivals = [];
      const arrived = arrivals.length >= config.arrivalFixes && arrivals.at(-1) - arrivals[0] >= config.arrivalTime;
      return snapshot(arrived ? 'arrived' : 'on-route', { crossTrack: match.distance });
    },
  };
}
