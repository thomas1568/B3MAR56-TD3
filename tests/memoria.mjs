import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../build/three.core.js';
import { IUT_STEP, mediaReady } from '../content/iut.js';
import { serializeLayout, applyLayout, validateLayout, saveLayout, loadLayout } from '../memoria/layout.js';
import { layoutHotspots } from '../memoria/hotspots.js';
import { createAudioController } from '../memoria/audio.js';

const sceneSource = readFileSync(new URL('../memoria/scene.js', import.meta.url), 'utf8')
  .replace("'three'", JSON.stringify(new URL('../build/three.core.js', import.meta.url).href));
const { createMemoriaScene } = await import('data:text/javascript;base64,' + Buffer.from(sceneSource).toString('base64'));

test('five sourced POIs and missing assets never pretend to be reusable archives', () => {
  assert.equal(IUT_STEP.points.length, 5);
  assert.deepEqual(IUT_STEP.dates.map(date => date.year), ['1765','1981','1983']);
  for (const point of IUT_STEP.points) {
    assert.ok(point.text && point.transcript && point.sources.length && point.image.label);
    assert.equal(mediaReady(point.image), false); assert.equal(mediaReady(point.audio), false);
  }
  assert.equal(mediaReady({src:'public-photo.jpg',rights:{status:'a-verifier'}}),false);
  assert.equal(mediaReady({src:'approved.jpg',rights:{status:'autorise'}}),true);
  assert.equal(IUT_STEP.beforeAfter,null);
  assert.ok(IUT_STEP.historicalNote.includes('Palazzu Naziunale'));
});

test('procedural scene has a common world frame and picking resolves submeshes', () => {
  const memoria = createMemoriaScene(IUT_STEP);
  assert.equal(memoria.root.visible,false); assert.equal(memoria.objects.length,7);
  assert.equal(memoria.byPoint.size,5);
  memoria.root.visible=true; memoria.root.position.set(1,0,-3); memoria.root.rotation.y=.3;
  memoria.root.updateMatrixWorld(true);
  const book=memoria.byPoint.get('naissance'), world=book.getWorldPosition(new THREE.Vector3());
  const ray=new THREE.Raycaster(world.clone().add(new THREE.Vector3(0,1,0)), new THREE.Vector3(0,-1,0));
  ray.camera=new THREE.PerspectiveCamera(); ray.camera.position.copy(world).add(new THREE.Vector3(0,1,0)); ray.camera.lookAt(world); ray.camera.updateMatrixWorld(true);
  const hit=ray.intersectObject(book,true)[0]; assert.ok(hit);
  let root=hit.object; while(root && !memoria.objects.includes(root))root=root.parent;
  assert.equal(root,book); assert.equal(root.userData.poiId,'naissance');
  const before=book.position.clone(); memoria.root.position.x+=2; memoria.root.updateMatrixWorld(true);
  assert.ok(book.position.equals(before));
  assert.ok(Math.abs(book.getWorldPosition(new THREE.Vector3()).x-world.x-2)<1e-9);
  memoria.dispose();
});

test('saved layout restores local editing/deletion but never stores the world pose', () => {
  const first=createMemoriaScene(IUT_STEP), second=createMemoriaScene(IUT_STEP);
  first.root.position.set(7,1,-8); first.root.rotation.y=1;
  first.byPoint.get('naissance').position.x=.7; first.byPoint.get('paoli').rotation.y=.8;
  first.byPoint.get('reouverture').removeFromParent();
  let saved; const storage={setItem(key,value){saved=value;},getItem(){return saved;}};
  saveLayout(storage,first,IUT_STEP.id);
  const json=JSON.parse(saved);
  assert.deepEqual(Object.keys(json).sort(),['objects','stepId','version']);
  loadLayout(storage,second,IUT_STEP.id);
  assert.equal(second.byPoint.get('naissance').position.x,.7);
  assert.ok(Math.abs(second.byPoint.get('paoli').rotation.y-.8)<1e-9);
  assert.equal(second.byPoint.get('reouverture').parent,null);
  assert.deepEqual(second.root.position.toArray(),[0,0,0]); assert.equal(second.root.visible,false);
  second.reset(); assert.equal(second.byPoint.get('reouverture').parent,second.root);
  assert.deepEqual(second.byPoint.get('naissance').position.toArray(),IUT_STEP.points[1].position);
  first.dispose(); second.dispose();
});

