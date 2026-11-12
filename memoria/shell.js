import { createTypewriter } from './type-writer.js?v=1';
import { createAvatarPicker } from './avatar-picker.js?v=1';
import { createStackPanel } from './stack-panel.js?v=1';
import { createCarouselCards } from './carousel-cards.js?v=1';
import { createCardStack } from './card-stack.js?v=1';
import { createProfileDropdown } from './profile-dropdown.js?v=2';
import { createAccount, validatePhoto, validatePseudo } from './account.js?v=33';
import { AVATARS, renderAvatar } from './avatars.js?v=33';
import { createTabNavigation } from './navigation.js?v=33';
import { cropGeometry, zoomCrop } from './photo-crop.js?v=33';
import { CORTE_PHOTOS, IUT_PHOTO, photoVariants } from '../content/corte.js?v=33';
import { createImmersiveMap } from './immersive-map.js?v=44';

import { createPageMotion } from './motion.js?v=37';

const icon = name => `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"/></svg>`;
export function createShell(experience, step) {
  const root = document.getElementById('content');
  const el = id => document.getElementById(id);
  const account = createAccount();
  let state = account.getState(), page = 'home', inStep = false, settingUp = false, authMode = 'signup', busy = false;
  let draft = { ...state.profile }, cropImage = null, cropBefore = null, profileReturn = null, uploadGeneration = 0;
  let tabNavigation = null, cityMap = null, pageMotion = null, profileEditorLoaded = false, stepOrigin = 'home';
  let cropState = { zoom: 1, offsetX: 0, offsetY: 0 };
  const pages = ['home', 'explore', 'route', 'listen', 'profile'];
  let exploreFilter = 'all', applyingLocation = false, appliedHash = null;
  const scrollPositions = new Map();
  const app = document.createElement('main'); app.id = 'appView'; app.dataset.ui = '';
  app.innerHTML = `
    <header class="site-header app-header"><a class="brand" href="#accueil" data-page="home"><span class="seal">MC</span><span>Memoria <em>Corti</em><small>Des lieux. Des voix. Une mémoire.</small></span></a><div class="header-end"><span class="location-chip">${icon('pin')} Corte · Corse</span><button id="headerProfile" class="profile-shortcut" aria-label="Ouvrir mon profil" data-page="profile"><span data-profile-avatar class="avatar"></span></button></div></header>
    <section id="page-home" class="app-page home-page" aria-labelledby="greeting">
      <article class="feature-card"><img src="assets/photos/corte-citadelle.jpg" alt="La citadelle de Corte sur son éperon rocheux, dans les montagnes corses" width="1280" height="960" srcset="assets/photos/corte-citadelle-768.webp 768w, assets/photos/corte-citadelle-1280.webp 1280w" sizes="100vw" fetchpriority="high"><div class="feature-overlay">
        <div class="welcome-line"><h1 id="greeting">Bonghjornu.</h1><span id="sessionBadge" class="subtle-badge"></span></div>
        <div class="hero-copy"><p class="eyebrow">UNE VILLE À RENCONTRER</p><h2 id="homeTitle">Corte.<br>La mémoire<br>à chaque pas.</h2><p>Des pierres de la ville aux voix qui la racontent.<br>Une découverte, à votre rythme.</p><div class="hero-actions"><button id="heroAction" class="light-button" type="button">${icon('discover')} <span id="heroActionLabel">Commencer</span></button><button class="hero-secondary" data-page="explore" type="button">Les lieux ${icon('arrow')}</button></div></div>
        <a class="hero-credit" href="https://commons.wikimedia.org/wiki/File:Citadelle_de_Corte,_Corte,_Corsica,_France.jpg" target="_blank" rel="noopener noreferrer">Corte · Bj.schoenmakers · CC0 ↗</a>
      </div></article>
      <div class="home-content"><article id="resumeCard" class="resume-card" hidden><span class="resume-thumbnail" aria-hidden="true">${icon('route')}</span><div><p class="eyebrow">VOTRE DÉCOUVERTE EN COURS</p><h2>Le fil de votre visite.</h2><p id="resumeDescription"></p><progress id="resumeProgress" max="5" value="0" aria-label="Repères consultés à l’IUT"></progress></div><button id="resumeButton" class="primary" type="button">Reprendre ${icon('arrow')}</button></article>
      <div class="section-heading"><div><p class="eyebrow">À DÉCOUVRIR</p><h2>Les lieux, autrement.</h2></div><button class="text-button" data-page="explore" type="button">Tout explorer ${icon('arrow')}</button></div><div id="homePlaces"></div>
      <div class="section-heading"><div><p class="eyebrow">PRENEZ LE TEMPS</p><h2>Écouter Corte.</h2></div><button class="text-button" data-page="listen" type="button">Les récits ${icon('arrow')}</button></div><div id="homeStories" class="story-grid"></div>
      <div class="section-heading"><div><p class="eyebrow">LE TERRITOIRE EN IMAGES</p><h2>Au détour d’un regard.</h2></div></div><div id="corteGallery" class="corte-gallery"></div><div class="quiet-note">${icon('route')}<div><p>L’IUT ouvre la visite. Retrouvez les autres lieux de Corte et les étapes en préparation.</p><button class="text-button" data-page="route" type="button">Préparer mon parcours ${icon('arrow')}</button></div></div></div>
    </section>
    <section id="page-explore" class="app-page" hidden aria-labelledby="exploreTitle"><p class="eyebrow">LES MÉMOIRES DU TERRITOIRE</p><h1 id="exploreTitle">Explorer Corte.</h1><p class="page-subtitle">Un lieu, une histoire. Choisissez votre prochaine découverte.</p>
      <div class="place-search">${icon('search')}<label class="sr-only" for="exploreSearch">Rechercher parmi les lieux de Corte</label><input id="exploreSearch" type="search" placeholder="Un lieu à découvrir…" autocomplete="off"></div>
      <div class="filter-row" role="group" aria-label="Filtrer les lieux"><button id="filterAll" aria-pressed="true">Tous les lieux</button><button id="filterAvailable" aria-pressed="false">Disponibles</button><button id="filterComing" aria-pressed="false">À venir</button></div><div id="explorePlaces"></div><p id="exploreEmpty" role="status" hidden>Aucun lieu ne correspond à votre recherche.</p><p class="small-note">Photographies du territoire et évocations du parcours : les crédits accompagnent les images.</p></section>
    <section id="page-route" class="app-page map-page" hidden aria-labelledby="routeTitle"><div id="cityMap"></div></section>
    <section id="page-listen" class="app-page" hidden aria-labelledby="listenTitle"><p class="eyebrow">LAISSEZ LES LIEUX SE RACONTER</p><h1 id="listenTitle">Écouter Corte.</h1><p class="page-subtitle">Lancez un récit et poursuivez votre découverte. Le lecteur vous accompagne d’un onglet à l’autre.</p><div class="listen-intro">${icon('listen')}<p>Ces narrations utilisent une voix générée par IA. Les textes sont disponibles sous chaque récit ; les témoignages et les ambiances de terrain restent à documenter.</p></div><div id="listenStories" class="story-grid"></div></section>
    <section id="page-profile" class="app-page" hidden aria-labelledby="profileTitle"><p class="eyebrow">VOTRE DÉCOUVERTE, À VOTRE IMAGE</p><h1 id="profileTitle">Mon profil.</h1><div class="profile-layout"><div><div class="profile-identity"><span class="avatar avatar-large" data-profile-avatar></span><div><h2 id="profileName"></h2><p id="profileConnection" class="small-note"></p></div></div><div id="profileEditorHome"></div></div><aside class="profile-aside"><p class="eyebrow">VOTRE PARCOURS</p><h2 id="profileProgressTitle">Le premier pas vous attend.</h2><p id="profileProgressText"></p><button id="profileResume" type="button">Retrouver mon parcours ${icon('arrow')}</button><div class="profile-account"><p id="profileStorageNote" class="small-note"></p><button id="connectFromProfile" type="button">Créer un compte ou se connecter</button><button id="logoutButton" type="button">Se déconnecter ${icon('exit')}</button></div></aside></div></section>
    <footer class="site-footer"><span>Memoria Corti · La mémoire en mouvement</span><span>Corte, des lieux à rencontrer</span></footer>`;
  root.prepend(app);
  const profileDropdown = createProfileDropdown(el('headerProfile'), {
    onProfile: () => showPage('profile'),
    onRoute: () => showPage('route'),
    onConnect: () => el('connectFromProfile').click(),
    onSignOut: () => el('logoutButton').click(),
  });

  const dock = document.createElement('div'); dock.id = 'appDock'; dock.className = 'journey-dock'; dock.dataset.ui = '';
  dock.innerHTML = `<nav class="journey-nav app-nav" aria-label="Navigation principale">${[['home','Accueil','home'],['explore','Explorer','discover'],['route','Parcours','route'],['listen','Écouter','listen'],['profile','Profil','']].map(([id,label,symbol]) => `<button id="tab-${id}" class="journey-item" data-page="${id}" type="button">${symbol ? icon(symbol) : '<span data-profile-avatar class="avatar nav-avatar"></span>'}<span>${label}</span></button>`).join('')}</nav>`;
  root.appendChild(dock);
  const overlay = document.createElement('section'); overlay.id = 'onboarding'; overlay.className = 'onboarding'; overlay.dataset.ui = ''; overlay.hidden = true;
  overlay.innerHTML = `<div class="onboarding-brand"><span class="seal">MC</span><span>Memoria <em>Corti</em></span></div><div id="onboardingWelcome" class="onboarding-screen"><span class="welcome-medallion">${icon('discover')}</span><p class="eyebrow">BENVENUTI IN CORTI</p><h1>Bienvenue<br>à Corte.</h1><p class="onboarding-lead">Découvrez les lieux de la ville, écoutez leurs récits et retrouvez votre parcours au fil des visites.</p><div class="onboarding-actions"><button id="signupButton" class="primary">Créer mon profil ${icon('arrow')}</button><button id="createAccountButton" hidden>Créer un compte connecté</button><button id="signinButton">J’ai déjà un compte</button><button id="guestButton" class="text-button">Continuer en invité</button></div><p class="small-note">Un pseudo, une image, et votre découverte peut commencer.<br>Le profil invité est conservé sur cet appareil.</p></div>
    <div id="onboardingAuth" class="onboarding-screen" hidden><button id="authBack" class="text-button">← Retour</button><p class="eyebrow">01 / VOTRE CONNEXION</p><h1 id="authTitle">Créer mon compte</h1><p id="authDescription" class="onboarding-lead"></p><form id="authForm" novalidate><label for="emailInput">Adresse e-mail</label><input id="emailInput" name="email" type="email" autocomplete="email" required aria-describedby="authMessage" placeholder="vous@exemple.fr"><label for="passwordInput">Mot de passe</label><input id="passwordInput" name="password" type="password" autocomplete="new-password" required aria-describedby="authMessage"><p class="small-note" id="passwordHelp">Au moins 8 caractères.</p><p id="authMessage" class="form-message" role="status" aria-live="polite"></p><button id="authSubmit" class="primary" type="submit">Créer mon compte</button></form><button id="authSwitch" class="text-button">J’ai déjà un compte</button><button id="authGuest" class="text-button">Découvrir en invité</button></div>
    <div id="onboardingSetup" class="onboarding-screen setup-screen" hidden><p class="eyebrow">02 / UN PROFIL QUI VOUS RESSEMBLE</p><h1>Et vous,<br>comment vous appelez-vous ?</h1><p id="setupModeNote" class="small-note"></p><div id="setupEditorHome"></div></div><p id="onboardingStatus" class="form-message" role="status" aria-live="polite"></p>`;
  root.appendChild(overlay);
  createTypewriter(el('homeTitle'), {
    text: 'Corte.\nLa mémoire\nà chaque pas.',
    canRun: () => overlay.hidden && !app.hidden && !app.inert && !el('page-home').hidden,
    watch: [app, overlay, el('page-home')],
  });
  const form = document.createElement('form'); form.id = 'profileForm'; form.noValidate = true;
  form.innerHTML = `<label for="pseudoInput">Votre pseudo</label><input id="pseudoInput" name="pseudo" type="text" minlength="3" maxlength="24" autocomplete="nickname" required placeholder="Votre prénom ou votre pseudo" aria-describedby="pseudoHelp profileMessage"><p id="pseudoHelp" class="small-note">3 à 24 caractères. Votre adresse e-mail ne sera pas affichée.</p><fieldset><legend>Choisissez votre avatar</legend><div id="avatarChoices" class="avatar-grid"></div></fieldset><div class="photo-import"><label for="photoInput" class="upload-button">Importer ma photo ${icon('arrow')}</label><input id="photoInput" class="sr-only" type="file" accept="image/jpeg,image/png,image/webp"><p class="small-note">JPEG, PNG ou WebP · 5 Mo maximum.<br>Recadrez votre photo avant de la confirmer.</p></div><div class="selected-avatar"><span class="avatar avatar-preview" id="profilePreview"></span><span id="avatarSelectionLabel" class="small-note"></span><button id="removePhotoButton" type="button" hidden>Revenir à un avatar</button></div><p id="profileMessage" class="form-message" role="status" aria-live="polite"></p><button id="saveProfileButton" class="primary" type="submit">Enregistrer mon profil</button>`;
  const avatarPicker = createAvatarPicker(form);
  el('profileEditorHome').appendChild(form);
  const settingsHost = document.createElement('div'); settingsHost.id = 'profileSettings';
  const identity = el('page-profile').querySelector('.profile-identity');
  const accountSettings = el('page-profile').querySelector('.profile-account');
  const progressSettings = el('page-profile').querySelector('.profile-aside');
  const profileSettings = createStackPanel(settingsHost, {
    pages: [
      { id: 'identity', title: 'Identité et photo', content: el('profileEditorHome') },
      { id: 'account', title: 'Compte et connexion', content: accountSettings },
      { id: 'progress', title: 'Mon parcours', content: progressSettings },
    ],
    canNavigate: () => !busy,
  });
  el('page-profile').querySelector('.profile-layout').replaceChildren(identity, settingsHost);
  const crop = document.createElement('div'); crop.id = 'cropModal'; crop.className = 'modal-backdrop crop-modal'; crop.dataset.ui = ''; crop.hidden = true;
  crop.innerHTML = `<article class="content-card" role="dialog" aria-modal="true" aria-labelledby="cropTitle"><header><div><p class="eyebrow">VOTRE PHOTO</p><h2 id="cropTitle">Cadrez à votre image.</h2></div><button id="cancelCrop" type="button">Annuler</button></header><div class="card-scroll crop-editor"><p id="cropInstructions" class="small-note">Déplacez la photo avec le doigt. Pincez pour zoomer.<br>Ce qui apparaît dans le cercle sera votre avatar.</p><div class="crop-stage"><canvas id="cropCanvas" width="640" height="640" tabindex="0" aria-describedby="cropInstructions cropKeyboardHelp" aria-label="Photo à déplacer pour choisir le cadrage"></canvas><div class="crop-circle" aria-hidden="true"></div></div><div class="crop-zoom-controls"><button id="cropZoomOut" type="button" aria-label="Réduire le zoom">−</button><label class="sr-only" for="cropZoom">Zoom de la photo</label><input id="cropZoom" type="range" min="1" max="4" step="0.01" value="1"><button id="cropZoomIn" type="button" aria-label="Agrandir la photo">+</button></div><p id="cropZoomLabel" class="small-note">Zoom · 100 %</p><p id="cropKeyboardHelp" class="sr-only">Au clavier : flèches pour déplacer, + et − pour zoomer, Début pour recentrer.</p></div><footer class="crop-footer"><p id="cropMessage" role="status" class="form-message"></p><div><button id="resetCrop" type="button">Recentrer</button><button id="confirmCrop" type="button" class="primary">Utiliser cette photo</button></div></footer></article>`;
  root.appendChild(crop);
  const upcoming = document.createElement('div'); upcoming.id = 'comingModal'; upcoming.className = 'modal-backdrop'; upcoming.dataset.ui = ''; upcoming.hidden = true;
  upcoming.innerHTML = `<article class="content-card" role="dialog" aria-modal="true" aria-labelledby="comingTitle"><header><div><p class="eyebrow">LE PARCOURS S’ÉTOFFE</p><h2 id="comingTitle"></h2></div><button id="closeComing">Fermer</button></header><div class="card-scroll"><img class="coming-visual" src="assets/corte-illustration.svg" alt="Illustration symbolique de Corte"><p>Cette étape est en préparation. Ses contenus, médias et repères AR ne sont pas encore disponibles.</p><button id="comingStart" class="primary">Découvrir la première étape : l’IUT</button></div></article>`;
  root.appendChild(upcoming);
  cityMap = createImmersiveMap(el('cityMap'), { onStep: () => startStep(state.profile.progress.started), onComing: openComing, onSelection: id => { if (page === 'route' && !applyingLocation) writeLocation('route', { place: id }); } });
  el('page-explore').querySelector(':scope > .small-note').textContent = 'Photographies de Corte et illustrations du parcours : les crédits et les licences accompagnent chaque cliché.';
  function photoCredit(photo) {
    const credit = document.createElement('div'); credit.className = 'photo-credit';
    if(photo.credit){credit.textContent=photo.credit;return credit;}
    const source = document.createElement('a'); source.href = photo.source; source.target = '_blank'; source.rel = 'noopener noreferrer'; source.textContent = 'Photo : ' + photo.author;
    const license = document.createElement('a'); license.href = photo.licenseURL; license.target = '_blank'; license.rel = 'noopener noreferrer'; license.textContent = photo.license;
    credit.append(source, document.createTextNode(' · '), license); return credit;
  }
  for(const photo of CORTE_PHOTOS.filter(item => item.id !== 'citadelle')) {
    const figure = document.createElement('figure'); figure.className = 'corte-photo-card';
    const image = document.createElement('img'); image.src = photo.src; image.alt = photo.alt; image.width = 1280; image.height = 960; image.loading = 'lazy'; image.style.objectPosition = photo.position; image.srcset = photoVariants(photo).srcset; image.sizes = '(max-width:700px) 83vw, 380px'; image.decoding = 'async';
    const caption = document.createElement('figcaption'), title = document.createElement('h3'), description = document.createElement('p'); title.textContent = photo.title; description.textContent = photo.description;
    caption.append(title, description, photoCredit(photo)); figure.append(image, caption); el('corteGallery').appendChild(figure);
  }
  const comingPhoto = CORTE_PHOTOS.find(item => item.id === 'palazzu');
  const comingImage = upcoming.querySelector('.coming-visual'); comingImage.loading = 'lazy'; comingImage.src = comingPhoto.src; comingImage.alt = comingPhoto.alt; comingImage.after(photoCredit(comingPhoto));
  const back = document.createElement('button'); back.id = 'backToApp'; back.type = 'button'; back.className = 'text-button'; back.textContent = '← Accueil';
  el('homeView').querySelector('.site-header').appendChild(back); back.addEventListener('click', () => showPage(stepOrigin));
  el('homeView').querySelector('.brand').addEventListener('click', event => { event.preventDefault(); showPage('home'); });

  const places = [
    { id: 'iut', title: 'Corte, une ville de savoir', description: 'De Pasquale Paoli aux étudiants d’aujourd’hui. Première étape : l’IUT de Corse.', image: 'savoir', photo: IUT_PHOTO, status: 'Étape 01 · Disponible', action: 'Découvrir l’IUT', available: true },
    { id: 'palazzu', title: 'Le Palazzu Naziunale', description: 'Un autre lieu, aux origines de l’histoire universitaire de Corte.', image: 'corte', photo: comingPhoto, status: 'Étape 02 · À venir', action: 'En savoir plus', available: false }
  ];
  function placeCard(item) {
    const article = document.createElement('article'); article.className = 'editorial-card'; article.dataset.place = item.id;
    article.innerHTML = `<div class="card-visual"><img src="assets/${item.image}-illustration.svg" alt="Illustration symbolique ${item.available ? 'de la transmission du savoir' : 'de Corte'}" width="1000" height="600" loading="lazy"><span class="visual-label">Illustration</span></div><div class="editorial-card-body"><span class="status-pill ${item.available ? '' : 'coming'}"></span><h3></h3><p></p><button class="${item.available ? 'primary' : ''}"></button></div>`;
    article.querySelector('.status-pill').textContent = item.status; article.querySelector('h3').textContent = item.title; article.querySelector('p').textContent = item.description;
    if(item.photo) { const image = article.querySelector('img'); image.src = item.photo.src; image.alt = item.photo.alt; image.width=item.photo.width||1280; image.height=item.photo.height||960; image.style.objectPosition = item.photo.position; image.srcset = photoVariants(item.photo).srcset; image.sizes = '(max-width:700px) 85vw, 560px'; image.decoding = 'async'; article.querySelector('.visual-label').textContent = item.id==='iut'?'Photographie · IUT de Corse':'Photographie · Corte'; article.querySelector('.editorial-card-body').appendChild(photoCredit(item.photo)); }
    const button = article.querySelector('button'); button.textContent = item.action; button.addEventListener('click', () => item.available ? startStep() : openComing(item.title));
    const mapButton = document.createElement('button'); mapButton.type = 'button'; mapButton.className = 'text-button map-link'; mapButton.innerHTML = '<span>Sur le plan</span><span class="action-arrow" aria-hidden="true">'+icon('arrow')+'</span>'; mapButton.addEventListener('click', () => showPlace(item.id)); article.querySelector('.editorial-card-body').append(mapButton); return article;
  }
  const exploreCarousel = createCarouselCards(el('explorePlaces'));
  function renderPlaces(filter = exploreFilter) {
    exploreFilter = filter;
    const text = el('exploreSearch').value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    const matches = places.filter(item => (filter === 'all' || item.available === (filter === 'available')) && (item.title+' '+item.description).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(text));
    exploreCarousel.setCards(matches.map(placeCard)); el('exploreEmpty').hidden = matches.length > 0; pageMotion?.refresh();
  }
  el('exploreSearch').addEventListener('input', () => renderPlaces());
  createCardStack(el('homePlaces'), places.map(placeCard)); renderPlaces();
  const stories = [
    { id: 'welcome', track: step.narrations.welcome, title: step.narrations.welcome.title, description: 'Le campus Grimaldi ouvre les portes de votre découverte.', action: 'Lire ou écouter l’accueil' },
    { id: 'main', track: step.narrations.main, title: step.narrations.main.title, description: '1765, 1981, 1983 : trois repères pour comprendre et transmettre.', action: 'Lire ou écouter le récit' }
  ];
  function storyCard(item) {
    const article = document.createElement('article'); article.className = 'story-card';
    article.innerHTML = `<div class="story-visual" aria-hidden="true">${icon('listen')}</div><div class="story-copy"><span class="eyebrow">RÉCIT · VOIX IA</span><h3></h3><p></p><button class="text-button" type="button"></button><details><summary>Lire la transcription</summary><p class="story-transcript"></p></details></div>`;
    article.querySelector('h3').textContent = item.title; article.querySelector('.story-copy > p').textContent = item.description;
    const button = article.querySelector('button'); button.textContent = 'Écouter' + (item.track.audio?.duration ? ' · ' + Math.round(item.track.audio.duration) + ' s' : '');
    button.addEventListener('click', () => experience.playNarration(item.track)); article.querySelector('.story-transcript').textContent = item.track.text; return article;
  }
  for (const id of ['homeStories', 'listenStories']) el(id).replaceChildren(...stories.map(storyCard));


  const routeNames = { home:'accueil', explore:'explorer', route:'parcours', listen:'ecouter', profile:'profil', step:'etape/iut' };
  function readLocation() {
    const [name,query=''] = location.hash.slice(1).split('?');
    const id = Object.keys(routeNames).find(key => routeNames[key] === name) || (name === 'carte' ? 'route' : 'home');
    const params = new URLSearchParams(query);
    return { page:id, place:params.get('lieu')==='fixed-gps'?'iut':params.get('lieu'), point:params.get('point'), panorama:params.get('vue')==='360', legacyPlace:params.get('lieu')==='fixed-gps' };
  }
  function writeLocation(next, { place, point, replace = false } = {}) {
    if (applyingLocation) return;
    const params = new URLSearchParams();
    if (next === 'route' && (place || cityMap?.getState().selected)) params.set('lieu', place || cityMap.getState().selected);
    if (next === 'step' && point) params.set('point',point);
    const hash = '#' + routeNames[next] + (params.size ? '?' + params : '');
    if (location.hash !== hash) window.history[replace ? 'replaceState' : 'pushState']({ memoria:true },'',hash);
    appliedHash = location.hash;
  }
  function showPlace(id) {
    showPage('route'); cityMap.select(id); writeLocation('route',{place:id});
  }
  async function applyLocation(intent, replace = false) {
    applyingLocation = true;
    try {
      if (experience.getState().activeAR) await experience.exit();
      if (intent.page === 'step') { startStep(false); if(intent.point && step.points.some(p=>p.id===intent.point)) experience.openPoint(intent.point); else if(intent.panorama)experience.openPanorama(); }
      else { showPage(intent.page,{history:false}); if(intent.page === 'route') cityMap.select(intent.place); }
    } finally { applyingLocation = false; }
    appliedHash = location.hash;
    if (replace || intent.legacyPlace) writeLocation(intent.page,{place:intent.place,point:intent.point,replace:true});
  }
  function restoreLocation() {
    if(!overlay.hidden || location.hash === appliedHash) return;
    appliedHash=location.hash; applyLocation(readLocation());
  }
  addEventListener('popstate',restoreLocation); addEventListener('hashchange',restoreLocation);
  function showPage(next, { focus = true, history = true } = {}) {
    if (experience.getState().activeAR || !pages.includes(next)) return;
    profileDropdown.close();
    const previousPage = page, wasInStep = inStep;
    if (previousPage !== next) experience.collapsePlayer();
    if (!inStep && !app.hidden) scrollPositions.set(page, app.scrollTop);
    cityMap?.deactivate();
    page = next; inStep = false; app.classList.toggle('is-map', next === 'route'); app.classList.toggle('is-home', next === 'home'); experience.closeStories(); experience.closePoint(); experience.closePanorama();
    el('homeView').hidden = true; app.hidden = false; el('experienceDock').hidden = true; dock.hidden = false;
    for (const section of app.querySelectorAll('.app-page')) section.hidden = section.id !== 'page-' + next;
    for (const button of dock.querySelectorAll('button')) {
      if (button.dataset.page === next) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    }
    app.scrollTo({ top: scrollPositions.get(next) || 0, behavior: 'instant' });
    if (next === 'profile') {
      settingUp = false; el('profileEditorHome').appendChild(form);
      if (!profileEditorLoaded) { draft = { ...state.profile }; fillEditor(); profileEditorLoaded = true; }
      else renderDraft();
    }
    if (next === 'route') cityMap?.activate();
    if (focus) { const title = el('page-' + next).querySelector('h1'); title.tabIndex = -1; title.focus({ preventScroll: true }); }
    if (history && !applyingLocation && (previousPage !== next || wasInStep || !location.hash)) writeLocation(next);
    tabNavigation?.sync(); pageMotion?.refresh();
    if (previousPage !== next || wasInStep) tabNavigation?.animate(el('page-' + next), pages.indexOf(next) >= pages.indexOf(previousPage) ? 1 : -1);
  }
  function stepVisibility() { if (!inStep) { stepOrigin = page; scrollPositions.set(page, app.scrollTop); } cityMap?.deactivate(); back.textContent = '← ' + ({home:'Accueil',explore:'Explorer',map:'Carte',route:'Parcours',listen:'Écouter',profile:'Profil'}[stepOrigin]); inStep = true; app.hidden = true; dock.hidden = true; el('homeView').hidden = false; el('experienceDock').hidden = false; }
  function startStep(resume = false) {
    if (!applyingLocation) writeLocation('step');
    stepVisibility(); experience.prepareVisit({ scroll: false }); el('homeView').scrollTo({ top: 0, behavior: 'instant' });
    const title = el('stepTitle'); title.tabIndex = -1; title.focus({ preventScroll: true });
    if (resume && state.profile.progress.lastPoint) experience.openPoint(state.profile.progress.lastPoint);
  }
  function report(error) { experience.showMessage(error.message || 'Une erreur est survenue. Réessayez.'); }
  document.addEventListener('memoria:prepare', () => { if (!experience.getState().activeAR) stepVisibility(); account.progress({ started: true }).catch(report); });
  document.addEventListener('memoria:point', event => { account.progress({ started: true, visited: [event.detail.id], lastPoint: event.detail.id }).catch(report); if (inStep && !applyingLocation) writeLocation('step', { point: event.detail.id }); });
  document.addEventListener('memoria:point-close', () => { if (inStep && !applyingLocation) writeLocation('step', { replace: true }); });
  document.addEventListener('memoria:ar', event => { if (event.detail.active) { app.hidden = true; dock.hidden = true; el('experienceDock').hidden = false; } else if (!inStep) showPage(page, { focus: false }); });
  document.addEventListener('memoria:leave', () => showPage(stepOrigin));
  for (const node of [app, dock]) node.addEventListener('click', event => {
    const target = event.target.closest('[data-page]'); if (target) { event.preventDefault(); showPage(target.dataset.page); }
    const coming = event.target.closest('[data-coming]'); if (coming) openComing(coming.dataset.coming);
  });
  for (const [id, filter] of [['filterAll','all'],['filterAvailable','available'],['filterComing','coming']]) el(id).addEventListener('click', () => { for (const button of el('page-explore').querySelectorAll('.filter-row button')) button.setAttribute('aria-pressed', String(button.id === id)); renderPlaces(filter); });
  el('heroAction').addEventListener('click', () => startStep(state.profile.progress.started));
  el('resumeButton').addEventListener('click', () => startStep(true));
  el('profileResume').addEventListener('click', () => showPage('route'));

  function renderProfile(preview = null) {
    profileSettings.setDetail('identity', (preview || state.profile).pseudo || 'Personnaliser');
    profileSettings.setDetail('account', state.connected ? 'Connecté' : 'Invité');
    profileSettings.setDetail('progress', state.profile.progress.visited.length + ' / 5');
    profileDropdown.update(state, preview || state.profile);
    for (const node of root.querySelectorAll('[data-profile-avatar]')) renderAvatar(node, preview || state.profile);
    el('greeting').textContent = 'Bonghjornu, ' + (state.profile.pseudo || 'à vous') + '.';
    el('profileName').textContent = state.profile.pseudo;
    el('sessionBadge').textContent = state.connected ? 'Profil connecté' : 'Mode invité';
    el('profileConnection').textContent = state.connected ? 'Compte connecté · votre profil vous suit.' : 'Invité · profil conservé sur cet appareil.';
    el('profileStorageNote').textContent = state.connected ? 'Votre pseudo, votre image et votre progression sont enregistrés dans votre compte.' : 'Ce profil local n’est pas un compte connecté. Vos données ne sont pas synchronisées entre appareils.';
    el('connectFromProfile').hidden = state.connected; el('logoutButton').textContent = state.connected ? 'Se déconnecter' : 'Quitter le mode invité';
    const progress = state.profile.progress, count = progress.visited.length;
    el('resumeCard').hidden = !progress.started;
    el('heroActionLabel').textContent = progress.started ? 'Reprendre' : 'Commencer';
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
    avatarPicker.update(draft);
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
    profileSettings.reset();
    message('onboardingStatus', '');
    settingUp = false; profileEditorLoaded = false; profileReturn = null; overlay.hidden = true; app.inert = false; el('homeView').inert = false; el('profileEditorHome').appendChild(form);
    applyLocation(readLocation(), true); renderProfile();
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
    cropState = cropGeometry(cropImage, cropState);
    context.fillStyle = '#F4F0E8'; context.fillRect(0, 0, 640, 640); context.drawImage(cropImage, cropState.x, cropState.y, cropState.width, cropState.height);
    el('cropZoom').value = cropState.zoom; el('cropZoomLabel').textContent = 'Zoom · ' + Math.round(cropState.zoom * 100) + ' %';
    el('cropZoomOut').disabled = cropState.zoom <= 1; el('cropZoomIn').disabled = cropState.zoom >= 4;
  }
  function closeCrop() {
    uploadGeneration++; crop.hidden = true; cropImage?.close?.(); cropImage = null; cropPointers.clear(); el('photoInput').value = '';
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
      cropState = { zoom: 1, offsetX: 0, offsetY: 0 }; cropPointers.clear();
      message('profileMessage', ''); message('cropMessage', ''); crop.hidden = false; app.inert = true; overlay.inert = true; dock.inert = true; drawCrop(); el('cancelCrop').focus();
    } catch (error) { message('profileMessage', error.message || 'Cette image ne peut pas être lue. Essayez un autre fichier.', true); el('photoInput').value = ''; }
  });
  function setCropZoom(zoom, anchor) { if (!cropImage || busy) return; cropState = zoomCrop(cropImage, cropState, zoom, anchor); drawCrop(); }
  el('cropZoom').addEventListener('input', event => setCropZoom(Number(event.target.value)));
  el('cropZoomOut').addEventListener('click', () => setCropZoom(cropState.zoom - .15));
  el('cropZoomIn').addEventListener('click', () => setCropZoom(cropState.zoom + .15));
  function resetCrop() { cropState = { zoom: 1, offsetX: 0, offsetY: 0 }; drawCrop(); }
  el('resetCrop').addEventListener('click', resetCrop);
  const cropPointers = new Map(); let pinch = null;
  const cropPoint = event => { const rect = el('cropCanvas').getBoundingClientRect(); return { x: (event.clientX - rect.left) * 640 / rect.width, y: (event.clientY - rect.top) * 640 / rect.height }; };
  const pinchMeasure = () => { const [a,b] = [...cropPointers.values()]; return { distance: Math.hypot(a.x-b.x,a.y-b.y), center: {x:(a.x+b.x)/2,y:(a.y+b.y)/2} }; };
  el('cropCanvas').addEventListener('pointerdown', event => {
    if (busy) return; cropPointers.set(event.pointerId, cropPoint(event)); event.currentTarget.setPointerCapture(event.pointerId);
    if (cropPointers.size === 2) pinch = { ...pinchMeasure(), state: { ...cropState } };
  });
  el('cropCanvas').addEventListener('pointermove', event => {
    const previous = cropPointers.get(event.pointerId); if (!previous || busy) return;
    const point = cropPoint(event); cropPointers.set(event.pointerId, point);
    if (cropPointers.size === 2 && pinch) {
      const measured = pinchMeasure(); cropState = zoomCrop(cropImage, pinch.state, pinch.state.zoom * measured.distance / Math.max(1,pinch.distance), pinch.center);
      cropState.offsetX += measured.center.x - pinch.center.x; cropState.offsetY += measured.center.y - pinch.center.y;
    } else { cropState.offsetX += point.x - previous.x; cropState.offsetY += point.y - previous.y; }
    drawCrop();
  });
  for (const type of ['pointerup','pointercancel','lostpointercapture']) el('cropCanvas').addEventListener(type, event => { cropPointers.delete(event.pointerId); pinch = null; });
  el('cropCanvas').addEventListener('keydown', event => {
    if (!cropImage || busy) return;
    const movements = { ArrowLeft:[-16,0],ArrowRight:[16,0],ArrowUp:[0,-16],ArrowDown:[0,16] };
    if (movements[event.key]) { event.preventDefault(); cropState.offsetX += movements[event.key][0]; cropState.offsetY += movements[event.key][1]; drawCrop(); }
    else if (['+','=','-','Home'].includes(event.key)) { event.preventDefault(); if (event.key === 'Home') resetCrop(); else setCropZoom(cropState.zoom + (event.key === '-' ? -.1 : .1)); }
  });
  el('cancelCrop').addEventListener('click', closeCrop);
  // A stationary touch remains usable after dragging the crop canvas, including
  // browsers that suppress its following compatibility click.
  let confirmTouch = null;
  el('confirmCrop').addEventListener('pointerdown', event => {
    confirmTouch = event.pointerType === 'touch' && event.isPrimary ? {id:event.pointerId,x:event.clientX,y:event.clientY,moved:false} : null;
  });
  el('confirmCrop').addEventListener('pointermove', event => {
    if(confirmTouch?.id===event.pointerId && Math.hypot(event.clientX-confirmTouch.x,event.clientY-confirmTouch.y)>8) confirmTouch.moved=true;
  });
  el('confirmCrop').addEventListener('pointercancel', () => { confirmTouch=null; });
  el('confirmCrop').addEventListener('pointerup', event => {
    const touch=confirmTouch;confirmTouch=null;
    if(touch?.id===event.pointerId && !touch.moved) event.currentTarget.click();
  });
  el('confirmCrop').addEventListener('click', async () => {
    if (busy || crop.hidden) return; busy = true; el('confirmCrop').disabled = true; el('cancelCrop').disabled = true; message('cropMessage', 'Enregistrement de la photo…');
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
  pageMotion = createPageMotion({ view:app, header:app.querySelector('.app-header'), canAnimate:()=>overlay.hidden&&!app.hidden&&!inStep });
  tabNavigation = createTabNavigation({ nav: dock.querySelector('nav'), view: app, pages, getPage: () => page, navigate: showPage,
    canNavigate: () => overlay.hidden && crop.hidden && upcoming.hidden && !experience.getState().activeAR && !busy && el('poiModal').hidden && el('storiesModal').hidden && el('panoramaPanel').hidden });
  showPage('home', { focus: false, history: false }); renderProfile();
  overlay.hidden = false; app.inert = true; dock.hidden = true; message('onboardingStatus', 'Préparation de votre découverte…');
  account.restore().then(restored => {
    state = restored;
    if (state.profile.pseudo && (state.guest || state.connected)) completeOnboarding(); else if (state.connected) openSetup(); else openWelcome();
  }).catch(error => { openWelcome(); message('onboardingStatus', error.message, true); })
    .finally(() => document.dispatchEvent(new CustomEvent('memoria:ready')));
  return { account, showPage, startStep };
}
