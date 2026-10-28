import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cropGeometry, zoomCrop } from '../memoria/photo-crop.js';
import { walkingRoute, projectCoordinate } from '../memoria/city-map.js';
import { CORTE_STOPS, CORTE_PHOTOS } from '../content/corte.js';

test('photo drag stays under the finger and never exposes an empty edge', () => {
  for(const image of [{width:900,height:600},{width:600,height:1600},{width:800,height:800}]) {
    for(const zoom of [1,1.4,4]) {
      const crop=cropGeometry(image,{zoom,offsetX:100000,offsetY:-100000});
      assert.ok(crop.x<=0&&crop.y<=0);assert.ok(crop.x+crop.width>=640-1e-8&&crop.y+crop.height>=640-1e-8);
    }
  }
  const moved=cropGeometry({width:900,height:600},{zoom:2,offsetX:60,offsetY:30});
  assert.equal(moved.offsetX,60);assert.equal(moved.offsetY,30);
});
test('pinch zoom preserves the image point under its anchor and clamps magnification', () => {
  const image={width:1200,height:900},state={zoom:1.5,offsetX:30,offsetY:-20},anchor={x:290,y:330};
  const before=cropGeometry(image,state),after=zoomCrop(image,state,2.5,anchor);
  assert.ok(Math.abs((anchor.x-before.x)/before.scale-(anchor.x-after.x)/after.scale)<1e-8);
  assert.ok(Math.abs((anchor.y-before.y)/before.scale-(anchor.y-after.y)/after.scale)<1e-8);
  assert.equal(zoomCrop(image,state,100).zoom,4);assert.equal(zoomCrop(image,state,.1).zoom,1);
});
test('walking links use connected public streets and exclude private or prohibited paths', () => {
  const a=[9.15,42.3],b=[9.151,42.3],c=[9.152,42.3];
  const features=[{tags:{highway:'footway'},coordinates:[a,b,c]},{tags:{highway:'motorway'},coordinates:[a,c]}];
  const route=walkingRoute(features,[a,c]);assert.deepEqual(route.coordinates,[a,b,c]);
  assert.equal(walkingRoute([{tags:{highway:'footway',access:'private'},coordinates:[a,c]}],[a,c]),null);
});
test('the bundled map covers the two Corte stops with an actual connected walking link', () => {
  const data=JSON.parse(fs.readFileSync(new URL('../assets/maps/corte.json',import.meta.url)));
  assert.ok(data.features.length>500);assert.match(data.source,/api.openstreetmap.org/);
  for(const stop of CORTE_STOPS){const [x,y]=projectCoordinate(stop.coordinates,data.bbox);assert.ok(x>0&&x<900&&y>0&&y<1000);}
  const route=walkingRoute(data.features,CORTE_STOPS.map(stop=>stop.coordinates));
  assert.ok(route&&route.coordinates.length>10);assert.ok(route.distance>600&&route.distance<3000);
});
test('real photographs have local JPEGs, visible authors and explicit reuse licenses', () => {
  for(const photo of CORTE_PHOTOS){assert.ok(photo.author);assert.match(photo.license,/CC0|CC BY-SA/);assert.match(photo.source,/commons.wikimedia.org/);const bytes=fs.readFileSync(new URL('../'+photo.src,import.meta.url));assert.equal(bytes[0],255);assert.equal(bytes[1],216);}
  const credits=JSON.parse(fs.readFileSync(new URL('../assets/photos/credits.json',import.meta.url)));assert.equal(credits.length,CORTE_PHOTOS.length);
});
