import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {nativeARMode,nativeModelURLs,sceneViewerURL} from '../memoria/ar-platform.js';
import {unzipSync} from '../vendor/three-r180/libs/fflate.module.js';

test('native AR selection covers iPhone/iPad, Android browsers and unsupported/insecure contexts',()=>{
  for(const ua of ['Mozilla/5.0 (iPhone) Version/18 Safari/605','Mozilla/5.0 (iPhone) CriOS/140 Mobile/15 Safari/605'])
    assert.equal(nativeARMode({userAgent:ua}),'quick-look');
  assert.equal(nativeARMode({platform:'MacIntel',maxTouchPoints:5}),'quick-look');
  assert.equal(nativeARMode({quickLook:true}),'quick-look');
  for(const ua of ['Android Chrome/140','Android Firefox/140','Android SamsungBrowser/27'])
    assert.equal(nativeARMode({userAgent:ua}),'scene-viewer');
  assert.equal(nativeARMode({userAgent:'iPhone GSA/350'}),null);
  assert.equal(nativeARMode({userAgent:'Firefox Desktop'}),null);
  assert.equal(nativeARMode({userAgent:'Android',secure:false}),null);
});

test('native asset links retain the GitHub Pages prefix and return without leaking URL queries',()=>{
  const links=nativeModelURLs('https://example.org/B3MAR56-TD3/?private=discard#old');
  assert.equal(links.glb,'https://example.org/B3MAR56-TD3/assets/ar/iut-scene-v1.glb');
  assert.equal(links.usdz,'https://example.org/B3MAR56-TD3/assets/ar/iut-scene-v1.usdz');
  assert.equal(links.back,'https://example.org/B3MAR56-TD3/#etape/iut?vue=360');
  const intent=sceneViewerURL(links.glb,links.back),url=new URL(intent);
  assert.equal(url.searchParams.get('mode'),'ar_preferred');
  assert.equal(url.searchParams.get('file'),links.glb);
  assert.equal(url.searchParams.get('link'),links.back);
  assert.ok(intent.includes('S.browser_fallback_url='+encodeURIComponent(links.back)));
  assert.ok(intent.includes('package=com.google.android.googlequicksearchbox;'));
});

test('native GLB embeds the five scene points and textures without external dependencies',()=>{
  const bytes=fs.readFileSync(new URL('../assets/ar/iut-scene-v1.glb',import.meta.url));
  assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
  const data=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  assert.deepEqual([...new Set(data.nodes.map(n=>n.extras?.poiId).filter(Boolean))].sort(),['corte','iut','naissance','paoli','reouverture']);
  assert.ok(data.meshes.length>20);assert.ok(data.images.length>5);
  for(const image of data.images)assert.ok(image.bufferView!==undefined&&!image.uri);
});

test('native USDZ is uncompressed, aligned on 64-byte boundaries and declares metre units',()=>{
  const bytes=fs.readFileSync(new URL('../assets/ar/iut-scene-v1.usdz',import.meta.url));let offset=0,count=0;
  while(bytes.readUInt32LE(offset)===0x04034b50){
    const size=bytes.readUInt32LE(offset+18),start=offset+30+bytes.readUInt16LE(offset+26)+bytes.readUInt16LE(offset+28);
    assert.equal(bytes.readUInt16LE(offset+8),0);assert.equal(start%64,0);
    offset=start+size;count++;
  }
  assert.ok(count>10);
  const entries=unzipSync(bytes),model=Object.entries(entries).find(([name])=>name.endsWith('.usda'));
  assert.ok(model);assert.match(new TextDecoder().decode(model[1]),/metersPerUnit = 1/);
});
