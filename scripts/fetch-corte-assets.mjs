// Reproducible, one-off download of licensed photographs and an OSM city extract.
// Run from the repository root. Credits and upstream links travel with each asset.
import fs from 'node:fs/promises';

const headers = { 'User-Agent': 'MemoriaCorti/1.0 (https://github.com/thomas1568/B3MAR56-TD3; cultural walking application)' };
async function get(url, json = true) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(60000) });
    if (response.ok) return json ? response.json() : Buffer.from(await response.arrayBuffer());
    if (response.status < 500 || attempt === 2) throw new Error(`${response.status} ${url}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
const strip = value => String(value || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim();
await fs.mkdir('assets/photos', { recursive: true });
await fs.mkdir('assets/maps', { recursive: true });
const definitions = [
  ['corte-citadelle', 'File:Citadelle de Corte, Corte, Corsica, France.jpg'],
  ['corte-palazzu', 'File:Corte Palais National.jpg'],
  ['corte-paoli', 'File:Pascal Paoli Statue Corte, Corsica, France.jpg'],
  ['corte-restonica', 'File:Gorges Restonica - Corte (FR2B) - 2021-09-08 - 45.jpg']
];
const credits = [];
for (const [id, title] of definitions) {
  const query = new URLSearchParams({ action: 'query', titles: title, prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '1280', format: 'json', formatversion: '2' });
  const result = await get('https://commons.wikimedia.org/w/api.php?' + query);
  const page = Object.values(result.query.pages)[0], info = page.imageinfo?.[0];
  if (!info) throw new Error('Image metadata missing: ' + title);
  const metadata = info.extmetadata, license = strip(metadata.LicenseShortName?.value);
  if (!/^(CC0|CC BY|Public domain)/.test(license)) throw new Error('Review this license before download: ' + license);
  const url = info.thumburl || info.url, bytes = await get(url, false);
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Expected a JPEG photograph: ' + id);
  await fs.writeFile('assets/photos/' + id + '.jpg', bytes);
  const credit = { id, file: id + '.jpg', title: strip(metadata.ObjectName?.value) || title.slice(5), author: strip(metadata.Artist?.value), license, licenseURL: metadata.LicenseUrl?.value || 'https://creativecommons.org/publicdomain/zero/1.0/', source: info.descriptionurl, original: info.url, downloadedFrom: url, date: strip(metadata.DateTimeOriginal?.value), changes: 'Version 1280 px fournie par Wikimedia Commons ; cadrage d’affichage CSS uniquement.', checked: '2026-10-28' };
  credits.push(credit); console.log(id + ': ' + license + ', ' + bytes.length + ' bytes');
}
await fs.writeFile('assets/photos/credits.json', JSON.stringify(credits, null, 2) + '\n');

const bbox = [9.143, 42.296, 9.162, 42.312];
const source = 'https://api.openstreetmap.org/api/0.6/map.json?bbox=' + bbox.join(',');
const extract = await get(source), nodes = new Map(extract.elements.filter(item => item.type === 'node').map(item => [item.id, item]));
const round = value => Math.round(value * 1e6) / 1e6;
const ways = extract.elements.filter(item => item.type === 'way' && (item.tags?.highway || item.tags?.waterway || item.tags?.building || item.tags?.landuse || item.tags?.leisure || item.tags?.natural === 'water'));
const features = ways.map(way => ({ id: way.id, tags: way.tags, coordinates: way.nodes.map(id => nodes.get(id)).filter(Boolean).map(node => [round(node.lon), round(node.lat)]) }));
await fs.writeFile('assets/maps/corte.json', JSON.stringify({ bbox, source, attribution: '© OpenStreetMap contributors', license: 'https://www.openstreetmap.org/copyright', checked: '2026-10-28', features }) + '\n');
const relevant = extract.elements.filter(item => /IUT|Institut Universitaire|Palais National|Palazzu|Grimaldi/i.test(item.tags?.name || ''));
console.log('OSM features: ' + features.length);
for (const item of relevant) {
  const coordinates = item.type === 'node' ? [item.lon, item.lat] : item.nodes?.map(id => nodes.get(id)).filter(Boolean).reduce((value, node, _, all) => [value[0] + node.lon / all.length, value[1] + node.lat / all.length], [0, 0]);
  console.log(JSON.stringify({ id: item.id, type: item.type, name: item.tags.name, coordinates }));
}
