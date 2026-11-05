import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseWalkingRoute, createWalkingRouter, nearestOnRoute, distanceBetween } from '../memoria/routing.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/ign-corte-walk.json',import.meta.url)));
const start=[9.154338,42.297383],end=[9.149190,42.305007];
test('real IGN pedestrian response retains measured distance, estimated time, geometry and source version',()=>{
 const route=parseWalkingRoute(fixture,start,end);
 assert.equal(route.distance,1236.88);assert.equal(route.duration,1114.192);assert.equal(route.coordinates.length,125);
 assert.ok(route.steps.length>3);assert.ok(route.steps.every(s=>s.label&&!s.label.includes('undefined')));
 assert.ok(route.startGap<30&&route.endGap<15);assert.equal(route.source,'IGN · BD TOPO®');
});
test('an invalid or car-only response can never become a pedestrian route',()=>{
 for(const value of [{}, {...fixture,profile:'car'}, {...fixture,duration:-1}, {...fixture,distanceUnit:'kilometer'}, {...fixture,geometry:{type:'LineString',coordinates:[[0,0],end]}}]){
  assert.throws(()=>parseWalkingRoute(value,start,end));
 }
 assert.throws(()=>parseWalkingRoute(fixture,[0,0],end),/éloigné/);
});
test('the public request selects the pedestrian profile; a cached route avoids a second request',async()=>{
 const requests=[];const router=createWalkingRouter({fetcher:async url=>{requests.push(new URL(url));return {ok:true,json:async()=>fixture};},now:()=>10000});
 const a=await router.calculate(start,end),b=await router.calculate(start,end);
 assert.equal(a,b);assert.equal(requests.length,1);assert.equal(requests[0].searchParams.get('profile'),'pedestrian');assert.equal(requests[0].searchParams.get('resource'),'bdtopo-valhalla');
 assert.equal(requests[0].searchParams.get('start'),start.join(','));assert.equal(requests[0].searchParams.has('key'),false);
});
test('service failures remain actionable; aborting a late response cannot publish a stale route',async()=>{
 const router=createWalkingRouter({fetcher:async()=>({ok:false,status:429}),now:()=>10000});
 await assert.rejects(router.calculate(start,end),/sollicité/);
 let release;const delayed=createWalkingRouter({fetcher:()=>new Promise(r=>release=r),now:()=>10000});
 const promise=delayed.calculate(start,end);delayed.cancel();release({ok:true,json:async()=>fixture});
 await assert.rejects(promise,{name:'AbortError'});
});
test('progress uses the actual route geometry and reports an off-route distance',()=>{
 const c=fixture.geometry.coordinates,middle=c[Math.floor(c.length/2)],p=nearestOnRoute(middle,c);
 assert.ok(p.progress>0&&p.progress<p.total);assert.ok(p.distance<.01);
 assert.ok(nearestOnRoute([9.2,42.3],c).distance>500);
 assert.ok(distanceBetween(start,end)>800);assert.equal(nearestOnRoute(start,[]),null);
});