test('invalid stored transformations are rejected before changing any object', () => {
  const memoria=createMemoriaScene(IUT_STEP), before=memoria.byPoint.get('paoli').position.clone();
  for(const change of [
    data=>data.objects[0].position[0]=Infinity,
    data=>data.objects[0].quaternion=[0,0,0,0],
    data=>data.objects[0].scale=[-1,1,1],
    data=>data.objects[1].id=data.objects[0].id,
    data=>data.stepId='another-stage',
    data=>data.objects[0].id='unknown'
  ]){
    const data=serializeLayout(memoria,IUT_STEP.id);change(data);
    assert.equal(validateLayout(data,IUT_STEP.id,memoria.objects.map(object=>object.userData.layoutId)),false);
    assert.throws(()=>applyLayout(memoria,data,IUT_STEP.id));
    assert.ok(memoria.byPoint.get('paoli').position.equals(before));
  }
  memoria.dispose();
});

test('scene cleanup disposes each owned resource once, including removed elements', () => {
  const memoria=createMemoriaScene(IUT_STEP), geometries=new Set(),materials=new Set();let disposals=0;
  for(const object of memoria.objects)object.traverse(child=>{
    if(child.geometry)geometries.add(child.geometry); if(child.material)materials.add(child.material);
  });
  for(const resource of [...geometries,...materials])resource.addEventListener('dispose',()=>disposals++);
  memoria.byPoint.get('paoli').removeFromParent();memoria.dispose();
  assert.equal(disposals,geometries.size+materials.size);
});

function audioFixture() {
  const files=[], speech={spoken:[],cancelled:0,paused:false,cancel(){this.cancelled++;},speak(item){this.spoken.push(item);},pause(){this.paused=true;},resume(){this.paused=false;}};
  class FakeAudio {
    constructor(src){this.src=src;this.volume=1;this.paused=true;files.push(this);}
    async play(){this.paused=false;}
    pause(){this.paused=true;}
  }
  class FakeUtterance {constructor(text){this.text=text;}}
  const audio=createAudioController({speech,Utterance:FakeUtterance,AudioClass:FakeAudio});
  const asset=src=>({src,title:src,rights:{status:'autorise'}});
  const track=(id)=>({title:id,text:'Texte '+id,audio:asset(id)});
  return {audio,files,speech,asset,track};
}

test('no autoplay, missing recordings remain explicit, synthesis is distinguished', async () => {
  const {audio,files,speech}=audioFixture();
  assert.equal(files.length,0);assert.equal(speech.spoken.length,0);
  await audio.play(IUT_STEP.narrations.welcome);
  assert.equal(audio.getState().playing,false); assert.match(audio.getState().message,/Audio à fournir/);
  assert.ok(audio.getState().text);
  await audio.play(IUT_STEP.narrations.welcome,{synthetic:true});
  assert.match(audio.getState().source,/Synthèse vocale/); assert.equal(speech.spoken.length,1);
  audio.pause();assert.equal(speech.paused,true);assert.equal(audio.getState().paused,true);
  await audio.resume();assert.equal(audio.getState().paused,false);
  audio.stopAll();assert.equal(audio.getState().playing,false);assert.equal(speech.cancelled,1);
});

