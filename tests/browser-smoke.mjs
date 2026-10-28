// Actual browser/WebGL/touch smoke test. XR poses are fixtures, never phone tracking.
// Run: node tests/browser-smoke.mjs (set CHROME_PATH if Chrome is elsewhere).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const root=process.cwd();
const bridge=String.raw`
const checkViewer=camera.clone();
checkViewer.position.set(0,1.55,2.8);checkViewer.lookAt(0,.65,-1.8);checkViewer.updateMatrixWorld(true);
checkViewer.viewport=new THREE.Vector4(0,0,390,844);
const checkArray=new THREE.ArrayCamera([checkViewer]);
function syncView(){checkArray.matrixWorld.copy(checkViewer.matrixWorld);checkArray.matrixWorldInverse.copy(checkViewer.matrixWorldInverse);checkArray.projectionMatrix.copy(checkViewer.projectionMatrix);}
syncView();
let checkMatrix=new THREE.Matrix4().makeTranslation(0,0,-1.8),checkTime=0,checkCancellations=0;
function checkFrame(){syncView();animate(checkTime+=16,{
getViewerPose:()=>({views:[{transform:{matrix:checkViewer.matrixWorld.elements},projectionMatrix:checkViewer.projectionMatrix.elements}]}),
getHitTestResults:()=>[{getPose:()=>({transform:{matrix:checkMatrix.elements}})}]});}
function checkPoint(id){
 scene.updateMatrixWorld(true);
 const rays=new THREE.Raycaster();rays.camera=checkViewer;
 const target=typeof id==='number'?placed_objects[id]:memoriaScene?.objects.find(object=>object.userData.layoutId===id);
 for(let y=225;y<635;y+=2)for(let x=15;x<375;x+=2){
  if(document.elementFromPoint(x,y)?.closest('button,a,[data-ui],details'))continue;
  // Mobile browsers expand touch targets around buttons. Pick mesh pixels away
  // from that area to test scene input rather than the browser's UI adjustment.
  if([...document.querySelectorAll('button')].some(button=>{
   if(!button.getClientRects().length)return false;
   const r=button.getBoundingClientRect();return x>r.left-18&&x<r.right+18&&y>r.top-18&&y<r.bottom+18;
  }))continue;
  rays.setFromCamera(new THREE.Vector2(x/390*2-1,1-y/844*2),checkViewer);
  let found=null;
  for(const hit of rays.intersectObjects(placed_objects,true)){if(!hit.object.isMesh)continue;let r=hit.object;while(r&&!placed_objects.includes(r))r=r.parent;if(r){found=r;break;}}
  if((id==='empty'&&!found)||(id!=='empty'&&found===target))return {x,y};
 }
 throw Error('No unobstructed screen point for '+id);
}
function startFixture(){
 renderer.setAnimationLoop(null);
 const session=new EventTarget();session.domOverlayState={type:'screen'};session.inputSources=[];session.visibilityState='visible';
 session.end=async()=>{renderer.xr.isPresenting=false;renderer.xr.dispatchEvent({type:'sessionend'});};
 renderer.xr.getSession=()=>session;renderer.xr.getReferenceSpace=()=>({});renderer.xr.getCamera=()=>checkArray;renderer.xr.updateCamera=()=>{};renderer.xr.isPresenting=true;
 renderer.xr.dispatchEvent({type:'sessionstart'});
 hitTestSourceRequested=true;hitTestSource={cancel(){checkCancellations++;}};checkFrame();
}
nativeARButton.onclick=startFixture;
experience.setAvailability(true,'AR de test : poses simulées');
window.__memoriaCheck={
 start:startFixture,enable:()=>{nativeARButton.onclick=startFixture;experience.setAvailability(true,'AR de test : poses simulées');},availability:value=>experience.setAvailability(value,value?'AR de test : poses simulées':'AR indisponible : consultation 360° accessible.'),frame:checkFrame,point:checkPoint,
 scan:x=>{checkMatrix.makeTranslation(x,0,-1.8);checkFrame();},
 pose:id=>{const o=typeof id==='number'?placed_objects[id]:memoriaScene.byPoint.get(id);return {p:o.position.toArray(),q:o.quaternion.toArray(),s:o.scale.toArray(),visible:o.visible,parent:o.parent?.uuid};},
 state:()=>({count:placed_objects.length,mode:experienceMode,interaction:interactionMode,selected:selectedObject?.userData.layoutId||selectedObject?.uuid||null,circle:reticle.visible,error:lastError,cancelled:checkCancellations,gesture:!!drag,loaded:!!current_object&&!modelLoading,placed:memoriaPlaced,audio:experience.audio.getState(),clearAlpha:renderer.getClearAlpha(),sceneBackground:scene.background,...experience.getState()}),
 movePhone:()=>{checkViewer.position.x+=.4;checkViewer.lookAt(0,.65,-1.8);checkViewer.updateMatrixWorld(true);checkFrame();},
 lost:()=>{updatePlacement({getHitTestResults:()=>[]},activeSession,{},100);updateARStatus();}
};
// Capture logs make native touch delivery observable; no app handler is replaced.
window.__touchTrace=[];
for(const type of ['pointerdown','pointermove','pointerup','touchstart','touchend','click'])
 document.addEventListener(type,event=>window.__touchTrace.push({type,target:event.target.id,x:event.clientX,y:event.clientY}),{capture:true,passive:true});
`;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 try{let data=fs.readFileSync(file);if(url.pathname==='/main.js')data=data.toString()+bridge;
 res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.glb':'model/gltf-binary','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(data);}
 catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'memoria-browser-'));
