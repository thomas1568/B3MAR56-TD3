import { CORTE_STOPS, CORTE_PHOTOS, CORTE_FIXED_POINT, photoVariants } from '../content/corte.js?v=31';
import { MAP_CONFIG } from './config.js?v=31';
import { loadLeaflet } from './leaflet-loader.js?v=31';
import { createWalkingRouter, validCoordinate, distanceBetween, nearestOnRoute } from './routing.js?v=31';

export const MAP_PLACES = [...CORTE_STOPS.map(stop=>({...stop,kind:'step',photo:CORTE_PHOTOS.find(p=>p.id===stop.id)||null})),{...CORTE_FIXED_POINT,kind:'fixed'}];
export const directionsURL = place => `https://www.google.com/maps/dir/?api=1&destination=${place.coordinates[1]},${place.coordinates[0]}&travelmode=walking`;
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function filterMapPlaces(places,text='',filter='all'){const needle=normalize(text.trim());return places.filter(p=>(filter==='all'||p.kind===filter)&&normalize([p.title,p.subtitle||'',p.description,...p.coordinates].join(' ')).includes(needle));}
const icon=n=>`<svg class="icon" aria-hidden="true"><use href="#icon-${n}"/></svg>`;
const metric=m=>m>=1000?(m/1000).toLocaleString('fr-FR',{maximumFractionDigits:1})+' km':Math.round(m)+' m';
const clock=s=>s<60?'Moins d’une minute':Math.ceil(s/60)+' min';
export function createImmersiveMap(container,{onStep,onComing,onSelection=()=>{}}) {
  container.dataset.map='';container.dataset.sheet='compact';
  container.innerHTML=`
    <div id="walkingMap" class="atlas-frame" role="region" aria-label="Carte de Corte et itinéraire piéton"></div>
    <header class="atlas-header"><p class="eyebrow">VOTRE PARCOURS DANS CORTE</p><h1 id="routeTitle" tabindex="-1">De lieu en lieu.</h1>
      <form class="atlas-search" role="search">${icon('search')}<label class="sr-only" for="mapSearch">Rechercher un lieu</label><input id="mapSearch" type="search" placeholder="Rechercher dans le parcours" autocomplete="off"><button id="clearMapSearch" type="button" aria-label="Effacer la recherche" hidden>${icon('close')}</button></form>
    </header>
    <div class="atlas-controls" role="group" aria-label="Commandes du plan"><button id="map-in" type="button" aria-label="Agrandir la carte">+</button><button id="map-out" type="button" aria-label="Réduire la carte">−</button><button id="map-reset" type="button" aria-label="Recentrer sur le parcours">${icon('fit')}</button><button id="map-locate" type="button" aria-label="Utiliser ma position sur la carte">${icon('pin')}</button></div>
    <p id="mapStatus" class="map-feedback" role="status">Le plan se chargera à l’ouverture du parcours.</p><button id="retryMap" class="map-retry" type="button" hidden>Recharger le plan</button>
    <aside class="atlas-sheet" data-position="compact" aria-labelledby="sheetTitle" data-no-swipe>
      <button class="sheet-handle" type="button" aria-controls="sheetContent" aria-expanded="false" aria-label="Développer la liste des lieux"><span aria-hidden="true"></span></button>
      <div class="sheet-heading"><div><p class="eyebrow">2 ÉTAPES · 1 POINT FIXE</p><h2 id="sheetTitle">Les lieux de Corte</h2><p id="mapResults" role="status">Une première étape disponible</p></div><button class="sheet-close" type="button" aria-label="Réduire le panneau" hidden>${icon('chevron')}</button></div>
      <div class="sheet-positions" role="group" aria-label="Affichage du parcours"><button type="button" data-position="compact" aria-pressed="true">Aperçu</button><button type="button" data-position="list" aria-pressed="false">Les lieux</button><button type="button" data-position="detail" aria-pressed="false">La fiche</button></div>
      <div id="sheetContent" class="sheet-content">
        <div class="atlas-list-view"><ol class="atlas-list" aria-label="Lieux du parcours"></ol><div class="atlas-empty" hidden><h3>Aucun lieu trouvé</h3><p>Essayez « IUT », « Palazzu » ou « GPS ».</p><button id="resetMapFilters" type="button">Afficher tous les lieux</button></div>
          <section class="route-progress-block" aria-labelledby="routeProgressTitle"><p class="eyebrow">VOTRE DÉCOUVERTE</p><h3 id="routeProgressTitle">Corte, une ville de savoir</h3><p><strong id="routeCount">0 / 5</strong> repères consultés à l’IUT</p><progress id="routeProgress" max="5" value="0" aria-label="Repères de l’IUT consultés"></progress><p id="routeDescription">Votre découverte commence sur le campus Grimaldi.</p><button id="routeStartButton" class="primary" type="button">Découvrir l’étape ${icon('arrow')}</button></section>
          <p class="small-note">Le point GPS est un lieu fixe. Votre position apparaît uniquement après votre autorisation.</p>
        </div>
        <article class="atlas-detail" hidden aria-labelledby="mapPlaceTitle"><div class="atlas-detail-header"><button class="detail-back text-button" type="button">← Les lieux</button><button class="detail-close icon-button" type="button" aria-label="Fermer la fiche">${icon('close')}</button></div>
          <figure class="atlas-photo"><img class="atlas-photo-image" alt="" width="640" height="420" hidden><div class="atlas-photo-missing">${icon('camera')}<span>Photographie du lieu à fournir</span></div><figcaption class="atlas-photo-credit"></figcaption></figure>
          <span class="map-stop-status status-pill"></span><h3 id="mapPlaceTitle" tabindex="-1"></h3><p class="map-place-description"></p><dl class="atlas-facts"></dl>
          <button id="planWalking" class="primary" type="button">Y aller à pied ${icon('route')}</button><button class="atlas-start" type="button"></button><a class="atlas-directions text-button" target="_blank" rel="noopener noreferrer">Ouvrir un plan externe ↗</a>
        </article>
        <section class="walking-planner" hidden aria-labelledby="walkingTitle">
          <div class="atlas-detail-header"><button id="walkingBack" class="text-button" type="button">← Le lieu</button><button id="closeWalking" class="icon-button" type="button" aria-label="Fermer le panneau d’itinéraire">${icon('close')}</button></div>
          <p class="eyebrow">ITINÉRAIRE À PIED</p><h3 id="walkingTitle" tabindex="-1">Préparer mon trajet</h3><p id="walkingDestination"></p>
          <form id="walkingForm"><label for="walkingStart">Votre départ</label><select id="walkingStart"></select>
            <div id="customStartFields" hidden><label for="startLatitude">Latitude du départ</label><input id="startLatitude" type="number" min="-90" max="90" step="any" inputmode="decimal" placeholder="42.300000"><label for="startLongitude">Longitude du départ</label><input id="startLongitude" type="number" min="-180" max="180" step="any" inputmode="decimal" placeholder="9.150000"></div>
            <div class="button-row"><button id="useWalkingLocation" type="button">${icon('pin')} Ma position</button><button id="pickStart" type="button">Choisir sur le plan</button></div><p class="small-note">Votre position est transmise à l’IGN uniquement pour ce trajet. Vous pouvez choisir un départ manuellement.</p>
            <button id="calculateWalking" class="primary" type="submit">Calculer le trajet</button><button id="cancelWalkingRequest" type="button" hidden>Annuler le calcul</button>
          </form><p id="walkingStatus" class="form-message" role="status" aria-live="polite"></p>
          <div id="walkingResult" hidden><div class="walking-summary"><strong id="walkingDistance"></strong><span id="walkingDuration"></span></div><p id="walkingSource" class="small-note"></p><p id="walkingAccess" class="small-note"></p>
            <details open><summary>Les indications du trajet</summary><ol id="walkingInstructions" class="walking-instructions"></ol></details>
            <button id="startGuidance" class="primary" type="button">Suivre ma position</button><button id="stopGuidance" type="button" hidden>Arrêter le suivi</button><button id="recalculateWalking" type="button" hidden>Recalculer depuis ma position</button>
            <progress id="walkingProgress" max="100" value="0" aria-label="Avancement le long du trajet" hidden></progress><p id="guidanceStatus" role="status"></p><button id="clearWalking" class="text-button" type="button">Effacer cet itinéraire</button>
          </div>
        </section>
      </div>
    </aside>`;
  const q=s=>container.querySelector(s),sheet=q('.atlas-sheet'),desktop=matchMedia('(min-width:900px)');
  const router=createWalkingRouter();let L=null,map=null,tileLayer=null,loaded=false,loading=null,active=false,selected=null,position='compact',planner=false,pickMode=false;
  let route=null,routeLayer=null,startLayer=null,userLayer=null,accuracyLayer=null,leader=null,fallback=null,lastLocation=null,watchId=null,maxProgress=0,requestId=0,tileErrors=0;
  const markers=new Map(),items=new Map();let origin=null,drag=null,suppressClick=false;
  const latlng=p=>[p[1],p[0]];
  function status(text,error=false){q('#walkingStatus').textContent=text;q('#walkingStatus').classList.toggle('is-error',error);}
  function setPosition(next,{focus=false}={}) {
    if(desktop.matches&&next==='compact')next='list';
    if(next==='detail'&&!selected)select('iut',{open:false,notify:false});
    position=next;sheet.dataset.position=next;container.dataset.sheet=next;
    for(const b of sheet.querySelectorAll('[data-position]'))b.setAttribute('aria-pressed',String(b.dataset.position===next));
    q('.sheet-handle').setAttribute('aria-expanded',String(next!=='compact'));q('.sheet-close').hidden=next==='compact';
    q('.atlas-list-view').hidden=next==='detail';q('.atlas-detail').hidden=next!=='detail'||planner;q('.walking-planner').hidden=next!=='detail'||!planner;
    const cover=!desktop.matches&&next==='detail';
    q('.atlas-header').inert=cover;q('.atlas-controls').inert=!desktop.matches&&next!=='compact';q('.atlas-frame').inert=cover;
    for(const m of markers.values())if(m.getElement())m.getElement().tabIndex=!desktop.matches&&next!=='compact'?-1:0;
    sheet.style.removeProperty('--drag-offset');sheet.classList.remove('is-dragging');
    if(focus)(planner?q('#walkingTitle'):next==='detail'?q('#mapPlaceTitle'):q('.atlas-list button'))?.focus({preventScroll:true});
  }
  function closeDetail(){planner=false;setPosition('list');const target=items.get(selected?.id)||q('.atlas-list button');target?.focus({preventScroll:true});target?.scrollIntoView({block:'start',behavior:'instant'});}
  function fact(label,value){const wrap=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;wrap.append(dt,dd);return wrap;}
  function select(id,{open=true,notify=true}={}) {
    const place=MAP_PLACES.find(p=>p.id===id);
    if(!place){requestId++;router.cancel();stopTracking('');selected=null;planner=false;pickMode=false;route=null;if(routeLayer)map?.removeLayer(routeLayer);if(startLayer)map?.removeLayer(startLayer);q('#walkingResult').hidden=true;q('#calculateWalking').disabled=false;q('#cancelWalkingRequest').hidden=true;status('');
      for(const item of items.values())item.setAttribute('aria-pressed','false');for(const m of markers.values()){m.getElement()?.setAttribute('aria-pressed','false');m.getElement()?.classList.remove('is-selected');}
      q('#mapResults').textContent='Lieu introuvable. Choisissez un lieu dans la liste.';setPosition('list',{focus:true});return false;}
    if(selected && selected.id!==place.id){requestId++;router.cancel();q('#calculateWalking').disabled=false;q('#cancelWalkingRequest').hidden=true;status('');}
    selected=place;planner=false;
    if(route && route.destinationId!==place.id){stopTracking('');route=null;if(routeLayer)map?.removeLayer(routeLayer);if(startLayer)map?.removeLayer(startLayer);q('#walkingResult').hidden=true;}
    for(const [key,item]of items)item.setAttribute('aria-pressed',String(key===id));
    for(const [key,m]of markers){const node=m.getElement();node?.setAttribute('aria-pressed',String(key===id));node?.classList.toggle('is-selected',key===id);}
    q('#mapPlaceTitle').textContent=place.title;q('.map-place-description').textContent=place.description;
    q('.map-stop-status').textContent=place.kind==='fixed'?'Point fixe · GPS':`Étape ${place.number} · ${place.available?'Disponible':'À venir'}`;q('.map-stop-status').classList.toggle('coming',place.kind==='step'&&!place.available);
    q('.atlas-facts').replaceChildren(fact('Coordonnées',place.coordinates[1].toFixed(6)+', '+place.coordinates[0].toFixed(6)),fact('Sur place',place.practical||'Horaires et conditions d’accès non renseignés.'),fact('Parcours',place.kind==='step'?place.subtitle:place.stepId?CORTE_STOPS.find(p=>p.id===place.stepId)?.title||'Étape à confirmer':'Étape associée à documenter.'));
    const image=q('.atlas-photo-image'),missing=q('.atlas-photo-missing'),credit=q('.atlas-photo-credit');image.hidden=true;image.removeAttribute('src');missing.hidden=false;credit.replaceChildren();
    if(place.photo){const p=place.photo;image.onload=()=>{if(selected?.id===place.id){image.hidden=false;missing.hidden=true;}};image.onerror=()=>{image.hidden=true;missing.hidden=false;};image.alt=p.alt;image.style.objectPosition=p.position;image.srcset=photoVariants(p).srcset;image.sizes='(max-width:899px) 85vw, 320px';image.src=p.src;
      for(const [text,href]of[[p.author,p.source],[p.license,p.licenseURL]]){const a=document.createElement('a');a.textContent=text;a.href=href;a.target='_blank';a.rel='noopener noreferrer';credit.append(a);}
    }
    q('.atlas-directions').href=directionsURL(place);q('.atlas-start').hidden=place.kind!=='step';q('.atlas-start').textContent=place.available?'Découvrir cette étape':'À propos de cette étape';
    if(open){setPosition('detail',{focus:true});q('.sheet-content').scrollTop=0;}if(notify)onSelection(id);
  }
  for(const place of MAP_PLACES){
    const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.dataset.place=place.id;button.setAttribute('aria-pressed','false');
    const badge=document.createElement('span');badge.className='atlas-list-number';badge.textContent=place.number||'GPS';
    if(place.photo){const img=document.createElement('img');img.src=photoVariants(place.photo).thumbnail;img.alt='';img.width=48;img.height=48;img.loading='lazy';img.style.objectPosition=place.photo.position;badge.replaceChildren(img);}
    const copy=document.createElement('span');copy.className='atlas-list-copy';const title=document.createElement('strong'),sub=document.createElement('small');title.textContent=place.title;sub.textContent=place.kind==='fixed'?'Point fixe · lieu à documenter':place.available?'Étape 01 · Disponible':'Étape 02 · En préparation';copy.append(title,sub);button.append(badge,copy);button.insertAdjacentHTML('beforeend',icon('arrow'));button.addEventListener('click',()=>{origin=button;select(place.id);});li.append(button);q('.atlas-list').append(li);items.set(place.id,button);
    const option=new Option(place.title,place.id);q('#walkingStart').append(option);
  }
  q('#walkingStart').append(new Option('Coordonnées ou point sur le plan','custom'),new Option('Ma position autorisée','gps'));
  function applySearch(){const matches=new Set(filterMapPlaces(MAP_PLACES,q('#mapSearch').value).map(p=>p.id));for(const[id,item]of items){item.parentElement.hidden=!matches.has(id);const marker=markers.get(id);if(marker){if(matches.has(id)&&map&&!map.hasLayer(marker))marker.addTo(map);if(!matches.has(id)&&map?.hasLayer(marker))map.removeLayer(marker);}}
    q('#clearMapSearch').hidden=!q('#mapSearch').value;q('.atlas-empty').hidden=matches.size>0;q('#mapResults').textContent=matches.size+' lieu'+(matches.size>1?'x':'')+' dans le parcours';planner=false;setPosition('list');}
  q('#mapSearch').addEventListener('input',applySearch);q('.atlas-search').addEventListener('submit',e=>{e.preventDefault();[...items.values()].find(b=>!b.parentElement.hidden)?.focus();});
  q('#clearMapSearch').addEventListener('click',()=>{q('#mapSearch').value='';applySearch();q('#mapSearch').focus();});q('#resetMapFilters').addEventListener('click',()=>{q('#mapSearch').value='';applySearch();});
  for(const b of sheet.querySelectorAll('[data-position]'))b.addEventListener('click',()=>{if(b.dataset.position==='detail')planner=false;setPosition(b.dataset.position);});
  q('.sheet-close').addEventListener('click',()=>{setPosition('compact');q('.sheet-handle').focus();});
  q('.detail-close').addEventListener('click',closeDetail);q('.detail-back').addEventListener('click',closeDetail);
  q('.atlas-start').addEventListener('click',()=>selected?.available?onStep():onComing(selected.title));
  q('#routeStartButton').addEventListener('click',onStep);
  container.addEventListener('keydown',e=>{if(e.key==='Escape'&&pickMode){pickMode=false;q('#mapStatus').textContent='Choix du départ annulé.';planner=true;setPosition('detail');return;}if(e.key==='Escape'&&position!=='compact'){e.preventDefault();position==='detail'?closeDetail():setPosition('compact');}});
  const handle=q('.sheet-handle');handle.addEventListener('click',()=>{if(suppressClick){suppressClick=false;return;}setPosition(position==='compact'?'list':'compact');});
  handle.addEventListener('pointerdown',e=>{if(desktop.matches||e.button>0)return;suppressClick=false;drag={id:e.pointerId,y:e.clientY,delta:0,start:position};handle.setPointerCapture(e.pointerId);});
  handle.addEventListener('pointermove',e=>{if(drag?.id!==e.pointerId)return;drag.delta=e.clientY-drag.y;if(Math.abs(drag.delta)>8){sheet.classList.add('is-dragging');sheet.style.setProperty('--drag-offset',Math.max(-120,Math.min(140,drag.delta))+'px');}});
  for(const event of ['pointerup','pointercancel'])handle.addEventListener(event,e=>{if(drag?.id!==e.pointerId)return;const d=drag;drag=null;suppressClick=Math.abs(d.delta)>8;const levels=['compact','list','detail'];setPosition(e.type==='pointercancel'?d.start:levels[Math.max(0,Math.min(2,levels.indexOf(d.start)+(d.delta<-35?1:d.delta>35?-1:0)))]);});
  handle.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();const a=['compact','list','detail'];setPosition(e.key==='Home'?'compact':e.key==='End'?'detail':a[Math.max(0,Math.min(2,a.indexOf(position)+(e.key==='ArrowUp'?1:-1)))]);}});
  function fit(){if(!map)return;const bounds=route?L.latLngBounds(route.coordinates.map(latlng)):L.latLngBounds(MAP_PLACES.map(p=>latlng(p.coordinates)));map.fitBounds(bounds,{paddingTopLeft:desktop.matches?[420,100]:[65,260],paddingBottomRight:desktop.matches?[65,170]:[55,(parseFloat(getComputedStyle(sheet).bottom)||100)+240],maxZoom:17,animate:false});}
  function separateMarkers(){if(!map)return;const a=markers.get('iut'),b=markers.get('fixed-gps');if(!a||!b)return;const p=map.latLngToContainerPoint(a.getLatLng()),r=map.latLngToContainerPoint(b.getLatLng()),close=p.distanceTo(r)<90;const n=a.getElement();if(n){n.style.marginLeft=(close?-80:-24)+'px';n.style.marginTop=(close?2:-24)+'px';}
    if(leader)map.removeLayer(leader);leader=close?L.polyline([a.getLatLng(),map.containerPointToLatLng([p.x-56,p.y+26])],{color:'#273B31',weight:2,interactive:false}).addTo(map):null;
  }
  async function offlinePlan(){if(fallback||!map)return;try{const response=await fetch(new URL('../assets/maps/corte.json',import.meta.url));if(!response.ok)return;const data=await response.json();const group=L.layerGroup();for(const f of data.features){const t=f.tags,coords=f.coordinates.map(latlng);if(t.building)L.polygon(coords,{stroke:false,fillColor:'#cfc9bb',fillOpacity:.8,interactive:false}).addTo(group);else if(t.highway)L.polyline(coords,{color:'#fffdf8',weight:4,interactive:false}).addTo(group);else if(t.waterway)L.polyline(coords,{color:'#9dbfc7',weight:6,interactive:false}).addTo(group);}fallback=group.addTo(map);fallback.setZIndex?.(0);}catch{/* The place list is still available. */}}
  async function load(){if(map)return;if(loading)return loading;q('#mapStatus').textContent='Chargement de la carte…';q('#retryMap').hidden=true;
    loading=(async()=>{try{L=await loadLeaflet();map=L.map(q('.atlas-frame'),{zoomControl:false,attributionControl:true,preferCanvas:false,zoomAnimation:false,markerZoomAnimation:false,inertia:false}).setView([42.302,9.152],15);
      map.attributionControl.setPrefix(false);
      tileLayer=L.tileLayer(MAP_CONFIG.tilesURL,{maxZoom:19,attribution:'<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>',crossOrigin:false}).addTo(map);
      tileLayer.on('tileerror',()=>{tileErrors++;if(tileErrors===3){q('#mapStatus').textContent='Fond en ligne indisponible · plan local et liste accessibles.';q('#retryMap').hidden=false;offlinePlan();}});tileLayer.on('load',()=>{if(!tileErrors)q('#mapStatus').textContent='';});
      for(const p of MAP_PLACES){const node=document.createElement('div');node.className='atlas-marker'+(p.kind==='fixed'?' is-fixed':p.photo?' is-photo':'');if(p.photo){const im=document.createElement('img');im.src=photoVariants(p.photo).thumbnail;im.alt='';im.style.objectPosition=p.photo.position;node.append(im);}
        const badge=document.createElement('span');badge.className='atlas-marker-number';badge.textContent=p.number||'GPS';node.append(badge);
        if(p.photo||p.kind==='fixed'){const label=document.createElement('span');label.className='atlas-marker-label';label.textContent=p.kind==='fixed'?'Point fixe':p.title;node.append(label);}
        const m=L.marker(latlng(p.coordinates),{icon:L.divIcon({html:node,className:'leaflet-place-icon',iconSize:[48,48],iconAnchor:[24,24]}),keyboard:true,title:p.title,alt:p.title,autoPanOnFocus:false}).addTo(map);
        const el=m.getElement();el.id='map-stop-'+p.id;el.dataset.longitude=p.coordinates[0];el.dataset.latitude=p.coordinates[1];el.setAttribute('aria-label',p.kind==='fixed'?'Point GPS fixe : 42.297500, 9.154278':p.number+' · '+p.title);el.setAttribute('aria-pressed',String(selected?.id===p.id));el.addEventListener('keydown',e=>{if(e.key===' '){e.preventDefault();select(p.id);}});
        m.on('click',()=>{origin=el;select(p.id);});markers.set(p.id,m);
      }
      map.on('moveend zoomend',separateMarkers);map.on('click',e=>{if(pickMode){pickMode=false;q('#walkingStart').value='custom';q('#startLatitude').value=e.latlng.lat.toFixed(6);q('#startLongitude').value=e.latlng.lng.toFixed(6);q('#customStartFields').hidden=false;planner=true;setPosition('detail',{focus:true});q('#mapStatus').textContent='Départ choisi sur la carte.';}});
      loaded=true;fit();separateMarkers();q('#mapStatus').textContent='';setPosition(position);
    }catch(error){q('#mapStatus').textContent=error.message;q('#retryMap').hidden=false;setPosition('list');}finally{loading=null;}})();return loading;
  }
  q('#map-in').addEventListener('click',()=>map?.zoomIn());q('#map-out').addEventListener('click',()=>map?.zoomOut());q('#map-reset').addEventListener('click',fit);
  q('#retryMap').addEventListener('click',()=>{if(map){tileErrors=0;tileLayer?.redraw();q('#retryMap').hidden=true;q('#mapStatus').textContent='Rechargement du fond…';}else load();});
  function stopTracking(message='Suivi arrêté. Le trajet reste consultable.'){if(watchId!==null)navigator.geolocation?.clearWatch(watchId);watchId=null;q('#startGuidance').hidden=false;q('#stopGuidance').hidden=true;q('#guidanceStatus').textContent=message;container.dataset.tracking='false';}
  function updateLocation(position){const p=[position.coords.longitude,position.coords.latitude];if(!validCoordinate(p))return;lastLocation={coordinates:p,accuracy:position.coords.accuracy};if(map){if(!userLayer)userLayer=L.circleMarker(latlng(p),{radius:7,color:'#fff',weight:3,fillColor:'#205e83',fillOpacity:1}).addTo(map);else userLayer.setLatLng(latlng(p));if(accuracyLayer)map.removeLayer(accuracyLayer);accuracyLayer=L.circle(latlng(p),{radius:Math.min(position.coords.accuracy,1000),color:'#205e83',weight:1,fillOpacity:.08,interactive:false}).addTo(map);}
    if(watchId===null||!route)return;
    if(position.coords.accuracy>100){q('#guidanceStatus').textContent='Position imprécise. Le trajet reste visible, sans mise à jour de la progression.';return;}
    const n=nearestOnRoute(p,route.coordinates);if(!n)return;
    if(n.distance>Math.max(50,position.coords.accuracy*1.5)){q('#guidanceStatus').textContent='Vous semblez vous écarter du trajet. Vous pouvez demander un nouveau calcul.';q('#recalculateWalking').hidden=false;return;}
    maxProgress=Math.max(maxProgress,n.progress);const fraction=Math.min(1,maxProgress/n.total);q('#walkingProgress').value=fraction*100;q('#guidanceStatus').textContent='Environ '+metric(Math.max(0,route.distance*(1-fraction)))+' restant sur le tracé.';q('#recalculateWalking').hidden=true;
    if(distanceBetween(p,route.end)<25){stopTracking('Vous êtes à proximité de la destination. Vérifiez son accès sur place.');q('#walkingProgress').value=100;}
  }
  function locate(){if(!navigator.geolocation)return Promise.reject(Error('La géolocalisation est indisponible. Choisissez un départ manuellement.'));return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(p=>{updateLocation(p);resolve([p.coords.longitude,p.coords.latitude]);},e=>reject(Error(e.code===1?'Position refusée. Choisissez un lieu ou des coordonnées de départ.':'Position indisponible. Choisissez un départ manuellement.')),{enableHighAccuracy:true,timeout:12000,maximumAge:15000}));}
  q('#map-locate').addEventListener('click',async()=>{q('#mapStatus').textContent='Recherche de votre position…';try{const p=await locate();map?.setView(latlng(p),17,{animate:false});q('#mapStatus').textContent='Votre position est affichée.';}catch(e){q('#mapStatus').textContent=e.message;}});
  function openPlanner(){if(!selected)select('iut',{open:false});planner=true;q('#walkingDestination').textContent='Arrivée · '+selected.title;q('#walkingStart').value=MAP_PLACES.find(p=>p.id!==selected.id&&p.kind==='step')?.id||'custom';q('#customStartFields').hidden=true;setPosition('detail',{focus:true});q('.sheet-content').scrollTop=0;}
  q('#planWalking').addEventListener('click',openPlanner);
  q('#walkingBack').addEventListener('click',()=>{planner=false;setPosition('detail',{focus:true});});q('#closeWalking').addEventListener('click',closeDetail);
  q('#walkingStart').addEventListener('change',()=>q('#customStartFields').hidden=q('#walkingStart').value!=='custom');
  q('#pickStart').addEventListener('click',()=>{if(!map){status('Le plan est indisponible. Saisissez les coordonnées du départ.',true);q('#walkingStart').value='custom';q('#customStartFields').hidden=false;return;}pickMode=true;setPosition('compact');q('#mapStatus').textContent='Touchez le plan pour choisir votre départ, ou annulez avec Échap.';q('.atlas-frame').focus();});
  q('#useWalkingLocation').addEventListener('click',async()=>{status('Recherche de votre position…');try{await locate();q('#walkingStart').value='gps';q('#customStartFields').hidden=true;status('Position prête. Vous pouvez calculer le trajet.');}catch(e){status(e.message,true);}});
  async function calculate(event){event?.preventDefault();const id=++requestId;router.cancel();stopTracking('');q('#walkingResult').hidden=true;q('#calculateWalking').disabled=true;q('#cancelWalkingRequest').hidden=false;status('Calcul du trajet piéton…');if(routeLayer)map?.removeLayer(routeLayer);route=null;
    try{const mode=q('#walkingStart').value;let start;if(mode==='gps')start=lastLocation?.coordinates||await locate();else if(mode==='custom'){const a=q('#startLatitude').value,b=q('#startLongitude').value;if(!a.trim()||!b.trim())throw Error('Renseignez la latitude et la longitude du départ.');start=[Number(b),Number(a)];}else start=MAP_PLACES.find(p=>p.id===mode)?.coordinates;
      if(id!==requestId)return;
      const result=await router.calculate(start,selected.coordinates);if(id!==requestId)return;route={...result,destinationId:selected.id};maxProgress=0;
      if(map){routeLayer=L.polyline(result.coordinates.map(latlng),{color:'#B86D4E',weight:5,opacity:1}).addTo(map);if(startLayer)map.removeLayer(startLayer);startLayer=L.circleMarker(latlng(result.coordinates[0]),{radius:7,color:'#273B31',weight:3,fillColor:'#F4F0E8',fillOpacity:1}).bindTooltip('Départ').addTo(map);fit();}
      q('#walkingDistance').textContent=metric(result.distance);q('#walkingDuration').textContent=clock(result.duration)+' estimées';q('#walkingSource').textContent=result.source+(result.version?' · données du '+result.version:'')+' · profil piéton';
      q('#walkingAccess').textContent='Le tracé rejoint le réseau connu. Vérifiez l’accès final au lieu sur place.';q('#walkingInstructions').replaceChildren(...result.steps.map(s=>{const li=document.createElement('li');const label=document.createElement('span'),length=document.createElement('small');label.textContent=s.label;length.textContent=metric(s.distance);li.append(label,length);return li;}));if(!result.steps.length){const li=document.createElement('li');li.textContent='Le service ne fournit pas d’instructions détaillées pour ce trajet.';q('#walkingInstructions').append(li);}
      q('#walkingResult').hidden=false;status('Itinéraire prêt. Vous pouvez le consulter ou suivre votre position.');q('#walkingProgress').hidden=true;q('#walkingResult').scrollIntoView({block:'start',behavior:'instant'});
    }catch(e){if(id===requestId&&e.name!=='AbortError')status(e.message||'Le trajet ne peut pas être calculé. Réessayez.',true);}finally{if(id===requestId){q('#calculateWalking').disabled=false;q('#cancelWalkingRequest').hidden=true;}}}
  q('#walkingForm').addEventListener('submit',calculate);
  q('#cancelWalkingRequest').addEventListener('click',()=>{requestId++;router.cancel();q('#calculateWalking').disabled=false;q('#cancelWalkingRequest').hidden=true;status('Calcul annulé.');});
  q('#startGuidance').addEventListener('click',async()=>{if(!route)return;const following=route;q('#guidanceStatus').textContent='Autorisation de position…';try{await locate();if(route!==following||document.hidden)return;stopTracking('');container.dataset.tracking='true';q('#startGuidance').hidden=true;q('#stopGuidance').hidden=false;q('#walkingProgress').hidden=false;watchId=navigator.geolocation.watchPosition(updateLocation,e=>{if(e.code===1)stopTracking('Position refusée. Le trajet reste consultable.');else q('#guidanceStatus').textContent='Position momentanément indisponible. Le tracé reste visible ; le suivi reprendra à la prochaine mesure.';},{enableHighAccuracy:true,timeout:15000,maximumAge:8000});q('#guidanceStatus').textContent='Suivi actif · aucun recalcul automatique.';}catch(e){q('#guidanceStatus').textContent=e.message;}});
  q('#stopGuidance').addEventListener('click',()=>stopTracking());q('#recalculateWalking').addEventListener('click',()=>{q('#walkingStart').value='gps';calculate();});
  q('#clearWalking').addEventListener('click',()=>{requestId++;router.cancel();stopTracking('');route=null;if(routeLayer)map?.removeLayer(routeLayer);if(startLayer)map?.removeLayer(startLayer);q('#walkingResult').hidden=true;status('Itinéraire effacé.');});
  addEventListener('pagehide',()=>stopTracking('Suivi arrêté.'));document.addEventListener('visibilitychange',()=>{if(document.hidden&&watchId!==null)stopTracking('Suivi mis en pause. Relancez-le lorsque vous reprenez la marche.');});
  const observer=new ResizeObserver(()=>{if(active&&map){map.invalidateSize({pan:false});separateMarkers();}});observer.observe(container);
  desktop.addEventListener('change',()=>{setPosition(position);if(active){map?.invalidateSize({pan:false});fit();}});
  setPosition('compact');
  return {async activate(){active=true;await load();map?.invalidateSize({pan:false});separateMarkers();},deactivate(){active=false;},select(id){if(id===null){selected=null;planner=false;setPosition('list');return;}q('#mapSearch').value='';applySearch();select(id,{notify:false});},plan(id){if(id&&select(id,{open:false,notify:false})===false)return;openPlanner();},getState:()=>({selected:selected?.id||null,position,route,tracking:watchId!==null,loaded})};
}
