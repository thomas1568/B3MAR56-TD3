import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CORTE_STOPS, IUT_PHOTO } from '../content/corte.js';
import { MAP_PLACES, filterMapPlaces, directionsURL } from '../memoria/immersive-map.js';
import { projectCoordinate } from '../memoria/city-map.js';

test('IUT occupies the confirmed fixed coordinate once and has its supplied photo',()=>{
  assert.deepEqual(MAP_PLACES.map(p=>p.id),['iut','palazzu']);
  const iut=MAP_PLACES.find(p=>p.id==='iut');
  assert.equal(iut.title,'IUT de Corse');assert.deepEqual(iut.coordinates,[9.154278,42.297500]);
  assert.deepEqual(iut.photo,IUT_PHOTO);assert.equal(CORTE_STOPS.filter(p=>p.id==='iut').length,1);
  const data=JSON.parse(fs.readFileSync(new URL('../assets/maps/corte.json',import.meta.url)));
  const [x,y]=projectCoordinate(iut.coordinates,data.bbox);assert.ok(x>0&&x<900&&y>0&&y<1000);
});

test('destination URLs preserve latitude and longitude and request a walking route',()=>{
  for(const place of MAP_PLACES){
    const url=new URL(directionsURL(place));assert.equal(url.origin,'https://www.google.com');
    assert.equal(url.searchParams.get('destination'),place.coordinates[1]+','+place.coordinates[0]);
    assert.equal(url.searchParams.get('travelmode'),'walking');assert.equal(url.searchParams.has('origin'),false);
  }
});

test('place search handles accents, whitespace, coordinates and the merged IUT marker',()=>{
  assert.deepEqual(filterMapPlaces(MAP_PLACES,'  \u00c9TAPE  ').map(p=>p.id),['iut','palazzu']);
  assert.deepEqual(filterMapPlaces(MAP_PLACES,'42.2975').map(p=>p.id),['iut']);
  assert.equal(filterMapPlaces(MAP_PLACES,'GPS').length,0);
  assert.equal(filterMapPlaces(MAP_PLACES,'','step').length,2);
  assert.equal(filterMapPlaces(MAP_PLACES,'IUT').length,1);
  assert.equal(filterMapPlaces(MAP_PLACES,'introuvable').length,0);
});
