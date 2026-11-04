import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CORTE_FIXED_POINT, CORTE_STOPS } from '../content/corte.js';
import { MAP_PLACES, filterMapPlaces, directionsURL } from '../memoria/immersive-map.js';
import { projectCoordinate } from '../memoria/city-map.js';

test('the supplied fixed destination retains exact coordinates without inventing its identity', () => {
  assert.deepEqual(CORTE_FIXED_POINT.coordinates, [9.154278,42.297500]);
  assert.equal(CORTE_FIXED_POINT.photo,null);
  assert.equal(CORTE_FIXED_POINT.stepId,null);
  assert.equal(CORTE_FIXED_POINT.practical,null);
  assert.notDeepEqual(CORTE_FIXED_POINT.coordinates,CORTE_STOPS[0].coordinates);
  const data=JSON.parse(fs.readFileSync(new URL('../assets/maps/corte.json',import.meta.url)));
  const [x,y]=projectCoordinate(CORTE_FIXED_POINT.coordinates,data.bbox);
  assert.ok(x>0&&x<900&&y>0&&y<1000);
});

test('destination URLs preserve latitude and longitude and request a walking route', () => {
  for(const place of MAP_PLACES) {
    const url=new URL(directionsURL(place));
    assert.equal(url.origin,'https://www.google.com');
    assert.equal(url.searchParams.get('destination'),place.coordinates[1]+','+place.coordinates[0]);
    assert.equal(url.searchParams.get('travelmode'),'walking');
    assert.equal(url.searchParams.has('origin'),false);
  }
});

test('place search handles accents, case, whitespace and coordinates and composes with filters', () => {
  assert.deepEqual(filterMapPlaces(MAP_PLACES,'  \u00c9TAPE  ').map(p=>p.id),['iut','palazzu']);
  assert.deepEqual(filterMapPlaces(MAP_PLACES,'GPS').map(p=>p.id),['fixed-gps']);
  assert.deepEqual(filterMapPlaces(MAP_PLACES,'42.2975').map(p=>p.id),['fixed-gps']);
  assert.equal(filterMapPlaces(MAP_PLACES,'','step').length,2);
  assert.equal(filterMapPlaces(MAP_PLACES,'','fixed').length,1);
  assert.equal(filterMapPlaces(MAP_PLACES,'IUT','fixed').length,0);
  assert.equal(filterMapPlaces(MAP_PLACES,'introuvable').length,0);
});
