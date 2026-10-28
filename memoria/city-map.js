import { CORTE_STOPS } from '../content/corte.js';
const NS = 'http://www.w3.org/2000/svg';
const width = 900, height = 1000;
const clamp = (value,low,high) => Math.max(low,Math.min(high,value));
const mercator = latitude => Math.log(Math.tan(Math.PI / 4 + latitude * Math.PI / 360)) * 180 / Math.PI;
export function projectCoordinate([longitude,latitude], bbox) {
  return [(longitude-bbox[0])/(bbox[2]-bbox[0])*width,(mercator(bbox[3])-mercator(latitude))/(mercator(bbox[3])-mercator(bbox[1]))*height];
}
const meters = (a,b) => Math.hypot((a[0]-b[0])*Math.cos((a[1]+b[1])*Math.PI/360),a[1]-b[1])*111320;
export function walkingRoute(features, stops) {
  const graph = new Map(), coordinates = new Map(), key = point => point.join(',');
  const allowed = new Set(['footway','path','pedestrian','steps','living_street','residential','service','unclassified','tertiary','secondary','primary']);
  for(const feature of features) {
    const tags = feature.tags;
    if(!allowed.has(tags.highway) || tags.foot==='no' || tags.foot==='private' || (['no','private'].includes(tags.access) && !['yes','designated','permissive'].includes(tags.foot)))continue;
    const points = feature.coordinates;
    for(let i=0;i<points.length;i++) { const id=key(points[i]); coordinates.set(id,points[i]); if(!graph.has(id))graph.set(id,[]); if(i) { const previous=key(points[i-1]),cost=meters(points[i],points[i-1]); graph.get(id).push([previous,cost]);graph.get(previous).push([id,cost]); } }
  }
  if(!coordinates.size)return null;
  const nearest = point => [...coordinates].reduce((a,b)=>meters(point,a[1])<meters(point,b[1])?a:b)[0];
  const start=nearest(stops[0]),end=nearest(stops[1]),distances=new Map([[start,0]]),previous=new Map(),heap=[];
  function push(entry) { heap.push(entry);let i=heap.length-1;while(i){const parent=(i-1)>>1;if(heap[parent][0]<=entry[0])break;heap[i]=heap[parent];i=parent;}heap[i]=entry; }
  function pop() { const result=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1][0]<heap[child][0])child++;if(heap[child][0]>=last[0])break;heap[i]=heap[child];i=child;}heap[i]=last;}return result; }
  push([0,start]);
  while(heap.length) { const [distance,id]=pop();if(distance!==distances.get(id))continue;if(id===end)break;for(const [neighbor,cost] of graph.get(id)){const next=distance+cost;if(next<(distances.get(neighbor)??Infinity)){distances.set(neighbor,next);previous.set(neighbor,id);push([next,neighbor]);}} }
  if(!distances.has(end))return null;
  const route=[];for(let id=end;id;id=previous.get(id))route.push(coordinates.get(id));
  return { coordinates:route.reverse(),distance:distances.get(end) };
}

