import { CORTE_STOPS, CORTE_PHOTOS, CORTE_FIXED_POINT } from '../content/corte.js?v=21';
import { projectCoordinate, walkingRoute } from './city-map.js';

const NS = 'http://www.w3.org/2000/svg';
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const normalized = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"/></svg>`;
export const MAP_PLACES = [
  ...CORTE_STOPS.map(stop => ({ ...stop, kind: 'step', photo: CORTE_PHOTOS.find(photo => photo.id === stop.id) || null })),
  { ...CORTE_FIXED_POINT, kind: 'fixed' }
];
export const directionsURL = place => `https://www.google.com/maps/dir/?api=1&destination=${place.coordinates[1]},${place.coordinates[0]}&travelmode=walking`;
export function filterMapPlaces(places, text = '', filter = 'all') {
  const needle = normalized(text.trim());
  return places.filter(place => (filter === 'all' || place.kind === filter) &&
    normalized([place.title, place.subtitle || '', place.description, ...place.coordinates].join(' ')).includes(needle));
}

export function createImmersiveMap(container, { onStep, onComing }) {
  container.dataset.map = '';
  container.innerHTML = `
    <div class="atlas-frame" tabindex="0" role="region" aria-label="Carte interactive de Corte" aria-describedby="atlasHelp">
      <svg class="city-map-svg" xmlns="${NS}" aria-hidden="true" preserveAspectRatio="none">
        <g class="map-land"></g><g class="map-buildings"></g><g class="map-water"></g><g class="map-roads"></g><g class="map-route"></g><g class="map-labels"></g>
      </svg>
      <svg class="map-marker-leaders" aria-hidden="true"></svg>
      <div class="map-markers"></div>
    </div>
    <header class="atlas-header">
      <div class="atlas-heading"><div><span class="eyebrow">MEMORIA CORTI</span><h1 id="mapTitle">Corte, à votre rythme.</h1></div><span class="atlas-location">${icon('pin')} Corse</span></div>
      <form class="atlas-search" role="search"><label class="sr-only" for="mapSearch">Rechercher un lieu à Corte</label>${icon('search')}<input id="mapSearch" type="search" placeholder="Un lieu, une étape…" autocomplete="off"><button id="clearMapSearch" type="button" aria-label="Effacer la recherche" hidden>${icon('close')}</button></form>
    </header>
    <div class="atlas-filters" role="group" aria-label="Filtrer la carte"><button type="button" data-filter="all" aria-pressed="true">Tout voir</button><button type="button" data-filter="step" aria-pressed="false">Les étapes</button><button type="button" data-filter="fixed" aria-pressed="false">${icon('pin')} Point fixe</button></div>
    <div class="atlas-controls" role="group" aria-label="Commandes de la carte">
      <button id="map-in" type="button" aria-label="Agrandir la carte" title="Agrandir">+</button>
      <button id="map-out" type="button" aria-label="Réduire la carte" title="Réduire">−</button>
      <button id="map-reset" type="button" aria-label="Recentrer sur tous les lieux" title="Recentrer">${icon('fit')}</button>
    </div>
    <div class="atlas-load" role="status"><span class="atlas-loading-dot" aria-hidden="true"></span><span class="atlas-load-text">Chargement du plan de Corte…</span><button id="retryMap" type="button" hidden>Réessayer</button></div>
    <a class="atlas-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a>
    <aside class="atlas-sheet" data-position="compact" aria-labelledby="sheetTitle" data-no-swipe>
      <button class="sheet-handle" type="button" aria-label="Agrandir le panneau des lieux" aria-expanded="false" aria-controls="sheetContent"><span aria-hidden="true"></span></button>
      <div class="sheet-heading"><div><p class="eyebrow">LE PARCOURS</p><h2 id="sheetTitle">Les lieux de Corte</h2><p id="mapResults" role="status">2 étapes · 1 point fixe</p></div><button class="sheet-close" type="button" aria-label="Réduire le panneau" title="Réduire le panneau">${icon('chevron')}</button></div>
      <div class="sheet-positions" role="group" aria-label="Affichage des lieux"><button type="button" data-position="compact" aria-pressed="true">Aperçu</button><button type="button" data-position="list" aria-pressed="false">Liste</button><button type="button" data-position="detail" aria-pressed="false">Fiche</button></div>
      <div id="sheetContent" class="sheet-content">
        <div class="atlas-list-view"><ol class="atlas-list" aria-label="Lieux du parcours"></ol><div class="atlas-empty" hidden><h3>Aucun lieu trouvé</h3><p>Essayez « IUT », « Palazzu » ou « GPS ».</p><button id="resetMapFilters" type="button">Afficher tous les lieux</button></div><p class="atlas-route-note">Liaison piétonne indicative sur les voies du plan. Vérifiez les accès sur place.</p><p id="atlasHelp">Déplacez le plan au doigt ou avec les flèches du clavier. Pincez ou utilisez + et − pour zoomer. La liste donne accès aux mêmes lieux.</p></div>
        <article class="atlas-detail" hidden aria-labelledby="mapPlaceTitle">
          <div class="atlas-detail-header"><button class="detail-back text-button" type="button">← Les lieux</button><button class="detail-close" type="button" aria-label="Fermer la fiche">${icon('close')}</button></div>
          <figure class="atlas-photo"><img class="atlas-photo-image" alt="" width="640" height="420" hidden><div class="atlas-photo-missing">${icon('camera')}<span>Photographie du lieu à fournir</span></div><figcaption class="atlas-photo-credit"></figcaption></figure>
          <span class="map-stop-status status-pill"></span><h3 id="mapPlaceTitle" tabindex="-1"></h3><p class="map-place-description"></p>
          <dl class="atlas-facts"></dl>
          <a class="atlas-directions primary-link" target="_blank" rel="noopener noreferrer">Voir l’itinéraire ${icon('arrow')}</a>
          <button class="atlas-start" type="button"></button>
          <p class="atlas-external-note">Itinéraire à pied dans Google Maps · s’ouvre dans un nouvel onglet.</p>
        </article>
      </div>
    </aside>`;
  const q = selector => container.querySelector(selector);
  const svg = q('.city-map-svg'), frame = q('.atlas-frame'), sheet = q('.atlas-sheet');
  const desktop = matchMedia('(min-width: 900px)');
  let data = null, loading = null, active = false, selected = null, selectionOrigin = null;
  let filter = 'all', position = 'compact', view = { x: 0, y: 0, w: 900, h: 1000 }, initial = null;
  let size = null, mapFrame = 0, pointers = new Map(), pinch = null, sheetDrag = null;
  const records = [];

  function setPosition(next, { focus = false } = {}) {
    if (desktop.matches && next === 'compact') next = 'list';
    if (next === 'detail' && !selected) select(MAP_PLACES[0], { focus: false, open: false });
    position = next; sheet.dataset.position = next; container.dataset.sheet = next;
    // On mobile the expanded detail covers the floating controls. Keep keyboard
    // focus in the visible content while leaving the main navigation available.
    const coversMap = !desktop.matches && next === 'detail';
    frame.inert = coversMap; q('.atlas-header').inert = coversMap; q('.atlas-filters').inert = coversMap;
    q('.atlas-controls').inert = !desktop.matches && next !== 'compact';
    for (const record of records) record.marker.tabIndex = !desktop.matches && next !== 'compact' ? -1 : 0;
    sheet.style.removeProperty('--drag-offset'); sheet.classList.remove('is-dragging');
    for (const button of sheet.querySelectorAll('[data-position]')) button.setAttribute('aria-pressed', String(button.dataset.position === next));
    q('.sheet-handle').setAttribute('aria-expanded', String(next !== 'compact'));
    q('.sheet-handle').setAttribute('aria-label', next === 'compact' ? 'Afficher la liste des lieux' : 'Réduire le panneau des lieux');
    q('.atlas-list-view').hidden = next === 'detail';
    q('.atlas-detail').hidden = next !== 'detail';
    q('.sheet-close').hidden = next === 'compact';
    if (focus) (next === 'detail' ? q('#mapPlaceTitle') : q('.atlas-list button'))?.focus({ preventScroll: true });
  }
  function closeDetail() {
    setPosition('list');
    // In the mobile list, the original marker can be covered by the sheet.
    // Return to the same place in the visible list instead.
    const item = records.find(record => record.place.id === selected?.id)?.item;
    const target = !desktop.matches ? item : selectionOrigin?.getClientRects().length ? selectionOrigin : item;
    target?.focus({ preventScroll: true });
    // Scroll immediately, so a delayed focus restoration cannot move a button
    // after the visitor has already started another action.
    target?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  function fact(term, value) {
    const row = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = term; dd.textContent = value; row.append(dt, dd); return row;
  }
  function select(place, { focus = true, open = true } = {}) {
    selected = place;
    for (const record of records) {
      const isSelected = record.place.id === place.id;
      record.marker.setAttribute('aria-pressed', String(isSelected));
      record.item.setAttribute('aria-pressed', String(isSelected));
    }
    q('#mapPlaceTitle').textContent = place.title;
    q('.map-place-description').textContent = place.description;
    q('.map-stop-status').textContent = place.kind === 'fixed' ? 'Point fixe · GPS' : `Étape ${place.number} · ${place.available ? 'Disponible' : 'À venir'}`;
    q('.map-stop-status').classList.toggle('coming', place.kind === 'step' && !place.available);
    q('.atlas-facts').replaceChildren(
      fact('Coordonnées', `${place.coordinates[1].toFixed(6)}, ${place.coordinates[0].toFixed(6)}`),
      fact('Sur place', place.practical || 'Horaires et conditions d’accès non renseignés.'),
      fact('Parcours', place.kind === 'step' ? `Étape ${place.number} · ${place.subtitle}` : place.stepId ? CORTE_STOPS.find(stop => stop.id === place.stepId)?.title || 'Étape à confirmer' : 'Aucune étape associée pour le moment.')
    );
    const image = q('.atlas-photo-image'), credit = q('.atlas-photo-credit');
    image.hidden = true; image.removeAttribute('src'); image.alt = '';
    q('.atlas-photo-missing').hidden = false;
    q('.atlas-photo-missing span').textContent = 'Photographie du lieu à fournir';
    credit.replaceChildren();
    if (place.photo) {
      const photo = place.photo;
      image.onload = () => { if (selected?.id === place.id) { image.hidden = false; q('.atlas-photo-missing').hidden = true; } };
      image.onerror = () => { if (selected?.id === place.id) { image.hidden = true; q('.atlas-photo-missing').hidden = false; q('.atlas-photo-missing span').textContent = 'La photographie n’est pas disponible.'; } };
      image.alt = photo.alt; image.style.objectPosition = photo.position || 'center'; image.src = photo.src;
      for (const [label, href] of [[photo.author, photo.source], [photo.license, photo.licenseURL]]) {
        const link = document.createElement('a'); link.textContent = label; link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; credit.append(link);
      }
    }
    q('.atlas-directions').href = directionsURL(place);
    q('.atlas-start').hidden = place.kind !== 'step';
    q('.atlas-start').textContent = place.available ? 'Découvrir cette étape' : 'À propos de cette étape';
    if (open) { setPosition('detail', { focus }); q('.sheet-content').scrollTop = 0; }
  }
  for (const place of MAP_PLACES) {
    const marker = document.createElement('button');
    marker.type = 'button'; marker.id = 'map-stop-' + place.id;
    marker.className = 'atlas-marker' + (place.kind === 'fixed' ? ' is-fixed' : place.photo ? ' is-photo' : '');
    marker.dataset.longitude = place.coordinates[0]; marker.dataset.latitude = place.coordinates[1];
    marker.setAttribute('aria-label', place.kind === 'fixed' ? 'Point GPS fixe : 42.297500, 9.154278. Ouvrir la fiche' : `Étape ${place.number} · ${place.title}`);
    marker.setAttribute('aria-pressed', 'false');
    if (place.photo) { const image = document.createElement('img'); image.src = place.photo.src; image.alt = ''; image.style.objectPosition = place.photo.position; image.onerror = () => image.hidden = true; marker.append(image); }
    const badge = document.createElement('span'); badge.className = 'atlas-marker-number'; badge.textContent = place.number || 'GPS'; marker.append(badge);
    if (place.kind === 'fixed' || place.photo) {
      const label = document.createElement('span'); label.className = 'atlas-marker-label';
      label.textContent = place.kind === 'fixed' ? 'Point fixe' : place.title;
      label.setAttribute('aria-hidden', 'true'); marker.append(label);
    }
    const leader = document.createElementNS(NS, 'line'); leader.classList.add('atlas-leader'); q('.map-marker-leaders').append(leader);
    q('.map-markers').append(marker);
    const li = document.createElement('li'), item = document.createElement('button'); item.type = 'button'; item.dataset.place = place.id;
    item.innerHTML = '<span class="atlas-list-number"></span><span class="atlas-list-copy"><strong></strong><small></small></span>' + icon('arrow');
    const listNumber = item.querySelector('.atlas-list-number');
    listNumber.textContent = place.number || 'GPS';
    if (place.photo) {
      listNumber.classList.add('has-photo');
      const thumbnail = document.createElement('img'); thumbnail.src = place.photo.src; thumbnail.alt = ''; thumbnail.width = 48; thumbnail.height = 48; thumbnail.decoding = 'async'; thumbnail.style.objectPosition = place.photo.position;
      const number = document.createElement('span'); number.textContent = place.number;
      thumbnail.onerror = () => { listNumber.classList.remove('has-photo'); listNumber.textContent = place.number; };
      listNumber.replaceChildren(thumbnail, number);
    }
    item.querySelector('strong').textContent = place.title;
    item.querySelector('small').textContent = place.kind === 'fixed' ? 'Point fixe · lieu à documenter' : place.available ? 'Campus Grimaldi · Disponible' : 'Ville haute · À venir';
    item.setAttribute('aria-pressed', 'false'); li.append(item); q('.atlas-list').append(li);
    for (const control of [marker, item]) control.addEventListener('click', () => { selectionOrigin = control; select(place); });
    records.push({ place, marker, leader, li, item });
  }
  function applyFilters() {
    const matches = new Set(filterMapPlaces(MAP_PLACES, q('#mapSearch').value, filter).map(place => place.id));
    for (const record of records) { record.filtered = !matches.has(record.place.id); record.li.hidden = record.filtered; record.marker.hidden = record.filtered || !data; record.leader.hidden = record.filtered; }
    q('#clearMapSearch').hidden = !q('#mapSearch').value;
    q('#mapResults').textContent = matches.size === MAP_PLACES.length ? '2 étapes · 1 point fixe' : `${matches.size} lieu${matches.size > 1 ? 'x' : ''} trouvé${matches.size > 1 ? 's' : ''}`;
    q('.atlas-empty').hidden = matches.size > 0;
    if (selected && !matches.has(selected.id)) { selected = null; for (const record of records) { record.marker.setAttribute('aria-pressed','false'); record.item.setAttribute('aria-pressed','false'); } }
    setPosition('list'); scheduleView();
  }
  q('.atlas-search').addEventListener('submit', event => { event.preventDefault(); q('.atlas-list li:not([hidden]) button')?.focus(); });
  q('#mapSearch').addEventListener('input', applyFilters);
  q('#clearMapSearch').addEventListener('click', () => { q('#mapSearch').value = ''; applyFilters(); q('#mapSearch').focus(); });
  q('#resetMapFilters').addEventListener('click', () => { filter = 'all'; q('#mapSearch').value = ''; for (const b of container.querySelectorAll('[data-filter]')) b.setAttribute('aria-pressed',String(b.dataset.filter === filter)); applyFilters(); });
  for (const b of container.querySelectorAll('[data-filter]')) b.addEventListener('click', () => { filter = b.dataset.filter; for (const button of container.querySelectorAll('[data-filter]')) button.setAttribute('aria-pressed',String(button === b)); applyFilters(); });
  for (const b of sheet.querySelectorAll('[data-position]')) b.addEventListener('click', () => setPosition(b.dataset.position));
  q('.sheet-close').addEventListener('click', () => { setPosition('compact'); q('.sheet-handle').focus(); });
  q('.detail-close').addEventListener('click', closeDetail); q('.detail-back').addEventListener('click', closeDetail);
  q('.atlas-start').addEventListener('click', () => selected?.available ? onStep() : onComing(selected.title));
  container.addEventListener('keydown', event => {
    if (event.key === 'Escape' && position !== 'compact') { event.preventDefault(); if (position === 'detail') closeDetail(); else { setPosition('compact'); q('.sheet-handle').focus(); } }
  });

  const handle = q('.sheet-handle');
  let suppressHandleClick = false;
  handle.addEventListener('click', () => { if (suppressHandleClick) { suppressHandleClick = false; return; } setPosition(position === 'compact' ? 'list' : 'compact'); });
  handle.addEventListener('pointerdown', event => {
    if (desktop.matches || event.button > 0) return;
    suppressHandleClick = false;
    sheetDrag = { id: event.pointerId, y: event.clientY, delta: 0, start: position };
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove', event => {
    if (sheetDrag?.id !== event.pointerId) return;
    sheetDrag.delta = event.clientY - sheetDrag.y;
    if (Math.abs(sheetDrag.delta) > 8) { sheet.classList.add('is-dragging'); sheet.style.setProperty('--drag-offset', clamp(sheetDrag.delta,-120,160) + 'px'); }
  });
  function endSheet(event) {
    if (sheetDrag?.id !== event.pointerId) return;
    const { delta, start } = sheetDrag; sheetDrag = null;
    const levels = ['compact','list','detail'];
    suppressHandleClick = Math.abs(delta) > 8;
    const index = levels.indexOf(start);
    setPosition(event.type === 'pointercancel' ? start : levels[clamp(index + (delta < -35 ? 1 : delta > 35 ? -1 : 0),0,2)]);
  }
  handle.addEventListener('pointerup',endSheet); handle.addEventListener('pointercancel',endSheet);
  handle.addEventListener('keydown', event => { if (['ArrowUp','ArrowDown','Home','End'].includes(event.key)) { event.preventDefault(); const levels=['compact','list','detail']; setPosition(event.key === 'Home' ? 'compact' : event.key === 'End' ? 'detail' : levels[clamp(levels.indexOf(position)+(event.key === 'ArrowUp'?1:-1),0,2)]); } });

  function scheduleView() { if (!mapFrame && active) mapFrame = requestAnimationFrame(() => { mapFrame = 0; renderView(); }); }
  function renderView() {
    if (!data || !frame.clientWidth || !active) return;
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    const sx = frame.clientWidth / view.w, sy = frame.clientHeight / view.h;
    const points = new Map(records.map(record => { const p = projectCoordinate(record.place.coordinates,data.bbox); return [record.place.id,[(p[0]-view.x)*sx,(p[1]-view.y)*sy]]; }));
    const gps = points.get('fixed-gps'), iut = points.get('iut');
    const close = Math.hypot(gps[0]-iut[0],gps[1]-iut[1]) < 90;
    for (const record of records) {
      const [x,y] = points.get(record.place.id);
      const offset = record.place.id === 'iut' && close ? [-55,26] : [0,0];
      record.marker.style.left = x+offset[0]+'px'; record.marker.style.top = y+offset[1]+'px';
      const offscreen = x+offset[0] < 30 || x+offset[0] > frame.clientWidth-30 || y+offset[1] < 30 || y+offset[1] > frame.clientHeight-30;
      record.marker.hidden = !!record.filtered || offscreen;
      record.leader.style.display = record.filtered || offscreen || !offset[0] ? 'none' : '';
      for (const [key,value] of Object.entries({x1:x,y1:y,x2:x+offset[0],y2:y+offset[1]})) record.leader.setAttribute(key,value);
    }
    q('#map-in').disabled = !!initial && view.w <= initial.w/5 + .01;
    q('#map-out').disabled = !!initial && view.w >= initial.w*1.7 - .01;
  }
  function constrain() {
    // Keep the local geographical extract within reach after repeated drags.
    view.x = clamp(view.x, -view.w*.65, 900-view.w*.35);
    view.y = clamp(view.y, -view.h*.65, 1000-view.h*.35);
  }
  function reset() {
    if (!data || !active || !frame.clientWidth) return;
    const w = frame.clientWidth, h = frame.clientHeight;
    const points = MAP_PLACES.map(place => projectCoordinate(place.coordinates,data.bbox));
    const xs = points.map(p=>p[0]), ys = points.map(p=>p[1]);
    const left = desktop.matches ? Math.min(410,w*.34)+45 : 76;
    const right = desktop.matches ? 94 : 65;
    const top = desktop.matches ? 190 : q('.atlas-header').getBoundingClientRect().bottom + 88;
    const bottom = desktop.matches ? 150 : (parseFloat(getComputedStyle(sheet).bottom) || 100) + 196 + 80 + q('.atlas-filters').offsetHeight + 12;
    const availableW = Math.max(130,w-left-right), availableH = Math.max(110,h-top-bottom);
    const scale = Math.max((Math.max(...xs)-Math.min(...xs))/availableW,(Math.max(...ys)-Math.min(...ys))/availableH);
    view = { x:(Math.max(...xs)+Math.min(...xs))/2-(left+availableW/2)*scale, y:(Math.max(...ys)+Math.min(...ys))/2-(top+availableH/2)*scale, w:w*scale, h:h*scale };
    initial={...view}; size={w,h}; renderView();
  }
  function zoom(factor, anchor = {x:frame.clientWidth/2,y:frame.clientHeight/2}) {
    if (!initial) return;
    const next=clamp(view.w/factor,initial.w/5,initial.w*1.7), ratio=next/view.w;
    view={x:view.x+anchor.x/frame.clientWidth*view.w*(1-ratio),y:view.y+anchor.y/frame.clientHeight*view.h*(1-ratio),w:next,h:view.h*ratio};
    constrain(); scheduleView();
  }
  function addPath(feature, group, className) {
    const path=document.createElementNS(NS,'path');
    path.setAttribute('d',feature.coordinates.map((p,i)=>{const [x,y]=projectCoordinate(p,data.bbox);return (i?'L':'M')+x.toFixed(2)+','+y.toFixed(2);}).join(' '));
    path.setAttribute('class',className); path.setAttribute('vector-effect','non-scaling-stroke'); group.append(path);
  }
  async function load() {
    if (data) { scheduleView(); return; } if (loading) return loading;
    q('.atlas-load').hidden=false; q('.atlas-load-text').textContent='Chargement du plan de Corte…'; q('#retryMap').hidden=true;
    loading=(async()=>{
      try {
        const response=await fetch('assets/maps/corte.json',{signal:AbortSignal.timeout(15000)});
        if(!response.ok)throw Error('map');
        const result=await response.json(); if(!Array.isArray(result.features)||result.bbox?.length!==4)throw Error('map');
        data=result;
        for(const group of svg.querySelectorAll('g'))group.replaceChildren();
        for(const feature of data.features) {
          const tags=feature.tags;
          if(tags.building)addPath(feature,q('.map-buildings'),'map-building');
          else if(tags.waterway||tags.natural==='water')addPath(feature,q('.map-water'),tags.natural==='water'?'map-water-area':'map-river');
          else if(tags.landuse||tags.leisure)addPath(feature,q('.map-land'),'map-green');
          if(tags.highway)addPath(feature,q('.map-roads'),'map-road '+(['footway','path','steps','pedestrian'].includes(tags.highway)?'map-footway':'map-street'));
        }
        const route=walkingRoute(data.features,CORTE_STOPS.map(stop=>stop.coordinates));
        if(route)addPath(route,q('.map-route'),'map-route-line');
        q('.atlas-route-note').textContent=route?'Liaison piétonne indicative sur les voies du plan. Vérifiez les accès sur place.':'Le tracé est indisponible. Les lieux et leurs itinéraires restent accessibles.';
        for(const [label,coordinate] of [['VILLE HAUTE',[9.1478,42.3065]],['CAMPUS GRIMALDI',[9.1556,42.299]],['Le Tavignano',[9.149,42.3016]],['CORTE',[9.1545,42.3079]]]) {
          const [x,y]=projectCoordinate(coordinate,data.bbox), text=document.createElementNS(NS,'text');text.setAttribute('x',x);text.setAttribute('y',y);text.textContent=label;q('.map-labels').append(text);
        }
        q('.atlas-load').hidden=true; reset();
      } catch {
        data=null; q('.atlas-list-view').prepend(q('.atlas-load')); q('.atlas-load').classList.add('is-error'); q('.atlas-load-text').textContent='Le plan est indisponible. Retrouvez tous les lieux dans la liste.'; q('#retryMap').hidden=false; setPosition('list');
      } finally { loading=null; }
    })(); return loading;
  }
  q('#retryMap').addEventListener('click',load); q('#map-reset').addEventListener('click',reset);
  q('#map-in').addEventListener('click',()=>zoom(1.35)); q('#map-out').addEventListener('click',()=>zoom(1/1.35));
  frame.addEventListener('wheel',event=>{if(!data)return;event.preventDefault();const rect=frame.getBoundingClientRect();zoom(Math.exp(-clamp(event.deltaY,-120,120)*.003),{x:event.clientX-rect.left,y:event.clientY-rect.top});},{passive:false});
  frame.addEventListener('pointerdown',event=>{
    if(event.target.closest('button,a')||!data||event.button>0)return;
    frame.setPointerCapture(event.pointerId); pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),center:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},view:{...view}};}
  });
  frame.addEventListener('pointermove',event=>{
    const before=pointers.get(event.pointerId);if(!before)return;event.preventDefault();
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size===2&&pinch) {
      const [a,b]=[...pointers.values()],rect=frame.getBoundingClientRect();
      view={...pinch.view}; zoom(Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinch.distance),{x:pinch.center.x-rect.left,y:pinch.center.y-rect.top});
      view.x-=((a.x+b.x)/2-pinch.center.x)*view.w/frame.clientWidth;view.y-=((a.y+b.y)/2-pinch.center.y)*view.h/frame.clientHeight;
    } else if(pointers.size===1) { view.x-=(event.clientX-before.x)*view.w/frame.clientWidth;view.y-=(event.clientY-before.y)*view.h/frame.clientHeight; }
    constrain();scheduleView();
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])frame.addEventListener(type,event=>{pointers.delete(event.pointerId);pinch=null;});
  frame.addEventListener('keydown',event=>{
    if(event.target!==frame||!data)return;
    const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
    if(d){event.preventDefault();view.x+=d[0]*view.w*.08;view.y+=d[1]*view.h*.08;constrain();scheduleView();}
    else if(['+','=','-','Home'].includes(event.key)){event.preventDefault();event.key==='Home'?reset():zoom(event.key==='-'?1/1.35:1.35);}
  });
  function resize() {
    if(!active||!data||!frame.clientWidth)return;
    const w=frame.clientWidth,h=frame.clientHeight;
    if(!initial||!size){reset();return;}
    if(size.w!==w||size.h!==h){const cx=view.x+view.w/2,cy=view.y+view.h/2;view.h=view.w*h/w;view.x=cx-view.w/2;view.y=cy-view.h/2;size={w,h};}
    scheduleView();
  }
  const observer=new ResizeObserver(resize);observer.observe(frame);
  desktop.addEventListener('change',()=>{setPosition(position);if(active)reset();});
  for (const record of records) record.marker.hidden=true;
  setPosition('compact');
  return {
    async activate() { active=true; await load(); if(!initial)reset();else resize(); },
    deactivate() { active=false;pointers.clear();pinch=null;if(mapFrame)cancelAnimationFrame(mapFrame);mapFrame=0; },
    select(id) { const place=MAP_PLACES.find(p=>p.id===id);if(place)select(place); },
    getState() { return { selected: selected?.id || null, position, filter, view:{...view} }; }
  };
}