const executable=process.env.CHROME_PATH||(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application/chrome.exe':'google-chrome');
const chrome=spawn(executable,['--headless=new','--no-first-run','--no-default-browser-check','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
let socket, inspect, capture;
try{
 for(let i=0;!fs.existsSync(path.join(profile,'DevToolsActivePort'))&&i<100;i++)await new Promise(r=>setTimeout(r,100));
 const port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];
 const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise(r=>socket.addEventListener('open',r,{once:true}));
 let seq=0;const pending=new Map(),errors=[];
 socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 inspect=ev;capture=send;
 await send('Runtime.enable');await send('Page.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/'});
 async function until(expression){for(let i=0;i<150;i++){if(await ev(expression))return;await new Promise(r=>setTimeout(r,50));}throw Error('Timed out: '+expression);}
 await until('!!window.__memoriaCheck');await until('document.getElementById("arAvailability").textContent.indexOf("Vérification")<0');assert.equal(errors.length,0,JSON.stringify(errors));
 await until('document.getElementById("appIntro").hidden');
 const decodedNarrations=await ev(`(async()=>{const manifest=await(await fetch('assets/audio/narrations.json')).json(),context=new OfflineAudioContext(1,1,24000),result=[];for(const [id,track] of Object.entries(manifest.tracks)){const data=await(await fetch(track.src)).arrayBuffer(),audio=await context.decodeAudioData(data);result.push({id,duration:audio.duration,expected:track.duration,channels:audio.numberOfChannels});}return result;})()`);
 assert.equal(decodedNarrations.length,7);
 for(const track of decodedNarrations){assert.equal(track.channels,1);assert.ok(Math.abs(track.duration-track.expected)<.2,JSON.stringify(track));}
 await until('!document.getElementById("onboarding").hidden && !document.getElementById("onboardingWelcome").hidden && !document.getElementById("onboardingStatus").textContent');
 await ev('document.getElementById("guestButton").click();document.getElementById("pseudoInput").value="Visiteur";document.getElementById("profileForm").requestSubmit()');
 await until('document.getElementById("onboarding").hidden');
 const screenshot=await send('Page.captureScreenshot',{format:'png'});
 const screenshotPath=path.join(profile,'home-mobile.png');fs.writeFileSync(screenshotPath,Buffer.from(screenshot.data,'base64'));console.log('Screenshot: '+screenshotPath);
 async function touch(point,type='touchStart'){await send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x:point.x,y:point.y}]});}
 async function tap(point){await touch(point);await touch(point,'touchEnd');await ev('new Promise(resolve=>setTimeout(resolve,100))');}
 async function button(id,{scroll=false}={}){
  if(scroll)await ev('document.getElementById('+JSON.stringify(id)+').scrollIntoView({block:"center",behavior:"instant"})');
  await ev('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  const point=await ev('(()=>{const e=document.getElementById('+JSON.stringify(id)+');if(e.disabled||e.hidden)throw Error("Button unavailable: "+e.id);const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
  assert.ok(point.x>0&&point.x<390&&point.y>0&&point.y<844,'offscreen button '+id+JSON.stringify(point));await tap(point);
 }
 async function dragObject(id,dx){
  const p=await ev('__memoriaCheck.point('+JSON.stringify(id)+')');
  await touch(p);for(let n=1;n<=4;n++){await touch({x:p.x+dx*n/4,y:p.y},'touchMove');await ev('new Promise(r=>setTimeout(r,20))');}
  await touch(p,'touchEnd');await ev('new Promise(r=>setTimeout(r,100))');await ev('__memoriaCheck.frame()');
 }
 // Global navigation opens the first stage; AR controls are contextual.
 assert.equal(await ev('document.getElementById("experienceDock").hidden'),true);
 assert.equal(await ev('document.getElementById("tab-home").getAttribute("aria-current")'),'page');
 await button('tab-route');await button('routeStartButton',{scroll:true});
 await ev('new Promise(r=>setTimeout(r,600))');
 assert.equal(await ev('document.getElementById("stepSection").hidden'),false);
 assert.equal(await ev('document.querySelectorAll("#pointList button").length'),5);
 // All offline cards and resource placeholders.
 for(const id of ['iut','naissance','paoli','reouverture','corte']){
  await ev('document.querySelector("#pointList button:nth-child('+(['iut','naissance','paoli','reouverture','corte'].indexOf(id)+1)+')").click()');
  assert.equal(await ev('__memoriaCheck.state().activePoint'),id);
  assert.equal(await ev('document.getElementById("missingImage").hidden'),false);
  assert.equal(await ev('document.getElementById("enlargeImageButton").disabled'),true);
  assert.ok(await ev('document.getElementById("pointTranscript").textContent.length>40'));
  await button('listenPointButton',{scroll:true});await until('__memoriaCheck.state().audio.playing');
  assert.match(await ev('document.getElementById("playerSource").textContent'),/Voix IA naturelle/);
  await button('stopAudioButton');
  await button('closePointButton');
 }
 // Default narration is a real local MP3 with an explicit AI source.
 await ev('document.getElementById("voiceChoice").value="recording"');
 await button('welcomeAudioButton',{scroll:true});
 await until('__memoriaCheck.state().audio.playing');
 assert.match(await ev('document.getElementById("playerSource").textContent'),/Voix IA naturelle/);
 assert.ok(await ev('__memoriaCheck.state().audio.duration>20'));
 await button('pauseAudioButton');assert.equal(await ev('__memoriaCheck.state().audio.paused'),true);
 await button('resumeAudioButton');await until('!__memoriaCheck.state().audio.paused');
 await button('stopAudioButton');
 await ev('document.getElementById("audioDock").hidden=true');
 await button('openPanoramaButton',{scroll:true});
 assert.match(await ev('document.getElementById("panoramaMissing").textContent'),/Corte, entre pierre et savoir/);
 await until('document.getElementById("panoramaScene").dataset.state === "ready"');
 assert.match(await ev('document.getElementById("panoramaCredit").textContent'),/Illustration.*IA/);
 await ev('document.querySelector(".panorama-canvas").focus()');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});
 await button('panoramaResetButton');
 const panoramaShot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(profile,'panorama-360.png'),Buffer.from(panoramaShot.data,'base64'));
 assert.equal(await ev('document.querySelectorAll("#panoramaScene button").length'),5);
 await ev('document.querySelector("#fallbackPointList button").click()');assert.equal(await ev('__memoriaCheck.state().activePoint'),'iut');
 await button('closePointButton');
 await ev('document.getElementById("panoramaPanel").scrollTop=1000');
 assert.equal(await ev('getComputedStyle(document.querySelector("#panoramaPanel > header")).position'),'static');
 await button('closePanoramaButton');
 // Begin fixture XR through the actual UI; actual Three renderer and native touch.
 await ev('__memoriaCheck.enable()');await button('startARButton',{scroll:true});assert.equal(await ev('__memoriaCheck.state().circle'),true);
 await until('__memoriaCheck.state().audio.musicPlaying');
 assert.equal(await ev('__memoriaCheck.state().clearAlpha'),0);
 assert.equal(await ev('__memoriaCheck.state().sceneBackground'),null);
 for (const id of ['appView','homeView','onboarding','panoramaPanel']) assert.equal(await ev('document.getElementById('+JSON.stringify(id)+').getClientRects().length'),0);
 for (const expression of ['document.documentElement','document.body','document.getElementById("content")']) assert.equal(await ev('getComputedStyle('+expression+').backgroundColor'),'rgba(0, 0, 0, 0)');
 await button('arMusicButton');assert.equal(await ev('__memoriaCheck.state().audio.musicPlaying'),false);
 assert.equal(await ev('localStorage.getItem("memoria-corti:ar-music")'),'off');
 await button('arMusicButton');await until('__memoriaCheck.state().audio.musicPlaying');
 // This backdrop is a test pattern, not a camera feed. Transparent AR layers
 // must allow it to show through. Hardware passthrough still requires a phone.
 await ev(`(()=>{const b=document.createElement('div');b.id='cameraFixture';b.style='position:fixed;inset:0;z-index:-1;background:repeating-linear-gradient(45deg,#738874 0 40px,#899c8a 40px 80px);display:grid;place-items:center;color:#273b31;font:14px Arial';b.textContent='Fond simulé · caméra non testée';document.body.appendChild(b);})()`);
 assert.equal(await ev('document.getElementById("navPlace").getAttribute("aria-current")'),'step');
 assert.equal(await ev('document.getElementById("navDiscover").getAttribute("aria-disabled")'),'true');
 await button('navPrepare');assert.equal(await ev('document.getElementById("prepareModal").hidden'),false);
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
 assert.equal(await ev('document.getElementById("prepareModal").hidden'),true);
 await button('placeSceneButton');await ev('__memoriaCheck.frame()');
 assert.equal(await ev('__memoriaCheck.state().count'),7);
 assert.equal(await ev('document.getElementById("navDiscover").getAttribute("aria-current")'),'step');
 const arShot=await send('Page.captureScreenshot',{format:'png'});const arPath=path.join(profile,'ar-visit.png');fs.writeFileSync(arPath,Buffer.from(arShot.data,'base64'));console.log('AR screenshot: '+arPath);
 for(const [width,height] of [[320,740],[768,1024],[1440,1000],[844,390]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<1000});
  await ev('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  const geometry=await ev(`(()=>{const t=document.getElementById('arToolbar').getBoundingClientRect(),n=document.getElementById('journeyNav').getBoundingClientRect(),s=document.getElementById('sceneControls').getBoundingClientRect();return {toolbarFits:t.left>=0&&t.right<=innerWidth&&t.top>=0&&t.bottom<innerHeight,controlsFit:s.left>=0&&s.right<=innerWidth&&s.bottom<=n.top,overlap:t.left<s.right&&t.right>s.left&&t.top<s.bottom&&t.bottom>s.top,targets:[...document.querySelectorAll('#arToolbar button,#journeyNav button,#sceneControls button:not([hidden])')].every(b=>{const r=b.getBoundingClientRect();return r.width>=44&&r.height>=44;})};})()`);
  assert.deepEqual(geometry,{toolbarFits:true,controlsFit:true,overlap:false,targets:true},JSON.stringify({width,height,geometry}));
 }
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await ev('__memoriaCheck.frame()');
 assert.equal(await ev('__memoriaCheck.state().mode'),'visit');
 await button('arListenButton');assert.equal(await ev('document.getElementById("storiesModal").hidden'),false);
 await button('welcomeAudioButton',{scroll:true});await until('__memoriaCheck.state().audio.playing');assert.match(await ev('document.getElementById("playerSource").textContent'),/Voix IA naturelle/);
 assert.equal(await ev('document.getElementById("audioDock").closest("[role=dialog]")?.getAttribute("aria-label")'),'Récits et ambiances');
 await ev('document.getElementById("volumeControl").focus()');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 assert.equal(await ev('document.activeElement.tagName'),'SUMMARY');
 assert.equal(await ev('document.activeElement.textContent'),'Transcription');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 assert.equal(await ev('document.activeElement.id'),'closeStoriesButton');
 await button('stopAudioButton');await button('closeStoriesButton');assert.equal(await ev('document.getElementById("storiesModal").hidden'),true);
 const initial=await ev('__memoriaCheck.pose("naissance")'),other=await ev('__memoriaCheck.pose("iut")');
 for(const id of ['iut','naissance','paoli','reouverture','corte']){
  await ev('__memoriaCheck.frame()');
  const point=await ev('(()=>{const e=document.querySelector("#poiHotspots [data-poi='+id+']");if(e.hidden)throw Error("hidden hotspot '+id+'");const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
  await tap(point);assert.equal(await ev('__memoriaCheck.state().activePoint'),id);await button('closePointButton');
 }
 assert.deepEqual(await ev('__memoriaCheck.pose("naissance")'),initial);
 // Native mesh tap and swipe in visit cannot modify any object.
 await tap(await ev('__memoriaCheck.point("naissance")'));
 assert.equal(await ev('__memoriaCheck.state().activePoint'),'naissance');await button('closePointButton');
 await dragObject('naissance',24);assert.equal(await ev('__memoriaCheck.state().activePoint'),null);
 assert.deepEqual(await ev('__memoriaCheck.pose("naissance")'),initial);
 await button('editModeButton');await until('__memoriaCheck.state().loaded');
 await ev('__memoriaCheck.frame()');
 await tap(await ev('__memoriaCheck.point("naissance")'));
 assert.equal(await ev('__memoriaCheck.state().selected'),'naissance');
 assert.deepEqual(await ev('__memoriaCheck.pose("naissance")'),initial);
 await dragObject('naissance',24);const moved=await ev('__memoriaCheck.pose("naissance")');
 assert.notDeepEqual(moved.p,initial.p);assert.deepEqual(moved.q,initial.q);assert.deepEqual(moved.s,initial.s);
 assert.deepEqual(await ev('__memoriaCheck.pose("iut")'),other);
 await button('rotateButton');assert.equal(await ev('__memoriaCheck.state().interaction'),'rotate');
 await dragObject('naissance',24);const rotated=await ev('__memoriaCheck.pose("naissance")');
 assert.notDeepEqual(rotated.q,moved.q);assert.deepEqual(rotated.p,moved.p);assert.deepEqual(rotated.s,moved.s);
 await button('saveLayoutButton');
 const saved=await ev('JSON.parse(localStorage.getItem("memoria-corti:iut-layout:v1"))');
 assert.equal(saved.objects.length,7);assert.equal(saved.root,undefined);
 await tap(await ev('__memoriaCheck.point("empty")'));assert.equal(await ev('__memoriaCheck.state().selected'),null);
 await ev('__memoriaCheck.scan(1.3)');await button('placeButton');await until('__memoriaCheck.state().loaded');
 assert.equal(await ev('__memoriaCheck.state().count'),8);
 await tap(await ev('__memoriaCheck.point("paoli")'));assert.equal(await ev('__memoriaCheck.state().selected'),'paoli');
 await button('clearButton');await ev('__memoriaCheck.frame()');
 assert.equal(await ev('__memoriaCheck.state().count'),7);assert.equal(await ev('__memoriaCheck.state().selected'),null);
 assert.equal(await ev('__memoriaCheck.state().circle'),true);assert.equal(await ev('__memoriaCheck.state().cancelled'),0);
 await ev('__memoriaCheck.scan(-1.3)');await button('placeButton');await until('__memoriaCheck.state().loaded');
 assert.equal(await ev('__memoriaCheck.state().count'),8);
 await ev('__memoriaCheck.movePhone()');assert.deepEqual(await ev('__memoriaCheck.pose("naissance")'),rotated);
 assert.equal(await ev('__memoriaCheck.state().error'),'');assert.equal(await ev('__memoriaCheck.state().gesture'),false);
 await button('visitModeButton');assert.equal(await ev('__memoriaCheck.state().selected'),null);
 await button('stopARButton');assert.equal(await ev('__memoriaCheck.state().count'),0);
 assert.equal(await ev('__memoriaCheck.state().audio.musicPlaying'),false);
 assert.equal(await ev('document.body.classList.contains("ar-session")'),false);
 assert.equal(await ev('document.getElementById("homeView").hidden'),false);
 assert.notEqual(await ev('getComputedStyle(document.getElementById("content")).display'),'none');
 await button('startARButton',{scroll:true});assert.equal(await ev('__memoriaCheck.state().placed'),false);
 await button('placeSceneButton');assert.equal(await ev('__memoriaCheck.state().count'),7);
 const restored=await ev('__memoriaCheck.pose("naissance")');
 assert.deepEqual(restored.p,rotated.p);assert.deepEqual(restored.q,rotated.q);
 await button('stopARButton');
 // Exercise each new navigation action, including a full exit with audio pending.
 await button('navExit');assert.equal(await ev('document.getElementById("stepSection").hidden'),true);
 await button('tab-route');await button('routeStartButton',{scroll:true});assert.equal(await ev('document.getElementById("stepSection").hidden'),false);
 if(!await ev('document.getElementById("poiModal").hidden'))await button('closePointButton');
 await ev('__memoriaCheck.availability(false)');
 assert.equal(await ev('document.getElementById("navPlace").getAttribute("aria-disabled")'),'true');
 await button('navPlace');assert.match(await ev('document.getElementById("experienceNotice").textContent'),/AR indisponible/);
 await ev('document.getElementById("experienceNotice").hidden=true');
 await button('navDiscover');assert.equal(await ev('document.getElementById("panoramaPanel").hidden'),false);
 await button('navListen');assert.equal(await ev('document.getElementById("storiesModal").hidden'),false);
 await button('closeStoriesButton');assert.equal(await ev('document.activeElement.id'),'navListen');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
 assert.equal(await ev('document.getElementById("panoramaPanel").hidden'),true);
 await button('navListen');await button('welcomeAudioButton',{scroll:true});await button('closeStoriesButton');
 await button('navExit');assert.equal(await ev('document.getElementById("audioDock").hidden'),true);
 assert.equal(await ev('document.getElementById("navDiscover").getAttribute("aria-disabled")'),'true');
 await button('tab-route');await button('routeStartButton',{scroll:true});
 if(!await ev('document.getElementById("poiModal").hidden'))await button('closePointButton');
 await ev('__memoriaCheck.enable()');await button('navPlace');
 assert.equal(await ev('__memoriaCheck.state().activeAR'),true);
 await button('navPlace');await button('navDiscover');
 assert.equal(await ev('__memoriaCheck.state().mode'),'visit');
 await button('navExit');assert.equal(await ev('__memoriaCheck.state().count'),0);
 assert.equal(await ev('__memoriaCheck.state().activeAR'),false);
 // Responsive geometry, keyboard focus, reduced motion and opaque glass fallback.
 for(const [width,height] of [[320,740],[768,1024],[1440,1000]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<1000});
  await ev('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  const geometry=await ev(`(()=>{const nav=document.querySelector('#appDock nav'),r=nav.getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom,overflow:document.getElementById('appView').scrollWidth>innerWidth,targets:[...nav.querySelectorAll('button')].every(b=>{const t=b.getBoundingClientRect();return t.width>=44&&t.height>=44;})};})()`);
  assert.ok(geometry.left>=10&&geometry.right<=width-10&&geometry.bottom<=height-10,JSON.stringify(geometry));
  assert.equal(geometry.targets,true);assert.equal(geometry.overflow,false);
  const shot=await send('Page.captureScreenshot',{format:'png'});const file=path.join(profile,'home-'+width+'.png');fs.writeFileSync(file,Buffer.from(shot.data,'base64'));console.log('Responsive screenshot: '+file);
 }
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'},{name:'prefers-reduced-transparency',value:'reduce'}]});
 assert.equal(await ev('getComputedStyle(document.getElementById("homeView")).scrollBehavior'),'auto');
 assert.equal(await ev('getComputedStyle(document.getElementById("journeyNav")).backdropFilter'),'none');
 await ev('document.getElementById("tab-home").focus()');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 assert.equal(await ev('document.activeElement.id'),'tab-explore');
 assert.notEqual(await ev('getComputedStyle(document.activeElement).outlineStyle'),'none');
 assert.equal(errors.length,0,JSON.stringify(errors));
 console.log('PASS: mobile UI, five POIs, illustrated 360 texture, transparent AR layers, original music toggle and exit cleanup, real WebGL and touch, visit protection, editing, repeat add/delete, relative persistence, exit/restart. XR tracking/camera are simulated.');
}catch(error){
 if(inspect)console.error('Browser state',await inspect('({state:__memoriaCheck.state(),diagnostic:document.getElementById("diagnosticText").textContent,touch:window.__touchTrace.slice(-15)})'));
 if(capture){const shot=await capture('Page.captureScreenshot',{format:'png'});const file=path.join(profile,'failure.png');fs.writeFileSync(file,Buffer.from(shot.data,'base64'));console.error('Failure screenshot: '+file);}
 console.error(error);throw error;}
finally{socket?.close();chrome.kill();server.close();}