test('one narrator, volume, ambience ducking, and stop-all cleanup', async () => {
  const {audio,files,asset,track}=audioFixture();
  await audio.setAmbience(asset('ambience'));const ambience=files[0];assert.equal(ambience.loop,true);
  assert.ok(Math.abs(ambience.volume-.24)<1e-10);
  await audio.play(track('one'));const one=files[1];assert.ok(Math.abs(ambience.volume-.064)<1e-10);
  await audio.play(track('two'));assert.equal(one.paused,true);assert.equal(files[2].paused,false);
  audio.pause();assert.ok(Math.abs(ambience.volume-.24)<1e-10);
  await audio.resume();assert.ok(Math.abs(ambience.volume-.064)<1e-10);
  audio.setVolume(.5);assert.equal(files[2].volume,.5);assert.equal(ambience.volume,.04);
  await audio.playMusic(asset('music'));const music=files[3];assert.equal(music.volume,.04);
  audio.stopAll();for(const file of files)assert.equal(file.paused,true);
});

test('late playback and resume completions cannot restart a stopped narration', async () => {
  const {audio,files,track}=audioFixture();
  await audio.play(track('one'));audio.pause();
  let resolve;
  files[0].play=()=>new Promise(r=>{resolve=r;});
  const resuming=audio.resume();audio.stopAll();resolve();await resuming;
  assert.equal(audio.getState().playing,false);assert.equal(audio.getState().paused,false);
  assert.equal(files[0].paused,true);
});

test('missing/unlicensed ambience and speech failures are exposed', async () => {
  const {audio,files}=audioFixture();
  await audio.setAmbience(IUT_STEP.ambiences[0]);assert.equal(files.length,0);
  assert.match(audio.getState().ambience,/à fournir/);
  const broken=createAudioController({speech:{speak(){throw Error('voice missing');}},Utterance:class {constructor(text){this.text=text;}}});
  await broken.play({title:'test',text:'test'},{synthetic:true});
  assert.equal(broken.getState().playing,false);assert.match(broken.getState().message,/voice missing/);
});

test('ARButton requires an explicit gesture, reports refusal and preserves external UI', async () => {
  const source=readFileSync(new URL('../jsm/webxr/ARButton.js',import.meta.url),'utf8').replace('export { ARButton };','');
  const overlay={style:{}}, calls=[];
  const node=()=>({style:{},textContent:'',disabled:false,events:[],addEventListener(){},dispatchEvent(event){this.events.push(event);}});
  let supportedResolve;
  const navigator={xr:{isSessionSupported:()=>new Promise(r=>supportedResolve=r),offerSession(){throw Error('automatic start forbidden');},
    requestSession:async(type,options)=>{calls.push(options);throw Error('permission refused');}}};
  const context=vm.createContext({navigator,document:{createElement:node},CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}},console});
  vm.runInContext(source+'\nthis.createButton=ARButton.createButton;',context);
  const renderer={xr:{setReferenceSpaceType(){},async setSession(){}}};
  const button=context.createButton(renderer,{requiredFeatures:['hit-test','dom-overlay'],domOverlay:{root:overlay}});
  supportedResolve(true);await Promise.resolve();assert.equal(calls.length,0);
  button.onclick();await new Promise(r=>setImmediate(r));
  assert.equal(button.events[0].detail.message,'permission refused');assert.equal(button.disabled,false);
  let ended;const session={addEventListener(type,handler){ended=handler;},removeEventListener(){},async end(){ended();}};
  navigator.xr.requestSession=async()=>session;
  button.onclick();await new Promise(r=>setImmediate(r));await session.end();
  assert.notEqual(overlay.style.display,'none');assert.equal(button.textContent,'START AR');
});


test('touch labels stay separate, within bounds, and retain their world projection', () => {
  const points=IUT_STEP.points.map(point=>({id:point.id,x:190,y:400,width:160,height:44,visible:true}));
  const placed=layoutHotspots(points,{width:390,top:220,bottom:700});
  assert.equal(placed.size,5);
  let previous=220;
  for(const position of placed.values()){
    assert.ok(position.y-44>=previous);assert.ok(position.y<=700);
    assert.equal(position.anchorX,190);assert.equal(position.anchorY,400);
    previous=position.y+8;
  }
  const compact=layoutHotspots(points,{width:390,top:220,bottom:325});
  assert.ok(compact.size<=2);
});
