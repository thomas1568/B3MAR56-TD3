import { MAP_CONFIG } from './config.js?v=30';
export const validCoordinate = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
export function distanceBetween(a,b) {
  if (!validCoordinate(a) || !validCoordinate(b)) return Infinity;
  const r=Math.PI/180, dy=(b[1]-a[1])*r, dx=(b[0]-a[0])*r;
  const h=Math.sin(dy/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(dx/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
export function nearestOnRoute(point, coordinates) {
  if (!validCoordinate(point) || coordinates.length<2) return null;
  let traveled=0, best=null;
  const k=Math.cos(point[1]*Math.PI/180);
  for(let i=1;i<coordinates.length;i++) {
    const a=coordinates[i-1], b=coordinates[i], dx=(b[0]-a[0])*k,dy=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((point[0]-a[0])*k*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
    const snapped=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t], distance=distanceBetween(point,snapped), length=distanceBetween(a,b);
    if(!best || distance<best.distance)best={distance,point:snapped,index:i,progress:traveled+length*t};
    traveled+=length;
  }
  return {...best,total:traveled};
}
export function instructionLabel(step) {
  const labels={depart:'Commencez le trajet',arrive:'Rejoignez la destination',continue:'Continuez',turn:'Tournez',roundabout:'Prenez le rond-point',fork:'À la bifurcation',merge:'Rejoignez la voie',end_of_road:'Au bout de la voie'};
  const modifiers={left:'à gauche',right:'à droite','slight left':'légèrement à gauche','slight right':'légèrement à droite','sharp left':'franchement à gauche','sharp right':'franchement à droite',straight:'tout droit',uturn:'faites demi-tour'};
  const instruction=step.instruction || {}, type=instruction.type?.replaceAll(' ','_');
  const name=step.attributes?.name;
  const road=typeof name==='string'?name:name?.nom_1_gauche||name?.nom_1_droite||name?.cpx_numero||'';
  return [labels[type]||'Continuez',modifiers[instruction.modifier]||'',road?'sur '+road:''].filter(Boolean).join(' ');
}
export function parseWalkingRoute(data,start,end) {
  if(data?.error)throw Error('Le service ne trouve pas de trajet piéton entre ces deux points.');
  const c=data?.geometry?.coordinates;
  if(data?.profile!=='pedestrian'||data?.geometry?.type!=='LineString'||!Array.isArray(c)||c.length<2||!c.every(validCoordinate)||!Number.isFinite(data.distance)||data.distance<=0||!Number.isFinite(data.duration)||data.duration<=0||data.distanceUnit!=='meter'||data.timeUnit!=='second')throw Error('La réponse du service ne contient pas un itinéraire piéton exploitable.');
  const startGap=distanceBetween(start,c[0]),endGap=distanceBetween(end,c.at(-1));
  if(startGap>200||endGap>200)throw Error('Le lieu est trop éloigné du réseau piéton connu. Choisissez un autre départ ou vérifiez les accès.');
  const steps=(data.portions||[]).flatMap(p=>p.steps||[]).filter(s=>Number.isFinite(s.distance)&&s.distance>=0).map(s=>({label:instructionLabel(s),distance:s.distance,coordinate:s.geometry?.coordinates?.[0]}));
  return {coordinates:c,distance:data.distance,duration:data.duration,steps,version:data.resourceVersion||null,startGap,endGap,source:'IGN · BD TOPO®',start:[...start],end:[...end]};
}
export function createWalkingRouter({fetcher=globalThis.fetch,config=MAP_CONFIG,now=Date.now}={}) {
  let controller=null,lastRequest=0,sequence=0;
  const cache=new Map();
  return {
    cancel(){sequence++;controller?.abort();controller=null;},
    async calculate(start,end) {
      if(!validCoordinate(start)||!validCoordinate(end))throw Error('Choisissez un départ et une destination valides.');
      if(distanceBetween(start,end)<10)throw Error('Le départ et la destination sont presque identiques.');
      const key=start.map(n=>n.toFixed(5)).join(',')+'>'+end.map(n=>n.toFixed(5)).join(',');
      const previous=cache.get(key);if(previous&&now()-previous.time<300000)return previous.route;
      controller?.abort();controller=new AbortController();const own=controller,request=++sequence;
      const delay=Math.max(0,1000-(now()-lastRequest));if(delay)await new Promise(r=>setTimeout(r,delay));
      if(request!==sequence)throw new DOMException('Calcul annulé','AbortError');
      lastRequest=now();
      const url=new URL(config.routingURL);
      for(const [k,v] of Object.entries({resource:config.routingResource,start:start.join(','),end:end.join(','),profile:'pedestrian',optimization:'shortest',geometryFormat:'geojson',getSteps:'true',distanceUnit:'meter',timeUnit:'second',waysAttributes:'name'}))url.searchParams.set(k,v);
      const timer=setTimeout(()=>own.abort(),20000);
      try {
        const response=await fetcher(url.href,{signal:own.signal,headers:{Accept:'application/json'},credentials:'omit',referrerPolicy:'strict-origin-when-cross-origin'});
        if(!response.ok)throw Error(response.status===429?'Le service est très sollicité. Réessayez dans quelques instants.':'Le calcul piéton est indisponible. Réessayez ou changez de départ.');
        const route=parseWalkingRoute(await response.json(),start,end);
        if(request!==sequence)throw new DOMException('Calcul annulé','AbortError');
        cache.set(key,{time:now(),route});return route;
      }catch(error){if(error.name==='AbortError'&&request===sequence)throw Error('Le calcul a pris trop de temps. Réessayez.');throw error;}
      finally{clearTimeout(timer);}
    }
  };
}
