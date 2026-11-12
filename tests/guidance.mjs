import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRouteProgress, routeGeometry, splitRoute, nextPhysicalStop, GUIDANCE_CONFIG } from '../memoria/guidance.js';
import { CORTE_STOPS } from '../content/corte.js';
const coord = (x,y=0) => [9.15 + x / (111195 * Math.cos(42.3 * Math.PI / 180)), 42.3 + y / 111195];
const route = { coordinates:[coord(0),coord(100),coord(200),coord(300)],distance:300,duration:270,end:coord(300) };
const position = (point,time,accuracy=5) => ({coords:{longitude:point[0],latitude:point[1],accuracy},timestamp:time});
function run(tracker,x,time,accuracy=5,y=0) {return tracker.update(position(coord(x,y),time,accuracy),time);}
test('next physical destination respects availability, completion and missing coordinates, never AR anchors',()=>{
 assert.equal(nextPhysicalStop(CORTE_STOPS).destination.id,'iut');
 const result=nextPhysicalStop(CORTE_STOPS,['iut']); assert.equal(result.destination,null);assert.match(result.reason,/préparation/);assert.deepEqual(result.alternatives.map(p=>p.id),['iut']);
 assert.equal(nextPhysicalStop([{id:'no-gps',title:'Lieu',available:true}]).destination,null);
});
test('line splits inside a segment with identical junctions and no fabricated extra length',()=>{
 const geometry=routeGeometry(route.coordinates), split=splitRoute(geometry,geometry.total*.25);
 assert.ok(Math.abs(split.point[0]-coord(75)[0])<1e-7);assert.deepEqual(split.traveled.at(-1),split.remaining[0]);
 assert.equal(split.traveled.length,2);assert.equal(split.remaining.length,4);
 assert.deepEqual(splitRoute(geometry,0).point,route.coordinates[0]);
 assert.deepEqual(splitRoute(geometry,geometry.total).point,route.coordinates.at(-1));
});
test('normal walking and a long stop keep finite remaining service distance and duration',()=>{
 const tracker=createRouteProgress(route);run(tracker,0,100000);
 let result;
 for(let x=5;x<=100;x+=5)result=run(tracker,x,100000+x*1000);
 assert.ok(result.distance>195&&result.distance<205);assert.ok(result.duration>175&&result.duration<185);
 const progress=result.progress;
 for(let i=1;i<=40;i++)result=run(tracker,100,200000+i*5000);
 assert.equal(result.progress,progress);assert.ok(Number.isFinite(result.duration));
});
test('old, duplicate, inaccurate and teleporting fixes cannot advance the split',()=>{
 const tracker=createRouteProgress(route);run(tracker,0,100000);const base=run(tracker,20,110000);
 assert.equal(run(tracker,120,115000,150).progress,base.progress);
 assert.equal(run(tracker,180,116000).state,'jump');
 assert.equal(tracker.update(position(coord(90),100000),150000).state,'stale');
 assert.equal(run(tracker,80,110000).state,'duplicate');
 assert.equal(tracker.getState().progress,base.progress);
});
test('parallel return street does not steal progress and confirmed backtracking is allowed',()=>{
 const hairpin={coordinates:[coord(0),coord(150),coord(150,10),coord(0,10)],distance:310,duration:300,end:coord(0,10)};
 const tracker=createRouteProgress(hairpin);run(tracker,0,100000);
 for(let x=10;x<=70;x+=10)run(tracker,x,100000+x*1000);
 const ambiguous=run(tracker,72,175000,8,7);
 assert.ok(ambiguous.progress<90,'must not jump to nearby return branch');
 const before=ambiguous.progress;
 let result=run(tracker,58,180000);
 result=run(tracker,53,185000);result=run(tracker,48,190000);
 assert.ok(result.progress<before-10,'three backwards fixes must reverse the gray split');
});
test('crossing keeps the current segment instead of jumping to the final crossing',()=>{
 const crossing={coordinates:[coord(0),coord(100),coord(100,100),coord(50,-50),coord(50,50)],distance:500,duration:500,end:coord(50,50)};
 const tracker=createRouteProgress(crossing);run(tracker,0,100000);
 for(let x=10;x<=50;x+=10)run(tracker,x,100000+x*1000);
 const result=run(tracker,51,155000,8,2);assert.ok(result.progress<80);
});
test('off-route requires successive fresh fixes and arrival requires confirmation but never marks a visit',()=>{
 const tracker=createRouteProgress(route);run(tracker,0,100000);
 run(tracker,10,110000,5,10);run(tracker,20,120000,5,25);
 assert.equal(run(tracker,20,130000,5,40).state,'uncertain');
 assert.equal(run(tracker,20,134000,5,43).state,'uncertain');
 assert.equal(run(tracker,20,138000,5,45).state,'off-route');
 const fresh=createRouteProgress(route);
 let result=run(fresh,0,200000);
 for(let x=10;x<=280;x+=10)result=run(fresh,x,200000+x*1000);
 assert.notEqual(result.state,'arrived');
 result=run(fresh,284,485000);assert.equal(result.state,'arrived');
 assert.equal('visited' in result,false);
});
test('recalculation starts a fresh geometry and recorded IGN geometry is traversable continuously',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('./fixtures/ign-corte-walk.json',import.meta.url)));
 const r={...data,coordinates:data.geometry.coordinates,end:data.geometry.coordinates.at(-1)};
 const tracker=createRouteProgress(r),g=tracker.geometry;
 let result;
 for(let m=0;m<g.total;m+=5){const point=splitRoute(g,m).point;const time=100000+m*1000;result=tracker.update(position(point,time),time);}
 assert.ok(result.fraction>.97);
 const recalculated=createRouteProgress({...route,coordinates:route.coordinates.slice(1),distance:200,duration:180});
 assert.equal(recalculated.getState().progress,0);
 assert.deepEqual(recalculated.getState().remaining[0],route.coordinates[1]);
});