export function createCityMap(container, { onStep, onComing }) {
  container.dataset.map = ''; container.className = 'city-map-section';
  container.innerHTML = `<div class="section-heading"><div><p class="eyebrow">CORTE · CORSE</p><h2 id="cityMapTitle">Les étapes dans la ville</h2></div><span class="status-pill">2 lieux repérés</span></div><div class="city-map-layout"><div class="city-map-frame" role="region" aria-labelledby="cityMapTitle" aria-describedby="cityMapHelp" tabindex="0"><svg class="city-map-svg" xmlns="${NS}" aria-hidden="true"><g class="map-land"></g><g class="map-buildings"></g><g class="map-water"></g><g class="map-roads"></g><g class="map-labels"></g><g class="map-route"></g></svg><div class="map-markers"></div><div class="map-location"><strong>Corti</strong><span>Corte · Haute-Corse</span></div><div class="map-controls"><button type="button" data-map-action="in" aria-label="Agrandir la carte">+</button><button type="button" data-map-action="out" aria-label="Réduire la carte">−</button><button type="button" data-map-action="reset" aria-label="Recentrer sur le parcours">↺</button></div><p class="map-status" role="status">Chargement de la carte de Corte…</p><a class="map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a></div><aside class="map-stop-card"><div class="map-stop-tabs" role="group" aria-label="Choisir une étape sur la carte"></div><span class="status-pill map-stop-status"></span><h3 class="map-stop-title"></h3><p class="map-stop-description"></p><button class="primary map-start" type="button"></button><a class="map-directions" target="_blank" rel="noopener noreferrer">Ouvrir ce lieu dans un plan ↗</a><p class="small-note map-route-note">La liaison entre les étapes est indicative. Le Palazzu reste une étape à venir.</p></aside></div><p id="cityMapHelp" class="small-note">Glissez la carte pour la déplacer, pincez ou utilisez + et − pour zoomer. Au clavier : flèches pour déplacer et Début pour recentrer.</p><button type="button" class="text-button map-retry" hidden>Recharger la carte</button>`;
  const query=selector=>container.querySelector(selector),svg=query('svg'),frame=query('.city-map-frame'),status=query('.map-status');
  let data=null,loading=null,selected=CORTE_STOPS[0],view={x:0,y:0,w:width,h:height},initial=null,pointers=new Map(),pinch=null;
  const markers=[];
  function select(stop) {
    selected=stop;query('.map-stop-title').textContent=stop.title;query('.map-stop-description').textContent=stop.description;
    query('.map-stop-status').textContent=stop.available?'Étape 01 · Disponible':'Étape 02 · À venir';query('.map-stop-status').classList.toggle('coming',!stop.available);
    query('.map-start').textContent=stop.available?'Commencer à l’IUT':'En savoir plus';
    query('.map-directions').href=`https://www.openstreetmap.org/?mlat=${stop.coordinates[1]}&mlon=${stop.coordinates[0]}#map=18/${stop.coordinates[1]}/${stop.coordinates[0]}`;
    for(const marker of markers){marker.button.setAttribute('aria-pressed',String(marker.stop===stop));marker.tab.setAttribute('aria-pressed',String(marker.stop===stop));}
  }
  for(const stop of CORTE_STOPS) {
    const button=document.createElement('button');button.type='button';button.id='map-stop-'+stop.id;button.className='map-marker'+(stop.available?'':' is-coming');button.dataset.stop=stop.id;button.textContent=stop.number;button.setAttribute('aria-label',stop.number+' · '+stop.title+(stop.available?' · disponible':' · à venir'));button.addEventListener('click',()=>select(stop));query('.map-markers').appendChild(button);
    const tab=document.createElement('button');tab.type='button';tab.textContent=stop.number+' · '+(stop.id==='iut'?'IUT':'Palazzu');tab.addEventListener('click',()=>select(stop));query('.map-stop-tabs').appendChild(tab);markers.push({stop,button,tab});
  }
  query('.map-start').addEventListener('click',()=>selected.available?onStep():onComing(selected.title));select(selected);
  function updateMarkers() {
    if(!data||!svg.getScreenCTM())return;
    const rect=frame.getBoundingClientRect(),matrix=svg.getScreenCTM();
    for(const marker of markers){const [x,y]=projectCoordinate(marker.stop.coordinates,data.bbox),point=new DOMPoint(x,y).matrixTransform(matrix);marker.button.style.left=(point.x-rect.left)+'px';marker.button.style.top=(point.y-rect.top)+'px';}
  }
  function renderView() { svg.setAttribute('viewBox',`${view.x} ${view.y} ${view.w} ${view.h}`);updateMarkers();query('[data-map-action="in"]').disabled=initial&&view.w<=initial.w/4;query('[data-map-action="out"]').disabled=initial&&view.w>=initial.w*1.5; }
  function reset() {
    if(!data||!frame.clientWidth)return;
    const points=CORTE_STOPS.map(stop=>projectCoordinate(stop.coordinates,data.bbox)),xs=points.map(point=>point[0]),ys=points.map(point=>point[1]);
    const ratio=frame.clientWidth/frame.clientHeight,w=Math.max(...xs)-Math.min(...xs)+230,h=Math.max(...ys)-Math.min(...ys)+230;
    const actualW=Math.max(w,h*ratio),actualH=actualW/ratio,cx=(Math.max(...xs)+Math.min(...xs))/2,cy=(Math.max(...ys)+Math.min(...ys))/2;
    view={x:cx-actualW/2,y:cy-actualH/2,w:actualW,h:actualH};initial={...view};renderView();
  }
  function zoom(factor) {if(!initial)return;const next=clamp(view.w/factor,initial.w/4,initial.w*1.5),ratio=next/view.w;view={x:view.x+(view.w-next)/2,y:view.y+view.h*(1-ratio)/2,w:next,h:view.h*ratio};renderView();}
  function pathFor(feature) {return feature.coordinates.map((point,i)=>{const [x,y]=projectCoordinate(point,data.bbox);return(i?'L':'M')+x.toFixed(1)+','+y.toFixed(1);}).join(' ');}
  function addPath(feature,group,className) {const path=document.createElementNS(NS,'path');path.setAttribute('d',pathFor(feature));path.setAttribute('class',className);path.setAttribute('vector-effect','non-scaling-stroke');group.appendChild(path);}
  async function load() {
    if(data){updateMarkers();return;}if(loading)return loading;
    status.hidden=false;status.textContent='Chargement de la carte de Corte…';query('.map-retry').hidden=true;
    loading=(async()=>{
      try {
        const response=await fetch('assets/maps/corte.json',{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('map');data=await response.json();
        const groups={land:query('.map-land'),buildings:query('.map-buildings'),water:query('.map-water'),roads:query('.map-roads')};
        for(const feature of data.features){const tags=feature.tags;if(tags.building)addPath(feature,groups.buildings,'map-building');else if(tags.waterway||tags.natural==='water')addPath(feature,groups.water,tags.natural==='water'?'map-water-area':'map-river');else if(tags.landuse||tags.leisure)addPath(feature,groups.land,'map-green');if(tags.highway)addPath(feature,groups.roads,'map-road '+(['footway','path','steps','pedestrian'].includes(tags.highway)?'map-footway':'map-street'));}
        const route=walkingRoute(data.features,CORTE_STOPS.map(stop=>stop.coordinates));
        if(route)addPath(route,query('.map-route'),'map-route-line');
        const labels=[['VILLE HAUTE',[9.1489,42.306]],['CAMPUS GRIMALDI',[9.1545,42.2992]],['Tavignano',[9.1497,42.3013]]];
        for(const [label,coordinates] of labels){const [x,y]=projectCoordinate(coordinates,data.bbox),text=document.createElementNS(NS,'text');text.setAttribute('x',x);text.setAttribute('y',y);text.textContent=label;query('.map-labels').appendChild(text);}
        status.hidden=true;reset();
      }catch{data=null;status.textContent='La carte n’a pas pu se charger. Les deux lieux restent accessibles ci-contre.';query('.map-retry').hidden=false;}
      finally{loading=null;}
    })();return loading;
  }
  query('.map-retry').addEventListener('click',load);
  for(const button of query('.map-controls').querySelectorAll('button')){button.id='map-'+button.dataset.mapAction;button.addEventListener('click',()=>button.dataset.mapAction==='reset'?reset():zoom(button.dataset.mapAction==='in'?1.35:1/1.35));}
  frame.addEventListener('pointerdown',event=>{if(event.target.closest('button,a')||!data)return;frame.setPointerCapture(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),view:{...view}};}});
  frame.addEventListener('pointermove',event=>{const previous=pointers.get(event.pointerId);if(!previous)return;event.preventDefault();pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size===2&&pinch){const [a,b]=[...pointers.values()],factor=Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinch.distance);view={...pinch.view};zoom(factor);}else{view.x-=(event.clientX-previous.x)*view.w/frame.clientWidth;view.y-=(event.clientY-previous.y)*view.h/frame.clientHeight;renderView();}});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])frame.addEventListener(type,event=>{if(type==='lostpointercapture'&&event.target!==frame)return;pointers.delete(event.pointerId);pinch=null;});
  frame.addEventListener('keydown',event=>{if(event.target.closest('button,a'))return;const movement={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(movement){event.preventDefault();view.x+=movement[0]*view.w*.1;view.y+=movement[1]*view.h*.1;renderView();}else if(['+','=','-','Home'].includes(event.key)){event.preventDefault();if(event.key==='Home')reset();else zoom(event.key==='-'?1/1.35:1.35);}});
  const observer=new ResizeObserver(()=>{if(data&&frame.clientWidth)reset();});observer.observe(frame);
  return { load };
}
