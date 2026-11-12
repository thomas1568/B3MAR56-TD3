import { createRouteProgress, GUIDANCE_CONFIG, locationSample, nextPhysicalStop } from './guidance.js?v=41';
import { validCoordinate, distanceBetween } from './routing.js?v=41';

export function createWalkingGuidance({
  container, places, router, getMap, getLeaflet, getRoute, installRoute, drawProgress,
  getCompleted = () => [], onStep, onOverview, onCompact, isActive,
}) {
  const q = selector => container.querySelector(selector);
  const sheet = q('.atlas-sheet'), header = q('.atlas-header');
  container.insertAdjacentHTML('beforeend', `
    <section id="guidancePanel" class="guidance-panel" hidden aria-labelledby="guidanceHeading" data-no-swipe>
      <h2 id="guidanceHeading" tabindex="-1">Guidage piéton</h2>
      <div id="guidanceSetup">
        <p id="guidanceChoiceNote"></p><label for="guidanceDestination">Point visé</label><select id="guidanceDestination"></select>
        <p class="small-note">Pour vous guider, Memoria Corti a besoin de votre position. Au démarrage, choisissez « Autoriser » si votre navigateur vous le demande.</p>
        <p class="small-note">Votre position sera envoyée à l’IGN pour calculer ce trajet, sans historique enregistré.</p>
        <button id="beginGuidance" class="primary" type="button">Démarrer le guidage</button>
        <button id="cancelGuidanceSetup" type="button">Annuler</button>
      </div>
      <div id="guidanceLive" hidden>
        <p id="guidanceTarget"></p><p id="guidanceEstimate" class="guidance-estimate" aria-live="off">En attente d’une position récente…</p>
        <p id="guidanceAccuracy" class="small-note" aria-live="off"></p>
        <p id="guidanceNotice" role="status"></p>
        <div id="guidancePermissionHelp" class="small-note" hidden tabindex="-1">
          <strong>Activez votre géolocalisation pour être guidé</strong>
          <p>Ouvrez les autorisations de ce site dans le menu de votre navigateur, puis autorisez la localisation. Vérifiez aussi que la localisation est activée pour votre navigateur dans les réglages du téléphone.</p>
          <p>Revenez ici et touchez « Réessayer la géolocalisation ». Si aucune demande ne s’affiche, l’autorisation est peut-être encore bloquée dans les réglages. Vous pouvez aussi toucher « Arrêter » pour consulter le plan.</p>
        </div>
        <div class="guidance-actions">
          <button id="guidanceRecenter" type="button" aria-label="Recentrer sur moi">Recentrer</button>
          <button id="guidanceOverview" type="button">Vue d’ensemble</button>
          <button id="guidanceStop" type="button">Arrêter</button>
        </div>
        <div class="guidance-secondary">
          <button id="guidanceChange" class="text-button" type="button">Changer le point</button>
          <button id="guidanceResume" type="button" hidden>Reprendre le guidage</button>
          <button id="guidanceRecalculate" type="button" hidden>Recalculer le trajet</button>
          <button id="guidanceOpenStep" class="primary" type="button" hidden>Ouvrir l’étape</button>
        </div>
        <p class="guidance-legend small-note">Gris : avancement estimé sur le chemin conseillé. Vert : trajet restant. L’arrivée ne valide pas la visite.</p>
      </div>
    </section>`);
  const panel = q('#guidancePanel'), reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let destination = null, tracker = null, wanted = false, following = false, suspended = false;
  let watch = null, generation = 0, watchdog = null, pending = false, needsRoute = false, lastRecalculation = -Infinity;
  let fix = null, marker = null, circle = null, frame = 0, drawn = null, lastSnapshot = null, announced = '';
  let mapBound = null, nearStart = [];
  const metric = value => value >= 1000 ? (value / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' km' : Math.round(value / 5) * 5 + ' m';
  function say(text) {
    if (announced === text) return;
    announced = text; q('#guidanceNotice').textContent = text; q('#guidanceStatus').textContent = text;
  }
  function layout(show) {
    panel.hidden = !show; sheet.hidden = show; header.hidden = show;
    container.classList.toggle('is-guiding', show);
    if (show) {
      onCompact(); sheet.hidden = true; header.hidden = true;
      q('.atlas-frame').inert = false; q('.atlas-controls').inert = false;
    }
  }
  function stopWatch() {
    if (watch !== null) navigator.geolocation?.clearWatch(watch);
    watch = null; clearInterval(watchdog); watchdog = null; cancelAnimationFrame(frame); frame = 0;
    container.dataset.tracking = 'false';
  }
  function bindMap() {
    const map = getMap(); if (!map || mapBound === map) return;
    mapBound = map;
    const suspendFollow = () => {
      if (!wanted) return;
      following = false; container.dataset.following = 'false';
      q('#guidanceRecenter').setAttribute('aria-pressed', 'false');
    };
    map.on('dragstart', suspendFollow);
    const el = map.getContainer();
    el.addEventListener('wheel', suspendFollow, { passive: true });
    el.addEventListener('keydown', event => { if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(event.key)) suspendFollow(); });
    el.addEventListener('touchstart', event => { if (event.touches.length > 1) suspendFollow(); }, { passive: true });
  }
  function center(point = fix?.coordinates) {
    const map = getMap(), L = getLeaflet();
    if (!map || !point || !following || !wanted || suspended || !isActive() || !fix || fix.state !== 'ok' || Date.now() - fix.timestamp > GUIDANCE_CONFIG.maxAge) return;
    const rect = map.getContainer().getBoundingClientRect(), cover = panel.getBoundingClientRect();
    // Use the clear area above the bottom panel; desktop leaves its left rail clear.
    let x = rect.width / 2, y = rect.height / 2;
    if (cover.width < rect.width * .6 && rect.width >= 900) x = (cover.right - rect.left + rect.width) / 2;
    else y = (Math.max(50, cover.top - rect.top) + 48) / 2;
    const target = map.project([point[1], point[0]], map.getZoom());
    const offset = L.point(x - rect.width / 2, y - rect.height / 2);
    map.panTo(map.unproject(target.subtract(offset), map.getZoom()), { animate: !reduced.matches, duration: .3 });
  }
  function paint(sample) {
    const map = getMap(), L = getLeaflet(); if (!map) return;
    const to = [sample.coordinates[1], sample.coordinates[0]];
    if (!marker) {
      const pane = map.getPane('guidancePosition') || map.createPane('guidancePosition');
      pane.style.zIndex = '625'; pane.style.pointerEvents = 'none';
      marker = L.circleMarker(to, { pane: 'guidancePosition', radius: 9, color: '#fff', weight: 3, fillColor: '#205e83', fillOpacity: 1, className: 'guidance-user', interactive: false }).addTo(map);
      circle = L.circle(to, { radius: sample.accuracy, color: '#205e83', weight: 1, fillOpacity: .09, interactive: false, className: 'guidance-accuracy' }).addTo(map);
    }
    cancelAnimationFrame(frame);
    const from = drawn || to, start = performance.now();
    const render = now => {
      const t = reduced.matches ? 1 : Math.min(1, (now - start) / GUIDANCE_CONFIG.interpolationMs);
      // Interpolate only between two received fixes; no extrapolated GPS samples.
      drawn = from.map((value, index) => value + (to[index] - value) * t);
      marker.setLatLng(drawn); circle.setLatLng(drawn); circle.setRadius(sample.accuracy);
      if (t < 1) frame = requestAnimationFrame(render); else frame = 0;
    };
    render(start);
    q('#guidanceAccuracy').textContent = 'Précision reçue : ± ' + Math.round(sample.accuracy) + ' m';
  }
  function preview(position) {
    const sample = locationSample(position);
    if (!sample.coordinates) return sample;
    paint(sample);
    return sample;
  }
  function renderProgress(snapshot) {
    lastSnapshot = snapshot; drawProgress(snapshot);
    q('#walkingProgress').hidden = false; q('#walkingProgress').value = snapshot.fraction * 100;
    q('#guidanceEstimate').textContent = 'Environ ' + Math.max(1, Math.ceil(snapshot.duration / 60)) + ' min · ' + metric(snapshot.distance);
    container.dataset.routeProgress = snapshot.progress.toFixed(1);
    container.dataset.guidanceState = snapshot.state;
  }
  async function calculateFrom(sample, own) {
    if (pending || own !== generation || !destination) return;
    pending = true; needsRoute = false; lastRecalculation = Date.now();
    say('Calcul de l’itinéraire piéton…'); q('#guidanceRecalculate').hidden = true;
    try {
      const result = await router.calculate(sample.coordinates, destination.coordinates);
      if (own !== generation || !wanted || suspended) return;
      tracker = createRouteProgress(result);
      installRoute(result, destination);
      renderProgress(tracker.update({ coords: { longitude: sample.coordinates[0], latitude: sample.coordinates[1], accuracy: sample.accuracy }, timestamp: sample.timestamp }));
      say('Guidage actif · distance restante estimée sur le tracé.');
      center();
    } catch (error) {
      if (own === generation && error.name !== 'AbortError') {
        say(navigator.onLine === false ? 'Réseau indisponible. Réessayez le calcul quand la connexion revient.' : (error.message || 'Le calcul a échoué. Réessayez.'));
        q('#guidanceRecalculate').hidden = false;
      }
    } finally { if (own === generation) pending = false; }
  }
  function accept(position, own) {
    if (own !== generation || !wanted || suspended || document.hidden || !isActive()) return;
    const sample = locationSample(position);
    if (sample.state === 'stale' || sample.state === 'invalid') { say('Position ancienne ou indisponible. En attente d’une mesure récente.'); return; }
    fix = sample; paint(sample);
    if (sample.state === 'imprecise') { nearStart = []; say('Précision insuffisante. La progression reste inchangée.'); return; }
    center(); q('#guidanceResume').hidden = true;
    if (needsRoute && sample.accuracy <= GUIDANCE_CONFIG.arrivalAccuracy &&
        distanceBetween(sample.coordinates, destination.coordinates) <= GUIDANCE_CONFIG.arrivalRadius) {
      if (!nearStart.length || sample.timestamp > nearStart.at(-1)) nearStart.push(sample.timestamp);
      nearStart = nearStart.slice(-GUIDANCE_CONFIG.arrivalFixes);
      q('#guidanceEstimate').textContent = 'Point à proximité';
      if (nearStart.length >= GUIDANCE_CONFIG.arrivalFixes && nearStart.at(-1) - nearStart[0] >= GUIDANCE_CONFIG.arrivalTime) {
        needsRoute = false; stopWatch(); following = false; container.dataset.following = 'false';
        say('Vous êtes à proximité du point'); q('#guidanceOpenStep').hidden = !destination.available;
      } else say('Vous semblez déjà à proximité. En attente de confirmation GPS.');
      return;
    }
    nearStart = [];
    if (needsRoute) { calculateFrom(sample, own); return; }
    if (pending || !tracker) return;
    const snapshot = tracker.update(position);
    if (['duplicate','stale','invalid'].includes(snapshot.state)) return;
    renderProgress(snapshot);
    if (snapshot.state === 'arrived') {
      say('Vous êtes à proximité du point');
      q('#guidanceOpenStep').hidden = !destination?.available;
      stopWatch(); following = false; container.dataset.following = 'false';
    } else if (snapshot.state === 'off-route') {
      say('Vous semblez vous éloigner du parcours');
      q('#guidanceRecalculate').hidden = false;
    } else if (snapshot.state === 'jump') {
      say('Déplacement GPS incohérent. Progression conservée ; vous pouvez recalculer depuis votre position.');
      q('#guidanceRecalculate').hidden = false;
    } else if (snapshot.state === 'uncertain') {
      say('Position à confirmer près du tracé. Progression conservée.');
    } else {
      say('Guidage actif · distance restante estimée sur le tracé.');
      q('#guidanceRecalculate').hidden = true;
    }
  }
  function startWatch() {
    stopWatch();
    q("#guidancePermissionHelp").hidden = true;
    q("#guidanceResume").textContent = "Reprendre le guidage";
    if (!navigator.geolocation) { say('Géolocalisation indisponible. Le plan et le choix manuel du départ restent accessibles.'); return; }
    suspended = false; wanted = true; const own = ++generation;
    bindMap(); container.dataset.tracking = 'true'; container.dataset.following = String(following);
    q('#startGuidance').hidden = true; q('#stopGuidance').hidden = false;
    say('Autorisez la géolocalisation si votre navigateur vous le demande. En attente de votre position…');
    watch = navigator.geolocation.watchPosition(position => accept(position, own), error => {
      if (own !== generation || !wanted) return;
      if (error.code === 1) {
        stopWatch(); generation++; router.cancel(); pending = false; suspended = true;
        if (!tracker) needsRoute = true;
        q('#guidanceResume').hidden = false;
        q('#guidanceResume').textContent = 'Réessayer la géolocalisation';
        q('#guidancePermissionHelp').hidden = false;
        say('Autorisation GPS refusée. Activez la localisation pour démarrer le guidage.');
        q('#guidancePermissionHelp').focus({ preventScroll: true });
        q('#guidancePermissionHelp').scrollIntoView({ block: 'nearest', behavior: 'instant' });
      } else say('Position momentanément indisponible. En attente d’une mesure récente.');
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
    watchdog = setInterval(() => {
      if (wanted && !suspended && (!fix || Date.now() - fix.timestamp > GUIDANCE_CONFIG.maxAge)) {
        cancelAnimationFrame(frame);
        say('Position ancienne. La progression est en pause jusqu’à une mesure récente.');
      }
    }, 3000);
  }
  function start({ existing = false } = {}) {
    const selected = places.find(place => place.id === q('#guidanceDestination').value);
    if (!existing) destination = selected;
    if (!destination || !validCoordinate(destination.coordinates)) { say('Destination sans coordonnées vérifiées. Choisissez un autre lieu.'); return; }
    if (!existing && !destination.available) { say('Cette étape est encore en préparation.'); return; }
    stopWatch(); generation++; router.cancel(); pending = false; fix = null; nearStart = [];
    wanted = true; suspended = false; following = true;
    tracker = existing && getRoute() ? createRouteProgress(getRoute()) : null;
    needsRoute = !tracker;
    if (tracker) renderProgress(tracker.getState());
    else { installRoute(null, destination); container.dataset.routeProgress = '0'; q('#guidanceEstimate').textContent = 'En attente d’une position récente…'; }
    layout(true); q('#guidanceSetup').hidden = true; q('#guidanceLive').hidden = false;
    q('#guidanceTarget').textContent = 'Prochain point : ' + destination.title;
    q('#guidanceResume').hidden = true; q('#guidanceOpenStep').hidden = true;
    q('#guidanceRecalculate').hidden = true;
    q('#guidanceHeading').focus({ preventScroll: true });
    startWatch();
  }
  function stop(message = 'Guidage arrêté. Le trajet reste consultable.') {
    wanted = false; following = false; suspended = false; generation++; router.cancel(); pending = false; needsRoute = false;
    stopWatch(); container.dataset.following = 'false'; layout(false);
    q('#startGuidance').hidden = false; q('#stopGuidance').hidden = true;
    if (message) say(message);
  }
  function prepare() {
    stop('');
    const choice = nextPhysicalStop(places, getCompleted());
    const select = q('#guidanceDestination');
    select.replaceChildren(...choice.alternatives.map(place => new Option(place.title, place.id)));
    if (choice.destination) select.value = choice.destination.id;
    q('#guidanceChoiceNote').textContent = choice.reason || 'La prochaine étape physique disponible est ' + choice.destination.title + '.';
    if (!choice.destination && choice.alternatives.length) q('#guidanceChoiceNote').textContent += ' Vous pouvez rejoindre à nouveau un lieu disponible.';
    q('#beginGuidance').disabled = !choice.alternatives.length;
    q('#guidanceSetup').hidden = false; q('#guidanceLive').hidden = true;
    layout(true); q('#guidanceHeading').focus({ preventScroll: true });
  }
  function pause() {
    if (!wanted) return;
    suspended = true; generation++; router.cancel(); pending = false; stopWatch();
    if (!tracker) needsRoute = true;
    q('#guidanceResume').hidden = false;
    say('Guidage en pause. Le navigateur peut suspendre le GPS en arrière-plan ou écran verrouillé. Reprenez avec une position récente.');
  }
  q('#beginGuidance').addEventListener('click', () => start());
  q('#cancelGuidanceSetup').addEventListener('click', () => { stop(''); q('#guideNextPoint').focus(); });
  q('#guidanceChange').addEventListener('click', prepare);
  q('#guidanceStop').addEventListener('click', () => { stop(); q('#guideNextPoint').focus(); });
  q('#guidanceResume').addEventListener('click', () => { if (document.hidden || !isActive()) return; fix = null; startWatch(); });
  q('#guidanceRecenter').addEventListener('click', () => {
    if (!fix || Date.now() - fix.timestamp > GUIDANCE_CONFIG.maxAge) { say('En attente d’une position récente pour vous recentrer.'); return; }
    following = true; container.dataset.following = 'true'; q('#guidanceRecenter').setAttribute('aria-pressed', 'true'); center();
  });
  q('#guidanceOverview').addEventListener('click', () => { following = false; container.dataset.following = 'false'; onOverview(); });
  q('#guidanceRecalculate').addEventListener('click', () => {
    if (pending || suspended) return;
    if (!fix || locationSample({ coords: { longitude: fix.coordinates[0], latitude: fix.coordinates[1], accuracy: fix.accuracy }, timestamp: fix.timestamp }).state !== 'ok') {
      say('Attendez une position récente et précise avant de recalculer.'); return;
    }
    if (Date.now() - lastRecalculation < GUIDANCE_CONFIG.recalculateCooldown) { say('Patientez quelques secondes avant un nouveau calcul.'); return; }
    tracker = null; installRoute(null, destination); q('#walkingProgress').value = 0; container.dataset.routeProgress = '0';
    q('#guidanceEstimate').textContent = 'Recalcul en cours…';
    calculateFrom(fix, generation);
  });
  q('#guidanceOpenStep').addEventListener('click', () => { if (!destination?.available) return; stop(''); onStep(destination.id); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  addEventListener('pagehide', pause);
  addEventListener('offline', () => { if (wanted) say('Réseau perdu. Le trajet chargé reste utilisable avec le GPS ; le recalcul attend la connexion.'); });
  const resize = new ResizeObserver(() => { if (wanted && following && fix && !suspended) center(); });
  resize.observe(panel); resize.observe(container);
  return {
    prepare, stop, pause, preview, recenter: center,
    startExisting() {
      const route = getRoute(); if (!route) return;
      destination = places.find(place => place.id === route.destinationId);
      // A manually prepared route may target a known but future location; state it honestly.
      start({ existing: true });
      if (!destination?.available) q('#guidanceTarget').textContent += ' · étape en préparation';
    },
    getState: () => ({ tracking: watch !== null, wanted, suspended, following, destination: destination?.id, snapshot: lastSnapshot }),
    activate() { bindMap(); if (wanted && suspended) say('Guidage en pause. Touchez « Reprendre le guidage » pour obtenir une position récente.'); },
  };
}
