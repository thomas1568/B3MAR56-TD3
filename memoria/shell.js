import { createAccount, validatePhoto, validatePseudo } from './account.js?v=16';
import { AVATARS, renderAvatar } from './avatars.js';
import { createTabNavigation } from './navigation.js?v=16';

const icon = name => `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"/></svg>`;
export function createShell(experience, step) {
  const root = document.getElementById('content');
  const el = id => document.getElementById(id);
  const account = createAccount();
  let state = account.getState(), page = 'home', inStep = false, settingUp = false, authMode = 'signup', busy = false;
  let draft = { ...state.profile }, cropImage = null, cropBefore = null, profileReturn = null, uploadGeneration = 0;
  let tabNavigation = null;
  const pages = ['home', 'explore', 'route', 'listen', 'profile'];
  const scrollPositions = new Map();
  const app = document.createElement('main'); app.id = 'appView'; app.dataset.ui = '';
  app.innerHTML = `
    <header class="site-header app-header"><a class="brand" href="#accueil" data-page="home"><span class="seal">MC</span><span>Memoria <em>Corti</em><small>Des lieux. Des voix. Une mémoire.</small></span></a><div class="header-end"><span class="location-chip">${icon('pin')}Corte · Corse</span><button id="headerProfile" class="profile-shortcut" aria-label="Ouvrir mon profil" data-page="profile"><span data-profile-avatar class="avatar"></span></button></div></header>
    <section id="page-home" class="app-page" aria-labelledby="greeting"><div class="welcome-line"><div><p class="eyebrow">BENVENUTI IN CORTI</p><h1 id="greeting">Bonghjornu.</h1><p class="page-subtitle">Chaque lieu a une histoire. La vôtre commence ici.</p></div><span id="sessionBadge" class="subtle-badge"></span></div>
      <article id="resumeCard" class="resume-card" hidden><img class="resume-thumbnail" src="assets/savoir-illustration.svg" alt="Illustration du livre ouvert de l’étape IUT" width="100" height="100"><div><p class="eyebrow">VOTRE PARCOURS EN COURS</p><h2>Reprendre ma découverte</h2><p id="resumeDescription"></p><progress id="resumeProgress" max="5" value="0" aria-label="Repères consultés à l’IUT"></progress></div><button id="resumeButton" class="primary">Reprendre ${icon('arrow')}</button></article>
      <article class="feature-card"><img src="assets/corte-illustration.svg" alt="Illustration originale et symbolique de Corte, entre montagnes et citadelle" width="1000" height="600"><div class="feature-overlay"><span class="visual-label">Illustration · Corte</span><p class="eyebrow">UN TERRITOIRE À RENCONTRER</p><h2>Corte se raconte.<br>À vous de l’explorer.</h2><p>Des lieux de savoir aux voix de la ville, suivez le fil des mémoires.</p><button class="light-button" data-page="explore">Explorer Corte ${icon('arrow')}</button></div></article>
      <div class="section-heading"><div><p class="eyebrow">LES LIEUX, AUTREMENT</p><h2>Explorer Corte</h2></div><button class="text-button" data-page="explore">Tout explorer ${icon('arrow')}</button></div><div id="homePlaces" class="editorial-grid"></div>
      <div class="section-heading"><div><p class="eyebrow">PRENEZ LE TEMPS</p><h2>À écouter</h2></div><button class="text-button" data-page="listen">Les récits ${icon('arrow')}</button></div><div id="homeStories" class="story-grid"></div>
      <div class="quiet-note">${icon('route')}<p>L’IUT ouvre le parcours. Les autres étapes de Corte se préparent, une histoire après l’autre.</p></div>
    </section>
    <section id="page-explore" class="app-page" hidden aria-labelledby="exploreTitle"><p class="eyebrow">LES MÉMOIRES D’UN TERRITOIRE</p><h1 id="exploreTitle">Explorer Corte</h1><p class="page-subtitle">Des lieux à observer, des histoires à rencontrer.</p><div class="filter-row" role="group" aria-label="Filtrer les lieux"><button id="filterAll" aria-pressed="true">Tous les lieux</button><button id="filterAvailable" aria-pressed="false">Disponibles</button><button id="filterComing" aria-pressed="false">À venir</button></div><div id="explorePlaces" class="editorial-grid"></div><p class="small-note">Les visuels sont des illustrations originales. Les photographies documentées du parcours restent à fournir.</p></section>
    <section id="page-route" class="app-page" hidden aria-labelledby="routeTitle"><p class="eyebrow">UN FIL ENTRE LES LIEUX</p><h1 id="routeTitle">Mon parcours</h1><p class="page-subtitle">Une première étape à découvrir. D’autres mémoires à venir.</p><div class="route-summary"><div><span id="routeCount" class="large-number">0 / 5</span><p>repères consultés à l’IUT</p></div><div><h2>Corte, une ville de savoir</h2><p id="routeDescription">Votre découverte commence sur le campus Grimaldi.</p><progress id="routeProgress" max="5" value="0" aria-label="Progression de l’étape IUT"></progress></div></div><ol class="route-steps"><li><span class="route-marker">01</span><div><span class="status-pill">Disponible</span><h2>L’IUT de Corse</h2><p>Apprendre, transmettre et relier les mémoires de l’université.</p><button id="routeStartButton" class="primary">Découvrir l’étape ${icon('arrow')}</button></div></li><li><span class="route-marker muted-marker">02</span><div><span class="status-pill coming">À venir</span><h2>Le Palazzu Naziunale</h2><p>L’université historique, un autre lieu de savoir. Cette étape est en préparation.</p><button data-coming="Le Palazzu Naziunale">En savoir plus</button></div></li></ol></section>
    <section id="page-listen" class="app-page" hidden aria-labelledby="listenTitle"><p class="eyebrow">LES HISTOIRES PRENNENT VOIX</p><h1 id="listenTitle">À écouter</h1><p class="page-subtitle">Choisissez un récit, ou prenez le temps de le lire.</p><div class="listen-intro">${icon('listen')}<p>Les transcriptions sont disponibles. La synthèse vocale lit les textes ; les enregistrements originaux restent à fournir.</p></div><div id="listenStories" class="story-grid"></div><div class="section-heading"><h2>Les voix de demain</h2></div><article class="empty-card">${icon('listen')}<div><span class="status-pill coming">À venir</span><h3>Des mémoires à partager</h3><p>De futurs récits et témoignages enrichiront la découverte de Corte.</p></div></article></section>
    <section id="page-profile" class="app-page" hidden aria-labelledby="profileTitle"><p class="eyebrow">VOTRE REGARD SUR CORTE</p><h1 id="profileTitle">Mon profil</h1><div class="profile-layout"><div><div class="profile-identity"><span class="avatar avatar-large" data-profile-avatar></span><div><h2 id="profileName"></h2><p id="profileConnection" class="small-note"></p></div></div><div id="profileEditorHome"></div></div><aside class="profile-aside"><p class="eyebrow">VOTRE DÉCOUVERTE</p><h2 id="profileProgressTitle">Le premier pas vous attend.</h2><p id="profileProgressText"></p><button id="profileResume">Retrouver mon parcours ${icon('arrow')}</button><div class="profile-account"><p id="profileStorageNote" class="small-note"></p><button id="connectFromProfile">Créer un compte ou se connecter</button><button id="logoutButton">Se déconnecter ${icon('exit')}</button></div></aside></div></section>
    <footer class="site-footer"><span>Memoria Corti · La mémoire en mouvement</span><span>Corte, des lieux à rencontrer</span></footer>`;
  root.prepend(app);

  const dock = document.createElement('div'); dock.id = 'appDock'; dock.className = 'journey-dock'; dock.dataset.ui = '';
  dock.innerHTML = `<nav class="journey-nav app-nav" aria-label="Navigation principale">${[['home','Accueil','home'],['explore','Explorer','discover'],['route','Parcours','route'],['listen','Écouter','listen'],['profile','Profil','']].map(([id,label,symbol]) => `<button id="tab-${id}" class="journey-item" data-page="${id}" type="button">${symbol ? icon(symbol) : '<span data-profile-avatar class="avatar nav-avatar"></span>'}<span>${label}</span></button>`).join('')}</nav>`;
  root.appendChild(dock);
  const overlay = document.createElement('section'); overlay.id = 'onboarding'; overlay.className = 'onboarding'; overlay.dataset.ui = ''; overlay.hidden = true;
  overlay.innerHTML = `<div class="onboarding-brand"><span class="seal">MC</span><span>Memoria <em>Corti</em></span></div><div id="onboardingWelcome" class="onboarding-screen"><span class="welcome-medallion">${icon('discover')}</span><p class="eyebrow">BENVENUTI IN CORTI</p><h1>Les lieux passent.<br>Les mémoires restent.</h1><p class="onboarding-lead">Bienvenue à Corte. Partez à la rencontre d’une ville, de ses voix et de ce qu’elle nous transmet.</p><div class="onboarding-actions"><button id="signupButton" class="primary">Créer mon profil ${icon('arrow')}</button><button id="createAccountButton" hidden>Créer un compte connecté</button><button id="signinButton">J’ai déjà un compte</button><button id="guestButton" class="text-button">Continuer en invité</button></div><p class="small-note">Un pseudo, une image, et votre découverte peut commencer.<br>Le profil invité est conservé sur cet appareil.</p></div>
    <div id="onboardingAuth" class="onboarding-screen" hidden><button id="authBack" class="text-button">← Retour</button><p class="eyebrow">01 / VOTRE CONNEXION</p><h1 id="authTitle">Créer mon compte</h1><p id="authDescription" class="onboarding-lead"></p><form id="authForm" novalidate><label for="emailInput">Adresse e-mail</label><input id="emailInput" name="email" type="email" autocomplete="email" required aria-describedby="authMessage" placeholder="vous@exemple.fr"><label for="passwordInput">Mot de passe</label><input id="passwordInput" name="password" type="password" autocomplete="new-password" required aria-describedby="authMessage"><p class="small-note" id="passwordHelp">Au moins 8 caractères.</p><p id="authMessage" class="form-message" role="status" aria-live="polite"></p><button id="authSubmit" class="primary" type="submit">Créer mon compte</button></form><button id="authSwitch" class="text-button">J’ai déjà un compte</button><button id="authGuest" class="text-button">Découvrir en invité</button></div>
    <div id="onboardingSetup" class="onboarding-screen setup-screen" hidden><p class="eyebrow">02 / UN PROFIL QUI VOUS RESSEMBLE</p><h1>Et vous,<br>comment vous appelez-vous ?</h1><p id="setupModeNote" class="small-note"></p><div id="setupEditorHome"></div></div><p id="onboardingStatus" class="form-message" role="status" aria-live="polite"></p>`;
  root.appendChild(overlay);
  const form = document.createElement('form'); form.id = 'profileForm'; form.noValidate = true;
  form.innerHTML = `<label for="pseudoInput">Votre pseudo</label><input id="pseudoInput" name="pseudo" type="text" minlength="3" maxlength="24" autocomplete="nickname" required placeholder="Votre prénom ou votre pseudo" aria-describedby="pseudoHelp profileMessage"><p id="pseudoHelp" class="small-note">3 à 24 caractères. Votre adresse e-mail ne sera pas affichée.</p><fieldset><legend>Choisissez votre avatar</legend><div id="avatarChoices" class="avatar-grid"></div></fieldset><div class="photo-import"><label for="photoInput" class="upload-button">Importer ma photo ${icon('arrow')}</label><input id="photoInput" class="sr-only" type="file" accept="image/jpeg,image/png,image/webp"><p class="small-note">JPEG, PNG ou WebP · 5 Mo maximum.<br>Recadrez votre photo avant de la confirmer.</p></div><div class="selected-avatar"><span class="avatar avatar-preview" id="profilePreview"></span><span id="avatarSelectionLabel" class="small-note"></span><button id="removePhotoButton" type="button" hidden>Revenir à un avatar</button></div><p id="profileMessage" class="form-message" role="status" aria-live="polite"></p><button id="saveProfileButton" class="primary" type="submit">Enregistrer mon profil</button>`;
  el('profileEditorHome').appendChild(form);
  const crop = document.createElement('div'); crop.id = 'cropModal'; crop.className = 'modal-backdrop crop-modal'; crop.dataset.ui = ''; crop.hidden = true;
  crop.innerHTML = `<article class="content-card" role="dialog" aria-modal="true" aria-labelledby="cropTitle"><header><div><p class="eyebrow">VOTRE PHOTO</p><h2 id="cropTitle">Un visage dans un cercle</h2></div><button id="cancelCrop" type="button">Annuler</button></header><div class="card-scroll"><p class="small-note">Glissez l’image ou utilisez les curseurs. Le carré recadré sera affiché dans un cercle.</p><canvas id="cropCanvas" width="640" height="640" tabindex="0" aria-label="Aperçu du recadrage ; utilisez les curseurs pour ajuster la photo"></canvas><label for="cropZoom">Zoom</label><input id="cropZoom" type="range" min="1" max="3" step="0.01" value="1"><label for="cropX">Position horizontale</label><input id="cropX" type="range" min="-1" max="1" step="0.01" value="0"><label for="cropY">Position verticale</label><input id="cropY" type="range" min="-1" max="1" step="0.01" value="0"><p id="cropMessage" role="status" class="form-message"></p><button id="confirmCrop" type="button" class="primary">Utiliser cette photo</button></div></article>`;
  root.appendChild(crop);
  const upcoming = document.createElement('div'); upcoming.id = 'comingModal'; upcoming.className = 'modal-backdrop'; upcoming.dataset.ui = ''; upcoming.hidden = true;
  upcoming.innerHTML = `<article class="content-card" role="dialog" aria-modal="true" aria-labelledby="comingTitle"><header><div><p class="eyebrow">LE PARCOURS S’ÉTOFFE</p><h2 id="comingTitle"></h2></div><button id="closeComing">Fermer</button></header><div class="card-scroll"><img class="coming-visual" src="assets/corte-illustration.svg" alt="Illustration symbolique de Corte"><p>Cette étape est en préparation. Ses contenus, médias et repères AR ne sont pas encore disponibles.</p><button id="comingStart" class="primary">Découvrir la première étape : l’IUT</button></div></article>`;
  root.appendChild(upcoming);
  const back = document.createElement('button'); back.id = 'backToApp'; back.type = 'button'; back.className = 'text-button'; back.textContent = '← Accueil';
  el('homeView').querySelector('.site-header').appendChild(back); back.addEventListener('click', () => showPage('home'));
  el('homeView').querySelector('.brand').addEventListener('click', event => { event.preventDefault(); showPage('home'); });

  const places = [
    { id: 'iut', title: 'Corte, une ville de savoir', description: 'De Pasquale Paoli aux étudiants d’aujourd’hui. Première étape : l’IUT de Corse.', image: 'savoir', status: 'Étape 01 · Disponible', action: 'Découvrir l’IUT', available: true },
    { id: 'palazzu', title: 'Le Palazzu Naziunale', description: 'Un autre lieu, aux origines de l’histoire universitaire de Corte.', image: 'corte', status: 'Étape 02 · À venir', action: 'En savoir plus', available: false }
  ];
  function placeCard(item) {
    const article = document.createElement('article'); article.className = 'editorial-card';
    article.innerHTML = `<div class="card-visual"><img src="assets/${item.image}-illustration.svg" alt="Illustration symbolique ${item.available ? 'de la transmission du savoir' : 'de Corte'}" width="1000" height="600" loading="lazy"><span class="visual-label">Illustration</span></div><div class="editorial-card-body"><span class="status-pill ${item.available ? '' : 'coming'}"></span><h3></h3><p></p><button class="${item.available ? 'primary' : ''}"></button></div>`;
    article.querySelector('.status-pill').textContent = item.status; article.querySelector('h3').textContent = item.title; article.querySelector('p').textContent = item.description;
    const button = article.querySelector('button'); button.textContent = item.action; button.addEventListener('click', () => item.available ? startStep() : openComing(item.title)); return article;
  }
  function renderPlaces(filter = 'all') {
    el('explorePlaces').replaceChildren(...places.filter(item => filter === 'all' || item.available === (filter === 'available')).map(placeCard));
  }
  el('homePlaces').replaceChildren(...places.map(placeCard)); renderPlaces();
  const stories = [
    { id: 'welcome', title: step.narrations.welcome.title, description: 'Le campus Grimaldi ouvre les portes de votre découverte.', action: 'Lire ou écouter l’accueil' },
    { id: 'main', title: step.narrations.main.title, description: '1765, 1981, 1983 : trois repères pour comprendre et transmettre.', action: 'Lire ou écouter le récit' }
  ];
  function storyCard(item) {
    const article = document.createElement('article'); article.className = 'story-card';
    article.innerHTML = `<div class="story-visual"><img src="assets/voix-illustration.svg" alt="Illustration d’ondes sonores" width="1000" height="600" loading="lazy">${icon('listen')}</div><div><span class="eyebrow">TEXTE & SYNTHÈSE VOCALE</span><h3></h3><p></p><button class="text-button"></button></div>`;
    article.querySelector('h3').textContent = item.title; article.querySelector('p').textContent = item.description; const button = article.querySelector('button'); button.textContent = item.action;
    button.addEventListener('click', () => { experience.openStories(); el('welcomeAudioButton').focus(); if (item.id === 'main') el('mainAudioButton').focus(); }); return article;
  }
  for (const id of ['homeStories', 'listenStories']) el(id).replaceChildren(...stories.map(storyCard));

  function showPage(next, { focus = true } = {}) {
    if (experience.getState().activeAR || !pages.includes(next)) return;
    const previousPage = page, wasInStep = inStep;
    if (!inStep && !app.hidden) scrollPositions.set(page, app.scrollTop);
    page = next; inStep = false; experience.closeStories(); experience.closePoint(); experience.closePanorama();
    el('homeView').hidden = true; app.hidden = false; el('experienceDock').hidden = true; dock.hidden = false;
    for (const section of app.querySelectorAll('.app-page')) section.hidden = section.id !== 'page-' + next;
    for (const button of dock.querySelectorAll('button')) {
      if (button.dataset.page === next) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    }
    app.scrollTo({ top: scrollPositions.get(next) || 0, behavior: 'instant' });
    if (next === 'profile') { settingUp = false; el('profileEditorHome').appendChild(form); draft = { ...state.profile }; fillEditor(); }
    if (focus) { const title = el('page-' + next).querySelector('h1'); title.tabIndex = -1; title.focus({ preventScroll: true }); }
    tabNavigation?.sync();
    if (previousPage !== next || wasInStep) tabNavigation?.animate(el('page-' + next), pages.indexOf(next) >= pages.indexOf(previousPage) ? 1 : -1);
  }
  function stepVisibility() { inStep = true; app.hidden = true; dock.hidden = true; el('homeView').hidden = false; el('experienceDock').hidden = false; }
  function startStep(resume = false) {
    stepVisibility(); experience.prepareVisit({ scroll: false }); el('homeView').scrollTo({ top: 0, behavior: 'instant' });
    const title = el('stepTitle'); title.tabIndex = -1; title.focus({ preventScroll: true });
    if (resume && state.profile.progress.lastPoint) experience.openPoint(state.profile.progress.lastPoint);
  }
  function report(error) { experience.showMessage(error.message || 'Une erreur est survenue. Réessayez.'); }
  document.addEventListener('memoria:prepare', () => { if (!experience.getState().activeAR) stepVisibility(); account.progress({ started: true }).catch(report); });
  document.addEventListener('memoria:point', event => account.progress({ started: true, visited: [event.detail.id], lastPoint: event.detail.id }).catch(report));
  document.addEventListener('memoria:ar', event => { if (event.detail.active) { app.hidden = true; dock.hidden = true; el('experienceDock').hidden = false; } else if (!inStep) showPage(page, { focus: false }); });
  document.addEventListener('memoria:leave', () => showPage('home'));
  for (const node of [app, dock]) node.addEventListener('click', event => {
    const target = event.target.closest('[data-page]'); if (target) { event.preventDefault(); showPage(target.dataset.page); }
    const coming = event.target.closest('[data-coming]'); if (coming) openComing(coming.dataset.coming);
  });
  for (const [id, filter] of [['filterAll','all'],['filterAvailable','available'],['filterComing','coming']]) el(id).addEventListener('click', () => { for (const button of app.querySelectorAll('.filter-row button')) button.setAttribute('aria-pressed', String(button.id === id)); renderPlaces(filter); });
  el('resumeButton').addEventListener('click', () => startStep(true)); el('routeStartButton').addEventListener('click', () => startStep(state.profile.progress.started));
  el('profileResume').addEventListener('click', () => showPage('route'));

  function renderProfile(preview = null) {
    for (const node of root.querySelectorAll('[data-profile-avatar]')) renderAvatar(node, preview || state.profile);
    el('greeting').textContent = 'Bonghjornu, ' + (state.profile.pseudo || 'à vous') + '.';
    el('profileName').textContent = state.profile.pseudo;
    el('sessionBadge').textContent = state.connected ? 'Profil connecté' : 'Mode invité';
    el('profileConnection').textContent = state.connected ? 'Compte connecté · votre profil vous suit.' : 'Invité · profil conservé sur cet appareil.';
    el('profileStorageNote').textContent = state.connected ? 'Votre pseudo, votre image et votre progression sont enregistrés dans votre compte.' : 'Ce profil local n’est pas un compte connecté. Vos données ne sont pas synchronisées entre appareils.';
    el('connectFromProfile').hidden = state.connected; el('logoutButton').textContent = state.connected ? 'Se déconnecter' : 'Quitter le mode invité';
    const progress = state.profile.progress, count = progress.visited.length;
    el('resumeCard').hidden = !progress.started;
    el('resumeDescription').textContent = `L’IUT de Corse · ${count} repère${count === 1 ? '' : 's'} consulté${count === 1 ? '' : 's'} sur 5.`;
    el('routeCount').textContent = count + ' / 5'; el('resumeProgress').value = count; el('routeProgress').value = count;
    el('routeDescription').textContent = progress.started ? 'Reprenez les fiches déjà découvertes ou ouvrez un nouveau repère.' : 'Votre découverte commence sur le campus Grimaldi.';
    el('routeStartButton').firstChild.textContent = progress.started ? 'Reprendre l’étape ' : 'Découvrir l’étape ';
    el('profileProgressTitle').textContent = count === 5 ? 'Les cinq repères sont consultés.' : progress.started ? 'Votre découverte est en chemin.' : 'Le premier pas vous attend.';
    el('profileProgressText').textContent = count + ' repère' + (count === 1 ? '' : 's') + ' consulté' + (count === 1 ? '' : 's') + ' sur 5 à l’IUT. La consultation d’une fiche marque votre progression.';
  }
  account.subscribe(next => { state = next; renderProfile(); });
  function message(id, text, error = false) { el(id).textContent = text; el(id).classList.toggle('is-error', error); }
  function fillEditor() {
    el('pseudoInput').value = draft.pseudo || ''; el('pseudoInput').removeAttribute('aria-invalid');
    el('saveProfileButton').textContent = settingUp ? 'Confirmer et découvrir Corte' : 'Enregistrer mon profil'; message('profileMessage', state.profile.photoWarning || '', !!state.profile.photoWarning); renderDraft();
  }
  function renderDraft() {
    renderAvatar(el('profilePreview'), draft);
    el('removePhotoButton').hidden = !draft.photoURL;
    el('avatarSelectionLabel').textContent = draft.photoURL ? 'Votre photo personnelle' : AVATARS.find(item => item.id === draft.avatar)?.name || 'La citadelle';
    for (const button of el('avatarChoices').querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(!draft.photoURL && button.dataset.avatar === draft.avatar));
      renderAvatar(button.querySelector('.avatar'), { ...draft, avatar: button.dataset.avatar, photoURL: null });
    }
    renderProfile(draft);
  }
  async function saveAvatar(changes) {
    const previous = { ...draft }; draft = { ...draft, ...changes }; renderDraft();
    if (settingUp || !state.profile.pseudo) return;
    busy = true; setBusy(true);
    try {
      const oldPath = state.profile.photo_path;
      await account.saveProfile({ ...state.profile, ...changes });
      draft = { ...state.profile, pseudo: el('pseudoInput').value }; renderDraft(); message('profileMessage', 'Votre image est enregistrée.');
      if (oldPath && oldPath !== changes.photo_path) account.removePhoto(oldPath).catch(() => {});
    } catch (error) { draft = previous; renderDraft(); message('profileMessage', error.message, true); }
    finally { busy = false; setBusy(false); }
  }
  for (const item of AVATARS) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'avatar-option'; button.dataset.avatar = item.id;
    button.innerHTML = '<span class="avatar"></span><span class="avatar-name"></span>'; button.querySelector('.avatar-name').textContent = item.name; button.setAttribute('aria-label', 'Choisir : ' + item.name);
    button.addEventListener('click', () => { if (!busy) saveAvatar({ avatar: item.id, photo_path: null, photoURL: null }); }); el('avatarChoices').appendChild(button);
  }
  el('pseudoInput').addEventListener('input', () => { draft.pseudo = el('pseudoInput').value; el('pseudoInput').removeAttribute('aria-invalid'); renderDraft(); });
  function setBusy(value) {
    for (const button of form.querySelectorAll('button')) button.disabled = value;
    el('photoInput').disabled = value; el('saveProfileButton').textContent = value ? 'Enregistrement…' : settingUp ? 'Confirmer et découvrir Corte' : 'Enregistrer mon profil'; form.setAttribute('aria-busy', String(value));
  }
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    try { validatePseudo(el('pseudoInput').value); }
    catch (error) { el('pseudoInput').setAttribute('aria-invalid', 'true'); message('profileMessage', error.message, true); el('pseudoInput').focus(); return; }
    busy = true; setBusy(true);
    try {
      await account.saveProfile({ ...draft, pseudo: el('pseudoInput').value }); draft = { ...state.profile };
      if (settingUp) completeOnboarding(); else message('profileMessage', 'Votre profil est enregistré.');
    } catch (error) { message('profileMessage', error.message, true); }
    finally { busy = false; setBusy(false); }
  });
  el('removePhotoButton').addEventListener('click', () => saveAvatar({ avatar: 'citadelle', photo_path: null, photoURL: null }));

  function openWelcome() {
    settingUp = false; overlay.hidden = false; app.inert = true; el('homeView').inert = true; dock.hidden = true; el('experienceDock').hidden = true;
    for (const id of ['onboardingWelcome','onboardingAuth','onboardingSetup']) el(id).hidden = id !== 'onboardingWelcome';
    el('createAccountButton').hidden = !state.configured;
    el('signinButton').textContent = state.configured ? 'J’ai déjà un compte' : 'À propos des comptes connectés';
    message('onboardingStatus', ''); el('signupButton').focus();
  }
  function openAuth(mode) {
    authMode = mode; overlay.hidden = false; app.inert = true; dock.hidden = true;
    el('onboardingWelcome').hidden = true; el('onboardingAuth').hidden = false; el('onboardingSetup').hidden = true;
    const signup = mode === 'signup'; el('authTitle').textContent = signup ? 'Créer mon compte' : 'Heureux de vous retrouver.';
    el('authSubmit').textContent = signup ? 'Créer mon compte' : 'Se connecter'; el('authSwitch').textContent = signup ? 'J’ai déjà un compte' : 'Créer un compte';
    el('authDescription').textContent = state.configured ? 'Retrouvez votre profil et votre parcours lors de vos prochaines connexions.' : 'La connexion sera bientôt disponible. Vous pouvez déjà découvrir Corte en invité sur cet appareil.';
    el('authForm').hidden = !state.configured; el('authSwitch').hidden = !state.configured;
    if (!state.configured) { el('authTitle').textContent = 'Votre découverte commence ici.'; el('authGuest').textContent = state.profile.pseudo ? 'Retrouver mon profil' : 'Créer mon profil sur cet appareil'; }
    else el('authGuest').textContent = 'Découvrir en invité';
    el('authSubmit').disabled = !state.configured; el('emailInput').disabled = !state.configured; el('passwordInput').disabled = !state.configured;
    el('passwordInput').autocomplete = signup ? 'new-password' : 'current-password'; el('passwordInput').value = ''; el('passwordHelp').hidden = !signup;
    message('authMessage', ''); (state.configured ? el('emailInput') : el('authGuest')).focus();
  }
  function openSetup() {
    settingUp = true; overlay.hidden = false; app.inert = true; dock.hidden = true; el('experienceDock').hidden = true;
    el('onboardingWelcome').hidden = true; el('onboardingAuth').hidden = true; el('onboardingSetup').hidden = false;
    el('setupEditorHome').appendChild(form); draft = { ...state.profile }; fillEditor();
    el('setupModeNote').textContent = state.connected ? 'Compte connecté. Choisissez votre pseudo et votre image.' : 'Mode invité : votre pseudo, votre image et votre progression resteront sur cet appareil. Ce n’est pas un compte connecté.';
    el('pseudoInput').focus();
  }
  function completeOnboarding() {
    settingUp = false; profileReturn = null; overlay.hidden = true; app.inert = false; el('homeView').inert = false; el('profileEditorHome').appendChild(form);
    showPage('home'); renderProfile();
  }
  el('signupButton').addEventListener('click', openSetup);
  el('createAccountButton').addEventListener('click', () => openAuth('signup'));
  el('signinButton').addEventListener('click', () => openAuth('signin'));
  el('authSwitch').addEventListener('click', () => openAuth(authMode === 'signup' ? 'signin' : 'signup')); el('authBack').addEventListener('click', openWelcome);
  for (const id of ['guestButton','authGuest']) el(id).addEventListener('click', () => { if (state.guest && state.profile.pseudo) completeOnboarding(); else openSetup(); });
  el('connectFromProfile').addEventListener('click', () => { profileReturn = page; openAuth('signin'); });
  el('authForm').addEventListener('submit', async event => {
    event.preventDefault(); if (busy || !state.configured) return; busy = true; el('authSubmit').disabled = true; el('authForm').setAttribute('aria-busy', 'true');
    message('authMessage', 'Connexion en cours…');
    for (const id of ['emailInput','passwordInput']) el(id).removeAttribute('aria-invalid');
    try {
      const result = await account.authenticate(el('emailInput').value, el('passwordInput').value, authMode === 'signup'); el('passwordInput').value = '';
      if (result.confirmationRequired) message('authMessage', 'Consultez votre messagerie pour confirmer votre adresse, puis revenez vous connecter. Si vous avez déjà un compte, connectez-vous.');
      else if (state.profile.pseudo) completeOnboarding(); else openSetup();
    } catch (error) { message('authMessage', error.message, true); el('emailInput').setAttribute('aria-invalid', 'true'); el('passwordInput').setAttribute('aria-invalid', 'true'); }
    finally { busy = false; el('authSubmit').disabled = false; el('authForm').setAttribute('aria-busy', 'false'); }
  });
  el('logoutButton').addEventListener('click', async () => {
    if (busy) return; busy = true; el('logoutButton').disabled = true; experience.stopSounds();
    try { await account.signOut(); openWelcome(); }
    catch (error) { report(error); }
    finally { busy = false; el('logoutButton').disabled = false; }
  });

  function drawCrop() {
    if (!cropImage) return;
    const canvas = el('cropCanvas'), context = canvas.getContext('2d');
    const scale = Math.max(640 / cropImage.width, 640 / cropImage.height) * Number(el('cropZoom').value);
    const width = cropImage.width * scale, height = cropImage.height * scale;
    const x = (640 - width) / 2 + Number(el('cropX').value) * (width - 640) / 2;
    const y = (640 - height) / 2 + Number(el('cropY').value) * (height - 640) / 2;
    context.fillStyle = '#F4F0E8'; context.fillRect(0, 0, 640, 640); context.drawImage(cropImage, x, y, width, height);
  }
  function closeCrop() {
    uploadGeneration++; crop.hidden = true; cropImage?.close?.(); cropImage = null; el('photoInput').value = '';
    app.inert = !overlay.hidden; overlay.inert = false; dock.inert = false; (cropBefore || el('photoInput')).focus();
  }
  async function decodePhoto(file) {
    if (globalThis.createImageBitmap) {
      try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* Use the native image decoder on older phones. */ }
    }
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), image = new Image();
      image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Cette photo ne peut pas être lue. Choisissez un autre fichier JPEG, PNG ou WebP.')); };
      image.src = url;
    });
  }
  el('photoInput').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    const generation = ++uploadGeneration;
    try {
      validatePhoto(file); message('profileMessage', 'Préparation de la photo…');
      const bitmap = await decodePhoto(file);
      if (generation !== uploadGeneration) { bitmap.close?.(); return; }
      if (bitmap.width * bitmap.height > 40000000) { bitmap.close?.(); throw new Error('Cette image est trop grande. Choisissez une version de moins de 40 mégapixels.'); }
      cropImage?.close?.(); cropImage = bitmap; cropBefore = el('photoInput');
      for (const id of ['cropZoom','cropX','cropY']) el(id).value = id === 'cropZoom' ? 1 : 0;
      message('profileMessage', ''); message('cropMessage', ''); crop.hidden = false; app.inert = true; overlay.inert = true; dock.inert = true; drawCrop(); el('cancelCrop').focus();
    } catch (error) { message('profileMessage', error.message || 'Cette image ne peut pas être lue. Essayez un autre fichier.', true); el('photoInput').value = ''; }
  });
  for (const id of ['cropZoom','cropX','cropY']) el(id).addEventListener('input', drawCrop);
  let dragging = null;
  el('cropCanvas').addEventListener('pointerdown', event => { dragging = { x: event.clientX, y: event.clientY, px: Number(el('cropX').value), py: Number(el('cropY').value) }; event.currentTarget.setPointerCapture(event.pointerId); });
  el('cropCanvas').addEventListener('pointermove', event => {
    if (!dragging) return;
    el('cropX').value = Math.max(-1, Math.min(1, dragging.px + (event.clientX - dragging.x) / 100)); el('cropY').value = Math.max(-1, Math.min(1, dragging.py + (event.clientY - dragging.y) / 100)); drawCrop();
  });
  for (const type of ['pointerup','pointercancel','lostpointercapture']) el('cropCanvas').addEventListener(type, () => { dragging = null; });
  el('cancelCrop').addEventListener('click', closeCrop);
  el('confirmCrop').addEventListener('click', async () => {
    if (busy) return; busy = true; el('confirmCrop').disabled = true; el('cancelCrop').disabled = true; message('cropMessage', 'Enregistrement de la photo…');
    try {
      const blob = await new Promise(resolve => el('cropCanvas').toBlob(resolve, 'image/jpeg', .85));
      if (!blob) throw new Error('Impossible de préparer cette photo. Réessayez.');
      const photo = await account.savePhoto(blob); closeCrop(); busy = false; await saveAvatar(photo);
    } catch (error) { message('cropMessage', error.message, true); }
    finally { busy = false; el('confirmCrop').disabled = false; el('cancelCrop').disabled = false; }
  });

  let comingBefore = null;
  function openComing(title) { comingBefore = document.activeElement; el('comingTitle').textContent = title; upcoming.hidden = false; app.inert = true; dock.inert = true; el('closeComing').focus(); }
  function closeComing() { upcoming.hidden = true; app.inert = false; dock.inert = false; comingBefore?.focus(); }
  el('closeComing').addEventListener('click', closeComing); el('comingStart').addEventListener('click', () => { closeComing(); startStep(); });
  document.addEventListener('keydown', event => {
    const modal = !crop.hidden ? crop : !upcoming.hidden ? upcoming : !overlay.hidden ? overlay : null;
    if (!modal) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (modal === crop && !busy) closeCrop(); else if (modal === upcoming) closeComing();
      else if (profileReturn) { profileReturn = null; completeOnboarding(); showPage('profile'); }
    }
    if (event.key === 'Tab') {
      const controls = [...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href],[tabindex="0"]')].filter(node => node.getClientRects().length);
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    }
  });
  tabNavigation = createTabNavigation({ nav: dock.querySelector('nav'), view: app, pages, getPage: () => page, navigate: showPage,
    canNavigate: () => overlay.hidden && crop.hidden && upcoming.hidden && !experience.getState().activeAR && !busy && el('poiModal').hidden && el('storiesModal').hidden && el('panoramaPanel').hidden });
  showPage('home', { focus: false }); renderProfile();
  overlay.hidden = false; app.inert = true; dock.hidden = true; message('onboardingStatus', 'Préparation de votre découverte…');
  account.restore().then(restored => {
    state = restored;
    if (state.profile.pseudo && (state.guest || state.connected)) completeOnboarding(); else if (state.connected) openSetup(); else openWelcome();
  }).catch(error => { openWelcome(); message('onboardingStatus', error.message, true); });
  return { account, showPage, startStep };
}
