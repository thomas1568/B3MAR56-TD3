import { findPoint, mediaReady } from '../content/iut.js';
import { createAudioController } from './audio.js';
import { createPanorama } from './panorama.js';
import { layoutHotspots } from './hotspots.js';

export function createExperience(step, api) {
  const el = id => document.getElementById(id);
  let activePoint = null, activeAR = false, mode = 'visit', availableAR = false, panorama = null, focusBefore = null, toastTimer = null;
  const narrationSection = el('narrationSection');
  const narrationHome = narrationSection.parentNode, narrationNext = narrationSection.nextSibling;
  function openStories() {
    api.onCardOpen(); closePoint();
    el('storiesContainer').appendChild(narrationSection); el('storiesModal').hidden = false;
    el('closeStoriesButton').focus();
  }
  function closeStories() {
    if (el('storiesModal').hidden) return;
    el('storiesModal').hidden = true; narrationHome.insertBefore(narrationSection, narrationNext);
    el('audioDock').firstElementChild.open = false;
    if (activeAR) el('arListenButton').focus();
  }
  el('arListenButton').addEventListener('click', openStories);
  el('closeStoriesButton').addEventListener('click', closeStories);
  const audio = createAudioController({ onChange: state => {
    el('audioDock').hidden = !state.text && !state.message.startsWith('Lecture');
    el('playerTitle').textContent = state.title || 'Écoute';
    el('playerSource').textContent = state.source;
    el('playerMessage').textContent = state.message;
    el('playerTranscript').textContent = state.text;
    el('pauseAudioButton').disabled = !state.playing || state.paused;
    el('resumeAudioButton').disabled = !state.paused;
    el('ambienceStatus').textContent = state.ambience;
  } });
  if (!audio.supportsSpeech) {
    el('voiceChoice').value = 'recording'; el('speechOption').disabled = true;
  }
  const play = track => {
    el('audioDock').firstElementChild.open = true;
    return audio.play(track, { synthetic: el('voiceChoice').value === 'speech' });
  };
  el('stepTitle').textContent = step.title;
  el('stepSubtitle').textContent = step.subtitle;
  el('stepIntroduction').textContent = step.introduction;
  el('historicalNote').textContent = step.historicalNote;
  el('positioningNote').textContent = step.positioning;
  el('stepInstructions').textContent = step.instructions;
  el('welcomeTranscript').textContent = step.narrations.welcome.text;
  el('mainTranscript').textContent = step.narrations.main.text;
  function makePointButton(point, className = '') {
    const button = document.createElement('button'); button.type = 'button'; button.className = className;
    const title = document.createElement('strong'); title.textContent = point.shortTitle; button.appendChild(title);
    if (className === 'point-card') {
      const date = document.createElement('span'); date.textContent = point.date;
      const question = document.createElement('small'); question.textContent = point.question;
      button.prepend(date); button.appendChild(question);
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
  el('openStepButton').addEventListener('click', () => {
    el('stepSection').hidden = false; el('stepSection').scrollIntoView({behavior:'smooth', block:'start'});
  });
  el('exitStepButton').addEventListener('click', () => api.exit());
  el('startARButton').addEventListener('click', () => { closePanorama(); api.startAR(); });
  el('openPanoramaButton').addEventListener('click', openPanorama);
  el('closePanoramaButton').addEventListener('click', closePanorama);
  el('visitModeButton').addEventListener('click', () => api.setMode('visit'));
  el('editModeButton').addEventListener('click', () => api.setMode('edit'));
  el('placeSceneButton').addEventListener('click', () => api.placeScene());
  el('saveLayoutButton').addEventListener('click', () => api.saveLayout());
  el('resetLayoutButton').addEventListener('click', () => api.resetLayout());
  el('welcomeAudioButton').addEventListener('click', () => { play(step.narrations.welcome); audio.playMusic(step.music.entry); });
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
  el('routeCurrentButton').addEventListener('click', () => { el('routeModal').hidden = true; el('stepSection').hidden = false; });
  document.addEventListener('keydown', event => {
    const modal = !el('archiveModal').hidden ? el('archiveModal') : !el('poiModal').hidden ? el('poiModal') : !el('storiesModal').hidden ? el('storiesModal') : !el('routeModal').hidden ? el('routeModal') : null;
    if (event.key === 'Escape' && modal) { event.preventDefault(); if (modal.id === 'archiveModal') closeArchive(); else if (modal.id === 'poiModal') closePoint(); else if (modal.id === 'storiesModal') closeStories(); else el('routeModal').hidden = true; }
    if (event.key === 'Tab' && modal) {
      const buttons = [...modal.querySelectorAll('button:not(:disabled), a[href], input, select')].filter(node => !node.hidden && node.getClientRects().length);
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
    closeStories(); api.onCardOpen(); audio.stopNarration(); focusBefore = document.activeElement; activePoint = point;
    panorama?.setActive(false);
    el('pointTitle').textContent = point.title; el('pointDate').textContent = point.date;
    el('pointQuestion').textContent = point.question; el('pointText').textContent = point.text;
    el('pointTranscript').textContent = point.transcript;
    el('pointStatus').textContent = 'Repères documentés · scène d’évocation';
    el('pointAudioStatus').textContent = mediaReady(point.audio) ? 'Enregistrement disponible' : 'Audio à fournir · synthèse vocale facultative';
    el('listenPointButton').textContent = el('voiceChoice').value === 'speech' ? 'Écouter · synthèse vocale' : 'Écouter';
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
    el('poiModal').hidden = false; el('closePointButton').focus();
  }
  function closeArchive() { el('archiveModal').hidden = true; el('archiveImage').removeAttribute('src'); el('archiveImage').style.width = '100%'; el('archiveZoom').value = 1; el('enlargeImageButton').focus(); }
  function closePoint() {
    if (!el('archiveModal').hidden) closeArchive();
    el('poiModal').hidden = true; activePoint = null; audio.stopNarration();
    if (activeAR) el('audioDock').firstElementChild.open = false;
    if (!el('panoramaPanel').hidden) panorama?.setActive(true);
    focusBefore?.focus(); focusBefore = null;
  }
  function openPanorama() {
    if (activeAR) { showMessage('Quittez la session AR pour ouvrir la consultation 360°.'); return; }
    closePoint(); el('panoramaPanel').hidden = false;
    el('panoramaMissing').textContent = mediaReady(step.panorama) ? 'Consultation 360°' : 'Panorama à fournir — repères dans un espace de consultation neutre.';
    el('panoramaCredit').textContent = mediaReady(step.panorama) ? step.panorama.credit || 'Crédit à renseigner' : 'Aucune photographie du lieu n’est simulée. Le calage des points sur la future photographie reste à faire.';
    if (!panorama) {
      try { panorama = createPanorama(el('panoramaScene'), step, openPoint); }
      catch (error) { showMessage('Vue 3D indisponible. Les cinq fiches restent accessibles ci-dessous.'); console.error('Consultation 360°', error); }
    } else panorama.setActive(true);
  }
  el('panoramaScene').addEventListener('panoramaerror', () => { el('panoramaMissing').textContent = 'Panorama indisponible — consultation des repères'; });
  function closePanorama() { panorama?.setActive(false); el('panoramaPanel').hidden = true; }
  function setMode(next) {
    mode = next; el('visitModeButton').setAttribute('aria-pressed', String(mode === 'visit')); el('editModeButton').setAttribute('aria-pressed', String(mode === 'edit'));
    document.getElementById('content').dataset.mode = mode;
    el('saveLayoutButton').hidden = mode !== 'edit'; el('resetLayoutButton').hidden = mode !== 'edit';
    el('modeDescription').textContent = mode === 'visit' ? 'Touchez les repères. La scène reste en place.' : 'Touchez un objet pour le déplacer, le tourner ou le supprimer.';
  }
  function setARState(value) {
    activeAR = value; closeStories(); closePoint(); closePanorama(); el('homeView').hidden = value;
    el('arToolbar').hidden = !value; el('sceneControls').hidden = !value;
    if (!value) { audio.stopAll(); el('audioDock').hidden = true; el('routeModal').hidden = true; el('ambienceChoice').value = ''; }
    el('mySidenav').classList.remove('open');
  }
  function setAvailability(available, message) {
    availableAR = available; el('arAvailability').textContent = message;
    el('startARButton').disabled = !available;
  }
  return {
    openPoint, closePoint, openPanorama, showMessage, setMode, setARState, setAvailability,
    stopSounds: () => audio.stopAll(),
    setScenePlaced(placed) { el('placeSceneButton').textContent = placed ? 'Recaler la scène' : 'Placer la scène'; },
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
        top: el('arStatus').getBoundingClientRect().bottom + 12,
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
    leave() { setARState(false); el('stepSection').hidden = true; el('homeView').scrollTop = 0; panorama?.dispose(); panorama = null; clearTimeout(toastTimer); el('experienceNotice').hidden = true; },
    getState: () => ({ activeAR, mode, activePoint: activePoint?.id || null, availableAR }),
    audio
  };
}
