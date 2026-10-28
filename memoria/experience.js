import { findPoint, mediaReady } from '../content/iut.js?v=20';
import { createAudioController } from './audio.js?v=20';
import { createPanorama } from './panorama.js?v=20';
import { layoutHotspots } from './hotspots.js';
import { POINT_VISUALS } from '../content/point-visuals.js?v=20';

export function createExperience(step, api) {
  const el = id => document.getElementById(id);
  let activePoint = null, activeAR = false, mode = 'visit', availableAR = false, panorama = null, focusBefore = null, toastTimer = null;
  let prepared = false, scenePlaced = false, currentStage = 'prepare', storiesFocus = null, panoramaFocus = null;
  let musicEnabled = true;
  try { musicEnabled = localStorage.getItem('memoria-corti:ar-music') !== 'off'; } catch {}
  const audioDockHome = el('audioDock').parentNode;
  const scrollBehavior = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
  function updateJourney() {
    const availability = {
      prepare: '',
      place: !prepared ? 'Préparez d’abord votre visite.' : !availableAR && !activeAR ? 'AR indisponible sur cet appareil. Découvrir ouvre la consultation 360°.' : '',
      discover: !prepared ? 'Préparez d’abord votre visite.' : activeAR && !scenePlaced ? 'Placez d’abord la scène sur une surface détectée.' : '',
      listen: !prepared ? 'Préparez d’abord votre visite.' : '',
      exit: !prepared && !activeAR ? 'Aucune expérience en cours.' : ''
    };
    for (const button of el('journeyNav').querySelectorAll('button')) {
      const stage = button.dataset.stage;
      button.setAttribute('aria-disabled', String(!!availability[stage]));
      button.title = availability[stage] || ({prepare:'Conseils pour commencer',place:activeAR ? 'Placer ou recaler la scène' : 'Démarrer le placement AR',discover:activeAR ? 'Explorer les repères en AR' : 'Explorer les repères en 360°',listen:'Ouvrir les récits et les transcriptions',exit:'Fermer l’expérience et arrêter les sons'})[stage];
      if (stage === currentStage) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
    }
    el('journeyHint').textContent = !prepared ? 'Commencez par préparer votre découverte.'
      : activeAR ? scenePlaced ? 'La scène est en place · explorez les cinq repères.' : 'Scannez une surface, puis placez la scène.'
      : availableAR ? 'Votre visite est prête · placez la scène ou découvrez en 360°.' : 'AR indisponible ici · découvrez les repères en 360°.';
  }
  function prepareVisit({ scroll = true } = {}) {
    prepared = true; currentStage = 'prepare';
    closePoint(); closeStories(); closePanorama();
    if (activeAR) { el('prepareModal').hidden = false; el('closePrepareButton').focus(); }
    else { el('stepSection').hidden = false; if (scroll) el('stepSection').scrollIntoView({behavior:scrollBehavior(), block:'start'}); }
    updateJourney();
    document.dispatchEvent(new CustomEvent('memoria:prepare'));
  }
  function closePrepare() { el('prepareModal').hidden = true; el('navPrepare').focus(); }
  el('closePrepareButton').addEventListener('click', closePrepare);
  el('prepareModal').addEventListener('click', event => { if (event.target === el('prepareModal')) closePrepare(); });
  el('journeyNav').addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.getAttribute('aria-disabled') === 'true') { showMessage(button.title); return; }
    const stage = button.dataset.stage;
    if (stage === 'prepare') prepareVisit();
    if (stage === 'place') {
      closeStories(); closePoint(); closePanorama();
      if (activeAR) {
        if (el('placeSceneButton').disabled) showMessage('Scannez doucement une surface plane pour faire apparaître le cercle de placement.');
        else api.placeScene();
        currentStage = scenePlaced ? 'discover' : 'place'; updateJourney();
      } else api.startAR();
    }
    if (stage === 'discover') {
      if (activeAR) { closeStories(); closePoint(); api.setMode('visit'); currentStage = 'discover'; updateJourney(); }
      else openPanorama();
    }
    if (stage === 'listen') openStories();
    if (stage === 'exit') { audio.stopAll(); api.exit(); }
  });
  const narrationSection = el('narrationSection');
  const narrationHome = narrationSection.parentNode, narrationNext = narrationSection.nextSibling;
  function openStories() {
    storiesFocus = document.activeElement;
    api.onCardOpen(); closePoint();
    panorama?.setActive(false);
    el('storiesContainer').appendChild(narrationSection); el('storiesModal').hidden = false;
    // Keep the player inside the dialog's accessible tree and keyboard loop.
    el('storiesModal').querySelector('[role="dialog"]').appendChild(el('audioDock'));
    currentStage = 'listen'; updateJourney();
    el('closeStoriesButton').focus();
  }
  function closeStories() {
    if (el('storiesModal').hidden) return;
    el('storiesModal').hidden = true; narrationHome.insertBefore(narrationSection, narrationNext);
    el('audioDock').firstElementChild.open = false;
    audioDockHome.appendChild(el('audioDock'));
    if (!el('panoramaPanel').hidden) panorama?.setActive(true);
    currentStage = activeAR ? scenePlaced ? 'discover' : 'place' : !el('panoramaPanel').hidden ? 'discover' : 'prepare'; updateJourney();
    (storiesFocus?.getClientRects().length ? storiesFocus : el('navListen')).focus(); storiesFocus = null;
  }
  el('arListenButton').addEventListener('click', openStories);
  el('closeStoriesButton').addEventListener('click', closeStories);
  const audio = createAudioController({ onChange: state => {
    el('audioDock').hidden = !state.text && !state.message.startsWith('Lecture');
    el('playerTitle').textContent = state.title || 'Écoute';
    el('playerSource').textContent = state.source;
    const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds) % 60).padStart(2,'0')}`;
    el('playerTime').textContent = state.duration ? `${clock(state.currentTime)} / ${clock(state.duration)}` : '';
    el('audioDock').setAttribute('aria-busy', String(state.loading));
    el('playerMessage').textContent = state.message;
    el('playerTranscript').textContent = state.text;
    el('pauseAudioButton').disabled = !state.playing || state.paused;
    el('resumeAudioButton').disabled = !state.paused;
    el('ambienceStatus').textContent = state.ambience;
    el('arMusicButton').setAttribute('aria-pressed', String(state.musicPlaying));
    el('arMusicButton').setAttribute('aria-label', state.musicPlaying ? 'Couper la musique' : 'Activer la musique');
    el('arMusicButton').title = state.musicPlaying ? 'Couper la musique' : 'Activer la musique';
    el('arMusicStatus').textContent = state.musicPlaying ? 'Petra · musique douce' : state.musicMessage || 'Musique arrêtée';
  } });
  el('arMusicButton').addEventListener('click', () => {
    musicEnabled = !audio.getState().musicPlaying;
    try { localStorage.setItem('memoria-corti:ar-music', musicEnabled ? 'on' : 'off'); } catch {}
    if (musicEnabled) audio.playMusic(step.music.entry); else audio.stopMusic();
  });
  if (!audio.supportsSpeech) {
    el('voiceChoice').value = 'recording'; el('speechOption').disabled = true;
  }
  function fillDeviceVoices() {
    const selected = el('deviceVoiceChoice').value;
    const auto = new Option('Automatique · voix française', '');
    el('deviceVoiceChoice').replaceChildren(auto, ...audio.getSpeechVoices().map(voice => new Option(`${voice.name} · ${voice.lang}`, voice.voiceURI)));
    try { el('deviceVoiceChoice').value = selected || localStorage.getItem('memoria-corti:device-voice') || ''; } catch {}
  }
  fillDeviceVoices(); globalThis.speechSynthesis?.addEventListener('voiceschanged', fillDeviceVoices);
  try {
    // Offer the corrected files once to visitors who tried the device fallback.
    if (localStorage.getItem('memoria-corti:narration-version') !== 'fr-utf8-2') {
      localStorage.setItem('memoria-corti:voice-source', 'recording'); localStorage.setItem('memoria-corti:narration-version', 'fr-utf8-2');
    }
    el('voiceChoice').value = audio.supportsSpeech && localStorage.getItem('memoria-corti:voice-source') === 'speech' ? 'speech' : 'recording';
    el('playbackSpeed').value = ['.85','1','1.15'].includes(localStorage.getItem('memoria-corti:voice-speed')) ? localStorage.getItem('memoria-corti:voice-speed') : '1';
  } catch {}
  el('deviceVoiceLabel').hidden = el('voiceChoice').value !== 'speech'; audio.setRate(el('playbackSpeed').value);
  el('voiceChoice').addEventListener('change', () => {
    audio.stopNarration(); el('deviceVoiceLabel').hidden = el('voiceChoice').value !== 'speech';
    try { localStorage.setItem('memoria-corti:voice-source', el('voiceChoice').value); } catch {}
    if (activePoint) el('listenPointButton').textContent = el('voiceChoice').value === 'speech' ? 'Écouter · voix de l’appareil' : 'Écouter · voix naturelle';
  });
  el('deviceVoiceChoice').addEventListener('change', () => { audio.stopNarration(); try { localStorage.setItem('memoria-corti:device-voice', el('deviceVoiceChoice').value); } catch {} });
  el('playbackSpeed').addEventListener('change', () => { audio.setRate(el('playbackSpeed').value); try { localStorage.setItem('memoria-corti:voice-speed', el('playbackSpeed').value); } catch {} });
  const play = track => {
    el('audioDock').firstElementChild.open = true;
    return audio.play(track, { synthetic: el('voiceChoice').value === 'speech', voiceURI: el('deviceVoiceChoice').value });
  };
  el('stepTitle').textContent = step.title;
  el('stepSubtitle').textContent = step.subtitle;
  el('stepIntroduction').textContent = step.introduction;
  el('historicalNote').textContent = step.historicalNote;
  el('positioningNote').textContent = step.positioning;
  el('stepInstructions').textContent = step.instructions;
  el('welcomeTranscript').textContent = step.narrations.welcome.text;
  el('mainTranscript').textContent = step.narrations.main.text;
  for (const [id, track] of [['welcomeAudioButton',step.narrations.welcome],['mainAudioButton',step.narrations.main]]) {
    if (track.audio?.duration) el(id).querySelector('small').textContent = `${Math.round(track.audio.duration)} s`;
  }
  function makePointButton(point, className = '') {
    const button = document.createElement('button'); button.type = 'button'; button.className = className;
    const title = document.createElement('strong'); title.textContent = point.shortTitle; button.appendChild(title);
    if (className === 'point-card') {
      const date = document.createElement('span'); date.textContent = point.date;
      const question = document.createElement('small'); question.textContent = point.question;
      button.prepend(date); button.appendChild(question);
      const asset = POINT_VISUALS[point.id];
      const visual = document.createElement('img'); visual.className = 'point-card-visual'; visual.src = asset.src;
      visual.alt = asset.alt; visual.loading = 'lazy'; visual.width = 1000; visual.height = 600;
      if (asset.position) visual.style.objectPosition = asset.position;
      button.prepend(visual);
      const visualLabel = document.createElement('span'); visualLabel.className = 'point-visual-label'; visualLabel.textContent = asset.label; button.appendChild(visualLabel);
      if (asset.author) { const credit = document.createElement('small'); credit.className = 'point-photo-credit'; credit.textContent = `${asset.author} · ${asset.license} · Wikimedia Commons`; button.appendChild(credit); }
      const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      arrow.classList.add('icon', 'point-arrow'); arrow.setAttribute('aria-hidden', 'true');
      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use'); use.setAttribute('href', '#icon-arrow'); arrow.appendChild(use); button.appendChild(arrow);
    }
    button.addEventListener('click', () => openPoint(point.id)); return button;
  }
  const leaders = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  leaders.classList.add('hotspot-leaders'); el('poiHotspots').appendChild(leaders);
  const hotspotButtons = new Map(), hotspotLines = new Map();
  for (const point of step.points) {
    el('pointList').appendChild(makePointButton(point, 'point-card'));
    el('fallbackPointList').appendChild(makePointButton(point, 'text-point'));
    const worldButton = document.createElement('button'); worldButton.type = 'button'; worldButton.className = 'world-hotspot';
    worldButton.textContent = point.shortTitle; worldButton.dataset.ui = ''; worldButton.dataset.poi = point.id; worldButton.hidden = true;
    worldButton.addEventListener('click', () => api.onPointAction(point.id)); el('poiHotspots').appendChild(worldButton);
    hotspotButtons.set(point.id, worldButton);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    leaders.appendChild(line); hotspotLines.set(point.id, line);
  }
  for (const date of step.dates) {
    const button = document.createElement('button'); button.type = 'button';
    button.innerHTML = '<span class="timeline-year"></span><span class="timeline-caption"></span>';
    button.children[0].textContent = date.year; button.children[1].textContent = date.title;
    button.addEventListener('click', () => openPoint(date.poiId)); el('timeline').appendChild(button);
  }
  el('openStepButton').addEventListener('click', prepareVisit);
  el('exitStepButton').addEventListener('click', () => api.exit());
  el('startARButton').addEventListener('click', () => { prepared = true; closePanorama(); api.startAR(); });
  el('openPanoramaButton').addEventListener('click', openPanorama);
  el('closePanoramaButton').addEventListener('click', closePanorama);
  el('panoramaResetButton').addEventListener('click', () => panorama?.resetView());
  el('visitModeButton').addEventListener('click', () => api.setMode('visit'));
  el('editModeButton').addEventListener('click', () => api.setMode('edit'));
  el('placeSceneButton').addEventListener('click', () => api.placeScene());
  el('saveLayoutButton').addEventListener('click', () => api.saveLayout());
  el('resetLayoutButton').addEventListener('click', () => api.resetLayout());
  el('welcomeAudioButton').addEventListener('click', () => play(step.narrations.welcome));
  el('mainAudioButton').addEventListener('click', () => play(step.narrations.main));
  el('listenPointButton').addEventListener('click', () => { if (activePoint) play({id:activePoint.id,title:activePoint.title,text:activePoint.transcript,audio:activePoint.audio}); });
  el('pauseAudioButton').addEventListener('click', () => audio.pause());
  el('resumeAudioButton').addEventListener('click', () => audio.resume());
  el('stopAudioButton').addEventListener('click', () => audio.stopNarration());
  el('volumeControl').addEventListener('input', event => audio.setVolume(event.target.value));
  el('ambienceChoice').addEventListener('change', event => audio.setAmbience(step.ambiences.find(item => item.id === event.target.value) || null));
  el('outroMusicButton').disabled = !mediaReady(step.music.exit);
  el('outroMusicButton').addEventListener('click', () => audio.playMusic(step.music.exit));
  el('closePointButton').addEventListener('click', closePoint);
  el('poiModal').addEventListener('click', event => { if (event.target === el('poiModal')) closePoint(); });
  el('viewARButton').addEventListener('click', () => { const id = activePoint?.id; closePoint(); if (id) api.viewInAR(id); });
  el('enlargeImageButton').addEventListener('click', () => {
    if (!mediaReady(activePoint?.image)) return;
    el('archiveImage').src = activePoint.image.src; el('archiveImage').alt = activePoint.image.caption;
    el('archiveCaption').textContent = el('pointCaption').textContent; el('archiveModal').hidden = false; el('closeArchiveButton').focus();
  });
  el('closeArchiveButton').addEventListener('click', closeArchive);
  el('archiveZoom').addEventListener('input', event => { el('archiveImage').style.width = Number(event.target.value) * 100 + '%'; });
  el('nextStageButton').addEventListener('click', () => { closePoint(); el('routeModal').hidden = false; el('closeRouteButton').focus(); });
  el('closeRouteButton').addEventListener('click', () => { el('routeModal').hidden = true; });
  el('routeCurrentButton').addEventListener('click', () => { el('routeModal').hidden = true; el('navPrepare').focus(); prepareVisit(); });
  document.addEventListener('keydown', event => {
    const modal = !el('prepareModal').hidden ? el('prepareModal') : !el('archiveModal').hidden ? el('archiveModal') : !el('poiModal').hidden ? el('poiModal') : !el('storiesModal').hidden ? el('storiesModal') : !el('routeModal').hidden ? el('routeModal') : null;
    if (event.key === 'Escape' && modal) { event.preventDefault(); if (modal.id === 'prepareModal') closePrepare(); else if (modal.id === 'archiveModal') closeArchive(); else if (modal.id === 'poiModal') closePoint(); else if (modal.id === 'storiesModal') closeStories(); else el('routeModal').hidden = true; }
    else if (event.key === 'Escape' && !el('panoramaPanel').hidden) { event.preventDefault(); closePanorama(); }
    if (event.key === 'Tab' && modal) {
      const buttons = [...modal.querySelectorAll('button:not(:disabled), a[href], input, select, summary')].filter(node => !node.hidden && node.getClientRects().length);
      if (!buttons.length) return;
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1).focus(); }
      if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus(); }
    }
  });
  function showMessage(message) {
    el('experienceNotice').textContent = message; el('experienceNotice').hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el('experienceNotice').hidden = true; }, 6500);
  }
  function sourceLink(source) {
    const a = document.createElement('a'); a.href = source.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = source.title; return a;
  }
  function openPoint(id) {
    const point = findPoint(id, step); if (!point || activePoint?.id === id && !el('poiModal').hidden) return;
    document.dispatchEvent(new CustomEvent('memoria:point', { detail: { id } }));
    closeStories(); api.onCardOpen(); audio.stopNarration(); focusBefore = document.activeElement; activePoint = point;
    panorama?.setActive(false);
    el('pointTitle').textContent = point.title; el('pointDate').textContent = point.date;
    el('missingImage').dataset.illustration = point.id === 'corte' ? 'corte' : 'savoir';
    el('pointQuestion').textContent = point.question; el('pointText').textContent = point.text;
    el('pointTranscript').textContent = point.transcript;
    el('pointStatus').textContent = 'Repères documentés · scène d’évocation';
    el('pointAudioStatus').textContent = mediaReady(point.audio) ? 'Narration française disponible · voix IA naturelle' : 'Audio à fournir · synthèse vocale facultative';
    el('listenPointButton').textContent = el('voiceChoice').value === 'speech' ? 'Écouter · voix de l’appareil' : 'Écouter · voix naturelle';
    el('pointImage').hidden = !mediaReady(point.image); el('missingImage').hidden = mediaReady(point.image);
    el('missingImage').textContent = point.image.label;
    el('enlargeImageButton').disabled = !mediaReady(point.image);
    if (mediaReady(point.image)) {
      el('pointImage').src = point.image.src; el('pointImage').alt = point.image.caption;
      el('pointImage').onerror = () => { el('pointImage').hidden = true; el('missingImage').hidden = false; el('missingImage').textContent = 'Image indisponible'; el('enlargeImageButton').disabled = true; };
    }
    el('pointCaption').textContent = [point.image.caption, point.image.date || 'Date de l’image à documenter', point.image.credit || 'Crédit à fournir', point.image.rights.label || 'Droits à fournir'].join(' · ');
    el('pointSources').replaceChildren(...point.sources.map(sourceLink));
    el('nextStageButton').hidden = !point.next;
    el('comparison').hidden = true;
    const pair = step.beforeAfter;
    if (pair?.samePlace === true && mediaReady(pair.before) && mediaReady(pair.after)) {
      el('comparison').hidden = false; el('beforeImage').src = pair.before.src; el('afterImage').src = pair.after.src;
      el('beforeImage').alt = pair.before.caption; el('afterImage').alt = pair.after.caption;
      el('beforeCaption').textContent = [pair.before.date, pair.before.credit, pair.before.rights.label].filter(Boolean).join(' · ');
      el('afterCaption').textContent = [pair.after.date, pair.after.credit, pair.after.rights.label].filter(Boolean).join(' · ');
    }
    el('poiModal').hidden = false; el('poiModal').querySelector('[role="dialog"]').appendChild(el('audioDock')); el('closePointButton').focus();
  }
  function closeArchive() { el('archiveModal').hidden = true; el('archiveImage').removeAttribute('src'); el('archiveImage').style.width = '100%'; el('archiveZoom').value = 1; el('enlargeImageButton').focus(); }
  function closePoint() {
    if (!el('archiveModal').hidden) closeArchive();
    el('poiModal').hidden = true; activePoint = null; audio.stopNarration();
    audioDockHome.appendChild(el('audioDock'));
    if (activeAR) el('audioDock').firstElementChild.open = false;
    if (!el('panoramaPanel').hidden) panorama?.setActive(true);
    focusBefore?.focus(); focusBefore = null;
  }
  function openPanorama() {
    if (activeAR) { showMessage('Quittez la session AR pour ouvrir la consultation 360°.'); return; }
    panoramaFocus = document.activeElement; prepared = true; closeStories(); closePoint(); el('panoramaPanel').hidden = false;
    el('homeView').inert = true;
    currentStage = 'discover'; updateJourney(); el('closePanoramaButton').focus();
    el('panoramaMissing').textContent = mediaReady(step.panorama) ? step.panorama.title : 'Panorama à fournir — repères dans un espace de consultation neutre.';
    el('panoramaCredit').textContent = mediaReady(step.panorama) ? step.panorama.credit || 'Crédit à renseigner' : 'Aucune photographie du lieu n’est simulée. Le calage des points sur la future photographie reste à faire.';
    el('panoramaLoadStatus').textContent = 'Chargement du panorama…';
    if (!panorama) {
      try { panorama = createPanorama(el('panoramaScene'), step, openPoint); }
      catch (error) { el('panoramaLoadStatus').textContent = 'Vue 3D indisponible. Retrouvez les cinq fiches ci-dessous.'; showMessage('Vue 3D indisponible. Les cinq fiches restent accessibles ci-dessous.'); console.error('Consultation 360°', error); }
    } else { panorama.setActive(true); el('panoramaLoadStatus').textContent = el('panoramaScene').dataset.state === 'ready' ? 'Panorama prêt · glissez pour explorer' : el('panoramaScene').dataset.state === 'error' ? 'Image indisponible · les fiches restent accessibles' : 'Chargement du panorama…'; }
  }
  el('panoramaScene').addEventListener('panoramaready', () => { el('panoramaLoadStatus').textContent = 'Panorama prêt · glissez pour explorer'; });
  el('panoramaScene').addEventListener('panoramaerror', () => { el('panoramaLoadStatus').textContent = 'Image indisponible · les cinq fiches restent accessibles'; });
  function closePanorama() {
    const wasOpen = !el('panoramaPanel').hidden;
    panorama?.setActive(false); el('panoramaPanel').hidden = true;
    el('homeView').inert = false;
    if (wasOpen) { currentStage = 'prepare'; updateJourney(); panoramaFocus?.focus(); panoramaFocus = null; }
  }
  function setMode(next) {
    mode = next; el('visitModeButton').setAttribute('aria-pressed', String(mode === 'visit')); el('editModeButton').setAttribute('aria-pressed', String(mode === 'edit'));
    document.getElementById('content').dataset.mode = mode;
    el('saveLayoutButton').hidden = mode !== 'edit'; el('resetLayoutButton').hidden = mode !== 'edit';
    el('modeDescription').textContent = mode === 'visit' ? 'Touchez les repères. La scène reste en place.' : 'Touchez un objet pour le déplacer, le tourner ou le supprimer.';
  }
  function setARState(value) {
    activeAR = value; closeStories(); closePoint(); closePanorama(); el('homeView').hidden = value;
    el('prepareModal').hidden = true;
    if (value) prepared = true;
    currentStage = value ? 'place' : 'prepare'; updateJourney();
    el('arToolbar').hidden = !value; el('sceneControls').hidden = !value;
    el('arTools').open = false;
    if (value && musicEnabled) audio.playMusic(step.music.entry);
    if (!value) { audio.stopAll(); el('audioDock').hidden = true; el('routeModal').hidden = true; el('ambienceChoice').value = ''; }
    el('mySidenav').classList.remove('open');
    document.dispatchEvent(new CustomEvent('memoria:ar', { detail: { active: value } }));
  }
  function setAvailability(available, message) {
    availableAR = available; el('arAvailability').textContent = message;
    el('startARButton').disabled = !available;
    updateJourney();
  }
  return {
    openPoint, closePoint, openPanorama, closePanorama, openStories, closeStories, prepareVisit, showMessage, setMode, setARState, setAvailability,
    unlockARAudio: () => { if (musicEnabled) audio.unlockMusic().catch(() => {}); },
    stopSounds: () => audio.stopAll(),
    setScenePlaced(placed) { scenePlaced = placed; el('placeSceneButton').textContent = placed ? 'Recaler la scène' : 'Placer la scène'; if (activeAR) currentStage = placed ? 'discover' : 'place'; updateJourney(); },
    setPlacementReady(ready) { el('placeSceneButton').disabled = !ready; },
    updateHotspots(projected) {
      const visible = activeAR && mode === 'visit' && el('poiModal').hidden && el('storiesModal').hidden;
      const measured = [...hotspotButtons].map(([id,button]) => {
        const point = projected.find(item => item.id === id);
        button.hidden = !visible || !point?.visible;
        return { ...point, id, visible: !button.hidden, width: button.offsetWidth, height: button.offsetHeight };
      });
      const positions = layoutHotspots(measured, {
        width: el('content').clientWidth,
        top: el('arToolbar').getBoundingClientRect().bottom + 12,
        bottom: el('sceneControls').getBoundingClientRect().top - 12
      });
      for (const [id,button] of hotspotButtons) {
        const position = positions.get(id), line = hotspotLines.get(id);
        button.hidden = !position;
        line.style.display = position ? '' : 'none';
        if (position) {
          button.style.left = position.x + 'px'; button.style.top = position.y + 'px';
          line.setAttribute('x1',position.x);line.setAttribute('y1',position.y);
          line.setAttribute('x2',position.anchorX);line.setAttribute('y2',position.anchorY);
        }
      }
    },
    leave() { setARState(false); prepared = false; scenePlaced = false; updateJourney(); el('stepSection').hidden = true; el('homeView').scrollTop = 0; panorama?.dispose(); panorama = null; clearTimeout(toastTimer); el('experienceNotice').hidden = true; document.dispatchEvent(new CustomEvent('memoria:leave')); },
    getState: () => ({ activeAR, mode, activePoint: activePoint?.id || null, availableAR }),
    audio
  };
}
