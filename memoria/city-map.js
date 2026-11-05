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
