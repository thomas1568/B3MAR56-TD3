// Real Chrome UI and HTTP requests. Supabase responses are test fixtures;
// no real user account is created and no remote deployment is modified.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const walkingFixture=JSON.parse(fs.readFileSync(new URL('./fixtures/ign-corte-walk.json',import.meta.url)));
const root = process.cwd(); let failMap = false, failNative = false, mapRequests = 0, routingMode = 'ok', routingCalls = 0; let withAuth = false, storedProfile = null, storedProgress = null, user = null;
const users = new Map(), photos = new Map(), calls = [];
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost'); if(url.pathname.startsWith('/B3MAR56-TD3/'))url.pathname=url.pathname.slice('/B3MAR56-TD3'.length); res.setHeader('Cache-Control', 'no-store');
  const json = (data, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
  if (url.pathname === '/assets/maps/corte.json') { mapRequests++; if (failMap) { json({ error: 'Map fixture unavailable' }, 503); return; } }
  const read = async () => { const chunks = []; for await (const chunk of req) chunks.push(chunk); return Buffer.concat(chunks); };
  if (url.pathname.startsWith('/auth/v1/')) {
    const body = req.method === 'POST' ? JSON.parse((await read()).toString() || '{}') : {};
    calls.push(url.pathname);
    if (url.pathname.endsWith('/signup')) { users.set(body.email, body.password); user = { id: '00000000-0000-4000-8000-000000000001' }; json({ user }); return; }
    if (url.pathname.endsWith('/token')) {
      if (url.searchParams.get('grant_type') === 'password' && users.get(body.email) !== body.password) { json({ error_code: 'invalid_credentials' }, 400); return; }
      json({ access_token: 'ui-fixture-token', refresh_token: 'ui-fixture-refresh', expires_in: 3600, user }); return;
    }
    if (url.pathname.endsWith('/user')) { json(user); return; }
    if (url.pathname.endsWith('/logout')) { json({}); return; }
  }
  if (url.pathname.startsWith('/rest/v1/')) {
    if (req.headers.authorization !== 'Bearer ui-fixture-token') { json({}, 401); return; }
    calls.push(url.pathname);
    const profile = url.pathname.endsWith('memoria_profiles');
    if (req.method === 'POST') { const body = JSON.parse((await read()).toString()); if (profile) storedProfile = body; else storedProgress = body; json({}); }
    else json(profile ? storedProfile ? [storedProfile] : [] : storedProgress ? [storedProgress] : []);
    return;
  }
  if (url.pathname.startsWith('/storage/v1/object/')) {
    const prefix = '/storage/v1/object/';
    if (req.method === 'POST' && url.pathname.startsWith(prefix + 'sign/')) { json({ signedURL: url.pathname.replace('/storage/v1', '') + '?token=fixture' }); return; }
    if (req.method === 'GET' && url.pathname.startsWith(prefix + 'sign/')) { res.writeHead(200, { 'Content-Type': 'image/jpeg' }); res.end(photos.get(url.pathname.slice((prefix + 'sign/').length))); return; }
    if (req.method === 'POST') { photos.set(url.pathname.slice(prefix.length), await read()); json({}); return; }
    if (req.method === 'DELETE') { const body = JSON.parse((await read()).toString()); for (const name of body.prefixes) photos.delete('avatars/' + name); json([]); return; }
  }

  if (url.pathname === '/memoria/config.js') {
    res.writeHead(200,{'Content-Type':'text/javascript'});
    res.end(`export const ACCOUNT_CONFIG={supabaseUrl:${withAuth?JSON.stringify('http://127.0.0.1:'+server.address().port):"''"},publishableKey:'public-ui-fixture'};
      export const MAP_CONFIG={tilesURL:'http://127.0.0.1:${server.address().port}/test/tiles/{z}/{x}/{y}.png',routingURL:'http://127.0.0.1:${server.address().port}/test/walking',routingResource:'bdtopo-valhalla'};`);return;
  }
  if(url.pathname.startsWith('/test/tiles/')){res.writeHead(503);res.end();return;}
  if(url.pathname==='/test/walking') {
    routingCalls++;
    if(routingMode==='error'){json({error:'fixture unavailable'},503);return;}
    if(routingMode==='malformed'){json({distance:123});return;}
    if(routingMode==='slow'){setTimeout(()=>json(walkingFixture),600);return;}
    json(walkingFixture);return;
  }
  if(url.pathname==='/assets/ar/iut-scene-v1.usdz'&&failNative){res.writeHead(503);res.end();return;}
  const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  try { const data = fs.readFileSync(file); res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary' })[path.extname(file)] || 'application/octet-stream' }); res.end(data); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memoria-shell-'));
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new','--no-first-run','--no-default-browser-check','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=0','--user-data-dir=' + profileDir,'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket, ev, send;
try {
  for (let n = 0; n < 100 && !fs.existsSync(path.join(profileDir,'DevToolsActivePort')); n++) await new Promise(resolve => setTimeout(resolve,100));
  const port = fs.readFileSync(path.join(profileDir,'DevToolsActivePort'),'utf8').split('\n')[0];
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl); await new Promise(resolve => socket.addEventListener('open',resolve,{once:true}));
  let sequence = 0, onLoad = null; const pending = new Map(), errors = [];
  socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.id) { const entry = pending.get(message.id); pending.delete(message.id); message.error ? entry.reject(message.error) : entry.resolve(message.result); } if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails); if (message.method === 'Page.loadEventFired') { onLoad?.(); onLoad = null; } });
  send = (method, params = {}) => new Promise((resolve,reject) => { const id = ++sequence; pending.set(id,{resolve,reject}); socket.send(JSON.stringify({id,method,params})); });
  ev = async expression => { const result = await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}); if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails)); return result.result.value; };
  const until = async expression => { for (let n=0;n<200;n++) { if (await ev(expression)) return; await new Promise(resolve=>setTimeout(resolve,50)); } throw Error('Timeout: '+expression); };
  const input = (id,value) => ev(`(()=>{const node=document.getElementById(${JSON.stringify(id)});node.value=${JSON.stringify(value)};node.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const click = async id => {
    await ev('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))).then(()=>Promise.all([...document.querySelectorAll(".atlas-sheet,.nav-active-pill")].flatMap(n=>n.getAnimations()).map(a=>a.finished.catch(()=>{}))))');
    await ev(`(()=>{const n=document.getElementById(${JSON.stringify(id)}),r=n.getBoundingClientRect();let clip=r.top<0||r.bottom>innerHeight||r.left<0||r.right>innerWidth;for(let p=n.parentElement;p;p=p.parentElement){const s=getComputedStyle(p);if(/auto|scroll|hidden|clip/.test(s.overflow+s.overflowY+s.overflowX)){const b=p.getBoundingClientRect();if(r.top<b.top||r.bottom>b.bottom||r.left<b.left||r.right>b.right)clip=true;}}if(clip)n.scrollIntoView({block:'center',behavior:'instant'});})()`);
    await ev('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
    await ev('Promise.all(document.getAnimations().filter(a=>["memoria-reveal","memoria-settings"].includes(a.id)).map(a=>a.finished.catch(()=>{})))');
    const point=await ev(`(()=>{const n=document.getElementById(${JSON.stringify(id)});if(n.disabled||!n.getClientRects().length||getComputedStyle(n).visibility!=='visible'||n.closest('[inert]'))throw Error('Unavailable '+n.id);const r=n.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,h=document.elementFromPoint(x,y);if(h!==n&&!n.contains(h))throw Error('Covered '+n.id+' by '+h?.outerHTML.slice(0,180));return{x,y};})()`);
    await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await ev('new Promise(r=>requestAnimationFrame(r))');await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await ev('new Promise(r=>setTimeout(r,70))');
  };
  const shot = async name => { await ev('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))).then(()=>Promise.all([...document.querySelectorAll(".nav-active-pill,.atlas-sheet")].flatMap(n=>n.getAnimations()).map(a=>a.finished.catch(()=>{}))))'); await ev('Promise.all(document.getAnimations().filter(a=>["memoria-reveal","memoria-settings"].includes(a.id)).map(a=>a.finished.catch(()=>{})))'); const result = await send('Page.captureScreenshot',{format:'png'}); const output=path.join(root,'artifacts','refonte'); fs.mkdirSync(output,{recursive:true}); const file = path.join(output,name+'.png'); fs.writeFileSync(file,Buffer.from(result.data,'base64')); console.log('Screenshot: '+file); };
  let firstNavigation = true;
  const nav = async () => { const loaded = new Promise(resolve => { onLoad = resolve; }); await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/B3MAR56-TD3/?run=${Date.now()}`}); await loaded; await until('!!document.getElementById("guestButton")');
    if (firstNavigation) { firstNavigation = false; assert.equal(await ev('document.getElementById("appIntro").hidden'),false); assert.equal(await ev('document.getElementById("content").inert'),true); await shot('entry-animation'); }
    await until('!document.getElementById("onboardingStatus").textContent.includes("Préparation")'); await until('document.getElementById("appIntro").hidden'); };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true}); await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
  await nav(); await shot('welcome-mobile');
  await click('signupButton'); assert.equal(await ev('document.getElementById("onboardingSetup").hidden'),false);
  assert.equal(await ev('getComputedStyle(document.getElementById("pseudoInput")).fontSize'),'16px');
  assert.equal(await ev('document.querySelector("meta[name=viewport]").content.includes("user-scalable=no")'),false);
  assert.equal(await ev('document.getElementById("onboardingAuth").hidden'),true);
  await input('pseudoInput','x'); await click('saveProfileButton');
  assert.equal(await ev('document.getElementById("pseudoInput").getAttribute("aria-invalid")'),'true');
  await input('pseudoInput','Lisandra');
  await ev('document.querySelector("[data-avatar=livre]").click()'); await click('saveProfileButton');
  await until('document.getElementById("onboarding").hidden');
  assert.match(await ev('document.getElementById("greeting").textContent'),/Lisandra/);
  await ev('document.getElementById("greeting").tabIndex=-1;document.getElementById("greeting").focus({preventScroll:true})');
  assert.equal(await ev('getComputedStyle(document.getElementById("greeting")).outlineStyle'),'none');
  assert.equal(await ev('document.getElementById("sessionBadge").textContent'),'Mode invité');
  await until('document.querySelector(".feature-card > img").complete && document.querySelector(".feature-card > img").naturalWidth>100');
  assert.match(await ev('document.querySelector(".feature-card > img").getAttribute("src")'),/photos\/corte-citadelle/);
  // Real pointer drags select an arbitrary tab without generating a second click.
  async function drag(from, to, cancel = false) {
    await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});
    for(let n=1;n<=8;n++) { await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*n/8,y:from.y+(to.y-from.y)*n/8}]}); await ev('new Promise(r=>setTimeout(r,16))'); }
    await send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});
  }
  const tabPoint = id => ev(`(()=>{const r=document.getElementById(${JSON.stringify(id)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await drag(await tabPoint('tab-home'),await tabPoint('tab-profile'));
  await until('document.getElementById("tab-profile").getAttribute("aria-current")==="page"');
  await drag(await tabPoint('tab-profile'),await tabPoint('tab-home'));
  await until('document.getElementById("tab-home").getAttribute("aria-current")==="page"');
  await drag(await tabPoint('tab-home'),await tabPoint('tab-profile'),true);
  assert.equal(await ev('document.getElementById("tab-home").getAttribute("aria-current")'),'page');
  const heading = await ev('(()=>{const r=document.getElementById("greeting").getBoundingClientRect();return {x:Math.min(270,r.right-20),y:r.y+r.height/2};})()');
  await drag(heading,{x:heading.x-140,y:heading.y+3});
  await until('document.getElementById("tab-explore").getAttribute("aria-current")==="page"');
  await click('tab-home');
  await click('tab-profile'); await shot('profile-mobile'); await click('profileSettings-identity');
  await ev('document.querySelector("[data-avatar=initiales]").click()'); await until('!document.getElementById("saveProfileButton").disabled');
  assert.equal(await ev('document.querySelector("#tab-profile .avatar").textContent'),'L');
  await input('pseudoInput','Lisandra Corti'); await click('saveProfileButton');
  await until('document.getElementById("profileMessage").textContent==="Votre profil est enregistré."');
  assert.equal(await ev('document.querySelector("#tab-profile .avatar").textContent'),'LC');
  await ev(`(()=>{const dt=new DataTransfer();dt.items.add(new File(['<svg/>'],'test.svg',{type:'image/svg+xml'}));const n=document.getElementById('photoInput');n.files=dt.files;n.dispatchEvent(new Event('change'));})()`);
  assert.match(await ev('document.getElementById("profileMessage").textContent'),/JPEG/);
  async function importPhoto() {
    await ev(`new Promise(resolve=>{const canvas=document.createElement('canvas');canvas.width=900;canvas.height=600;const ctx=canvas.getContext('2d');ctx.fillStyle='#273B31';ctx.fillRect(0,0,450,600);ctx.fillStyle='#B86D4E';ctx.fillRect(450,0,450,600);canvas.toBlob(blob=>{const dt=new DataTransfer();dt.items.add(new File([blob],'portrait.png',{type:'image/png'}));const node=document.getElementById('photoInput');node.files=dt.files;node.dispatchEvent(new Event('change'));resolve();},'image/png');})`);
    await until('!document.getElementById("cropModal").hidden'); await input('cropZoom','1.4');
    const cropPoint=await ev('(()=>{const r=document.getElementById("cropCanvas").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
    const zoomBeforePinch=await ev('Number(document.getElementById("cropZoom").value)');
    await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:cropPoint.x-40,y:cropPoint.y},{id:2,x:cropPoint.x+40,y:cropPoint.y}]});
    for(let n=1;n<=5;n++)await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:cropPoint.x-40-n*5,y:cropPoint.y},{id:2,x:cropPoint.x+40+n*5,y:cropPoint.y}]});
    await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.ok(await ev('Number(document.getElementById("cropZoom").value)')>zoomBeforePinch);
    await click('resetCrop');assert.equal(await ev('Number(document.getElementById("cropZoom").value)'),1);
    await input('cropZoom','1.4');
    const beforeCrop=await ev('document.getElementById("cropCanvas").toDataURL()');
    await drag(cropPoint,{x:cropPoint.x+50,y:cropPoint.y+22});
    assert.notEqual(await ev('document.getElementById("cropCanvas").toDataURL()'),beforeCrop);
    assert.ok(await ev('(()=>{const r=document.getElementById("confirmCrop").getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;})()'));
    await shot('photo-crop');await click('confirmCrop');
    await until('document.getElementById("cropModal").hidden'); await until('!document.getElementById("saveProfileButton").disabled');
  }
  await ev('window.createImageBitmap=undefined'); // Also exercise the decoder used on older phones.
  await importPhoto();
  await until('!!document.querySelector("#tab-profile img")');
  assert.equal(await ev('document.querySelector("#tab-profile img").src'),await ev('document.querySelector("#headerProfile img").src'));
  { const loaded = new Promise(resolve => { onLoad = resolve; }); await send('Page.reload'); await loaded; } await until('document.getElementById("onboarding")?.hidden && document.getElementById("appIntro").hidden');
  assert.match(await ev('document.getElementById("greeting").textContent'),/Lisandra Corti/);
  assert.equal(await ev('document.activeElement.id'),'profileTitle');
  assert.equal(await ev('getComputedStyle(document.getElementById("greeting")).outlineStyle'),'none');
  assert.ok(await ev('!!document.querySelector("#tab-profile img")'));

  assert.equal(await ev('document.querySelectorAll("#appDock [data-page]").length'),5);
  assert.equal(await ev('document.getElementById("page-profile").hidden'),false);
  await click('tab-home');
  await until('document.getElementById("tab-home").getAttribute("aria-current")==="page"');
  const scroll=await ev('document.getElementById("appView").scrollTop=680;document.getElementById("appView").scrollTop');
  await until('document.querySelector(".app-header").inert');
  await shot('home-logo-hidden');
  await ev('document.getElementById("appView").scrollTop=480');
  await until('!document.querySelector(".app-header").inert');
  await ev('document.getElementById("appView").scrollTop=680');
  await until('document.querySelector(".app-header").inert');
  assert.match(await ev('document.querySelector("#homePlaces [data-place=iut] img").src'),/iut-corte\.png/);
  await click('tab-explore');await input('exploreSearch','Palazzu');
  assert.equal(await ev('document.querySelectorAll("#explorePlaces article").length'),1);
  await click('tab-home');assert.equal(await ev('document.getElementById("appView").scrollTop'),scroll);
  await click('tab-explore');assert.equal(await ev('document.getElementById("exploreSearch").value'),'Palazzu');
  await ev('history.back()');await until('document.getElementById("tab-home").getAttribute("aria-current")==="page"');
  await ev('history.forward()');await until('document.getElementById("tab-explore").getAttribute("aria-current")==="page"');
  await input('exploreSearch','');
  // Audio is started by a real user gesture and remains active across the five destinations.
  await click('tab-listen');
  await ev('document.querySelector("#listenStories button").id="testPlayStory"');await click('testPlayStory');
  await until('!document.getElementById("audioDock").hidden && !document.getElementById("pauseAudioButton").disabled');
  await click('tab-profile');assert.equal(await ev('document.getElementById("pauseAudioButton").disabled'),false);
  await click('tab-explore');assert.equal(await ev('document.getElementById("pauseAudioButton").disabled'),false);
  await click('pauseAudioButton');await until('!document.getElementById("resumeAudioButton").hidden');
  await click('resumeAudioButton');
  await click('tab-route');
  await until('!!document.querySelector("#walkingMap .leaflet-map-pane")');
  await until('document.getElementById("map-stop-iut").getClientRects().length>0');
  assert.equal(await ev('location.hash'),'#parcours');
  assert.ok(await ev('(()=>{const r=document.getElementById("walkingMap").getBoundingClientRect();return r.width===innerWidth&&r.height===innerHeight;})()'));
  // Native dragging opens the three sheet positions; buttons remain an equivalent.
  const settleSheet=()=>ev('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))).then(()=>Promise.all(document.querySelector(".atlas-sheet").getAnimations().map(a=>a.finished.catch(()=>{}))))');
  const handleCenter=()=>ev('(()=>{const r=document.querySelector(".sheet-handle").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
  await settleSheet();let hp=await handleCenter();await drag(hp,{x:hp.x,y:hp.y-80});
  assert.equal(await ev('document.querySelector(".atlas-sheet").dataset.position'),'list');
  await settleSheet();hp=await handleCenter();await drag(hp,{x:hp.x,y:hp.y-80});
  assert.equal(await ev('document.querySelector(".atlas-sheet").dataset.position'),'detail');
  await ev('document.querySelector(".sheet-positions [data-position=compact]").click()');await settleSheet();
  const markerBefore=await ev('document.getElementById("map-stop-palazzu").getBoundingClientRect().x');
  const panY=await ev('document.querySelector(".atlas-sheet").getBoundingClientRect().top-60');
  await drag({x:45,y:panY},{x:85,y:panY+20});
  assert.notEqual(await ev('document.getElementById("map-stop-palazzu").getBoundingClientRect().x'),markerBefore);
  await click('map-reset');
  // Expand the sheet and choose a fixed destination from the keyboard-accessible list.
  await ev('document.querySelector(".sheet-positions [data-position=list]").click()');
  await ev('document.querySelector(".atlas-list [data-place=iut]").click()');
  assert.match(await ev('document.getElementById("mapPlaceTitle").textContent'),/IUT de Corse/);
  assert.equal(await ev('location.hash'),'#parcours?lieu=iut');
  assert.equal(await ev('document.getElementById("map-stop-iut").dataset.longitude'),'9.154278');
  await shot('iut-place-mobile');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
  assert.equal(await ev('document.activeElement.dataset.place'),'iut');
  await input('mapSearch','introuvable');assert.equal(await ev('document.querySelector(".atlas-empty").hidden'),false);
  await click('resetMapFilters');await until('document.getElementById("mapSearch").value===""');
  await ev('document.querySelector(".atlas-list [data-place=palazzu]").click()');
  await until('!document.querySelector(".atlas-photo-image").hidden');
  await shot('palazzu-place-mobile');
  // Route responses are recorded real IGN data; no fixture is used in production.
  await click('planWalking');
  assert.equal(await ev('document.getElementById("walkingStart").value'),'iut');
  await click('calculateWalking');await until('!document.getElementById("walkingResult").hidden');
  assert.match(await ev('document.getElementById("walkingDistance").textContent'),/1,2 km/);
  assert.match(await ev('document.getElementById("walkingDuration").textContent'),/19 min/);
  assert.ok(await ev('document.querySelectorAll("#walkingInstructions li").length>3'));
  assert.ok(await ev('!!document.querySelector(".leaflet-overlay-pane path")'));
  await shot('walking-route-mobile');
  const count=routingCalls;await click('tab-listen');await click('tab-route');
  assert.equal(routingCalls,count);assert.equal(await ev('document.getElementById("walkingResult").hidden'),false);
  await send('Browser.grantPermissions',{origin:'http://127.0.0.1:'+server.address().port,permissions:['geolocation']});
  await send('Emulation.setGeolocationOverride',{latitude:42.297383,longitude:9.154338,accuracy:8});
  // Headless Chrome exposes one-shot geolocation. Continuous fixes are explicit
  // test callbacks; the production watchPosition implementation is unchanged.
  await ev(`window.__gpsFixture={success:null,error:null,cleared:false};navigator.geolocation.watchPosition=(success,error)=>{window.__gpsFixture.success=success;window.__gpsFixture.error=error;queueMicrotask(()=>success({coords:{latitude:42.297383,longitude:9.154338,accuracy:8},timestamp:Date.now()}));return 73;};navigator.geolocation.clearWatch=id=>{window.__gpsFixture.cleared=id===73;window.__gpsFixture.success=null;};`);
  await click('startGuidance');await until('document.getElementById("cityMap").dataset.tracking==="true"');
  await until('document.getElementById("guidanceStatus").textContent.includes("restant")');
  const mid=walkingFixture.geometry.coordinates[Math.floor(walkingFixture.geometry.coordinates.length/2)];
  await send('Emulation.setGeolocationOverride',{latitude:mid[1],longitude:mid[0],accuracy:8});
  await ev(`window.__gpsFixture.error({code:2});window.__gpsFixture.success({coords:{latitude:${mid[1]},longitude:${mid[0]},accuracy:8},timestamp:Date.now()});`);
  await until('Number(document.getElementById("walkingProgress").value)>5');
  assert.equal(routingCalls,count);await click('stopGuidance');
  assert.equal(await ev('document.getElementById("cityMap").dataset.tracking'),'false');assert.equal(await ev('window.__gpsFixture.cleared'),true);
  // A delayed location permission must not restart a route that was cleared.
  await ev('window.__originalLocate=navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);navigator.geolocation.getCurrentPosition=success=>{window.__lateLocate=success;};document.getElementById("startGuidance").click();document.getElementById("clearWalking").click();window.__lateLocate({coords:{latitude:42.297383,longitude:9.154338,accuracy:8},timestamp:Date.now()});navigator.geolocation.getCurrentPosition=window.__originalLocate;');
  await ev('new Promise(r=>requestAnimationFrame(r))');
  assert.equal(await ev('document.getElementById("cityMap").dataset.tracking'),'false');
  assert.equal(await ev('window.__gpsFixture.success'),null);
  // Failed calls clear the previous successful result instead of pretending a route exists.
  routingMode='error';await ev('document.getElementById("walkingStart").value="custom";document.getElementById("walkingStart").dispatchEvent(new Event("change"));document.getElementById("startLatitude").value="42.2974";document.getElementById("startLongitude").value="9.1543"');
  await click('calculateWalking');await until('document.getElementById("walkingStatus").classList.contains("is-error")');
  assert.equal(await ev('document.getElementById("walkingResult").hidden'),true);
  routingMode='malformed';await click('calculateWalking');await until('document.getElementById("walkingStatus").classList.contains("is-error")');
  routingMode='slow';await click('calculateWalking');await click('cancelWalkingRequest');
  assert.match(await ev('document.getElementById("walkingStatus").textContent'),/annul/);
  routingMode='ok';
  await send('Browser.setPermission',{permission:{name:'geolocation'},setting:'denied',origin:'http://127.0.0.1:'+server.address().port});
  await click('useWalkingLocation');await until('document.getElementById("walkingStatus").textContent.includes("refus")');
  assert.equal(await ev('document.getElementById("walkingResult").hidden'),true);
  await click('closeWalking');
  // A direct hash survives a reload under the GitHub Pages path.
  await click('tab-home');
  await ev('location.hash="#parcours?lieu=fixed-gps"');await until('document.getElementById("mapPlaceTitle").textContent==="IUT de Corse"');
  assert.equal(await ev('location.hash'),'#parcours?lieu=iut');
  assert.equal(await ev('document.querySelectorAll(".leaflet-place-icon").length'),2);
  await ev('location.hash="#parcours?lieu=inconnu"');await until('document.getElementById("mapResults").textContent.includes("introuvable")');
  assert.equal(await ev('document.querySelector(".atlas-detail").hidden'),true);
  await ev('location.hash="#parcours?lieu=palazzu"');await until('!document.querySelector(".atlas-detail").hidden');
  {const ready=new Promise(r=>{onLoad=r;});await send('Page.reload');await ready;}
  await until('document.getElementById("onboarding")?.hidden && document.getElementById("appIntro").hidden');
  await until('document.getElementById("mapPlaceTitle")?.textContent==="Le Palazzu Naziunale"');
  assert.ok(await ev('location.pathname.startsWith("/B3MAR56-TD3/")'));
  assert.equal(await ev('performance.getEntriesByType("resource").some(r=>/three\.module|three\.core|GLTFLoader/.test(r.name))'),false);
  await click('tab-home');await click('heroAction');await until('!document.getElementById("stepSection").hidden');
  await until('document.getElementById("arAvailability").textContent.indexOf("Préparation")<0');
  assert.equal(await ev('document.querySelectorAll("#pointList button").length'),5);
  await ev('document.querySelector("#pointList button").click()');await until('!document.getElementById("poiModal").hidden');
  assert.equal(await ev('document.getElementById("enlargeImageButton").disabled'),true);
  assert.ok(await ev('document.getElementById("pointTranscript").textContent.length>40'));
  await shot('point-mobile');

  // Test-only media enables the archive interaction without fabricating production archives.
  await click('closePointButton');
  await ev(`import(new URL('content/iut.js?v=33',document.baseURI).href).then(m=>{m.IUT_STEP.points[0].image={src:'assets/photos/corte-palazzu.jpg',label:'Image de test',caption:'Fixture de vérification de l’agrandissement',credit:'Pierre Bona · CC BY-SA 3.0',date:'Fixture',rights:{status:'autorise',label:'Fixture de test'}};})`);
  await ev('document.querySelector("#pointList button").click()');await click('enlargeImageButton');await until('!document.getElementById("archiveModal").hidden');
  await input('archiveZoom','2');assert.match(await ev('document.getElementById("archiveImage").style.width'),/200/);
  await click('closeArchiveButton');assert.equal(await ev('document.activeElement.id'),'enlargeImageButton');await click('closePointButton');

  await click('openPanoramaButton');await until('document.querySelector("canvas.panorama-canvas")');
  await shot('panorama-mobile');await click('closePanoramaButton');await click('backToApp');await click('tab-home');
  for(const [width,height]of[[320,740],[390,844],[768,1024],[1440,1000]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<900});
    await click('tab-home');await ev('document.getElementById("appView").scrollTop=0');await shot('home-'+width);
    assert.equal(await ev('document.getElementById("appView").scrollWidth>innerWidth'),false,await ev('JSON.stringify({width:innerWidth,scroll:document.getElementById("appView").scrollWidth,wide:[...document.querySelectorAll("#appView *")].filter(n=>n.getBoundingClientRect().right>innerWidth+.5).slice(0,30).map(n=>({tag:n.tagName,id:n.id,class:n.className,right:n.getBoundingClientRect().right,width:n.getBoundingClientRect().width}))})'));
    assert.ok(await ev('[...document.querySelectorAll("#appDock button")].every(b=>{const r=b.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.left>=0&&r.right<=innerWidth;})'));

    await click('headerProfile');
    assert.equal(await ev('document.getElementById("headerProfile").getAttribute("aria-expanded")'),'true');
    assert.equal(await ev('document.activeElement.id'),'profileMenuProfile');
    assert.ok(await ev('(()=>{const r=document.getElementById("profileDropdownMenu").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;})()'));
    await shot('profile-dropdown-'+width);
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'End',code:'End',windowsVirtualKeyCode:35});
    assert.equal(await ev('document.activeElement.id'),'profileMenuLogout');
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    assert.equal(await ev('document.getElementById("profileDropdownMenu").hidden'),true);
    assert.equal(await ev('document.activeElement.id'),'headerProfile');
    await click('headerProfile'); await click('profileMenuProfile');
    assert.equal(await ev('document.getElementById("page-profile").hidden'),false);
    assert.equal(await ev('document.getElementById("profileDropdownMenu").hidden'),true);
    await click('headerProfile'); await click('tab-home');
    assert.equal(await ev('document.getElementById("profileDropdownMenu").hidden'),true);

    await ev('document.querySelector("#homePlaces .card-stack-next").id="homeStackNext"; document.querySelector("#homePlaces .card-stack-prev").id="homeStackPrevious"');
    assert.equal(await ev('document.querySelector("#homePlaces .is-top").dataset.place'),'iut');
    await click('homeStackNext');
    await until('document.getElementById("homePlaces").dataset.activePlace==="palazzu"');
    assert.equal(await ev('document.querySelector("#homePlaces [data-place=iut]").inert'),true);
    assert.equal(await ev('document.querySelectorAll("#explorePlaces .stack-card").length'),0);
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});
    await until('document.getElementById("homePlaces").dataset.activePlace==="iut"');
    await ev('document.querySelector("#homePlaces .is-top .card-visual").scrollIntoView({block:"center",behavior:"instant"})');
    await ev('Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})))');
    const stackPoint = await ev('(()=>{const r=document.querySelector("#homePlaces .is-top .card-visual").getBoundingClientRect();return {x:r.x+r.width*.75,y:r.y+r.height*.5};})()');
    await drag(stackPoint,{x:stackPoint.x-110,y:stackPoint.y});
    await until('document.getElementById("homePlaces").dataset.activePlace==="palazzu"');
    assert.equal(await ev('document.getElementById("tab-home").getAttribute("aria-current")'),'page');
    await ev('Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})))');
    await shot('home-card-stack-'+width);
    await ev('document.getElementById("homeStackPrevious").scrollIntoView({block:"center",behavior:"instant"})');
    await click('homeStackPrevious');
    await until('document.getElementById("homePlaces").dataset.activePlace==="iut"');

    await click('tab-explore');
    await ev('document.querySelector("#explorePlaces .carousel-next").id="exploreNext";document.querySelector("#explorePlaces .carousel-prev").id="explorePrevious"');
    await until('document.getElementById("explorePlaces").dataset.activePlace==="iut"');
    await click('exploreNext');
    await until('document.getElementById("explorePlaces").dataset.activePlace==="palazzu"');
    assert.equal(await ev('document.querySelector("#explorePlaces .carousel-next").getAttribute("aria-disabled")'),'true');
    await ev('document.querySelector("#explorePlaces .carousel-viewport").focus({preventScroll:true})');
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Home',code:'Home',windowsVirtualKeyCode:36});
    await until('document.getElementById("explorePlaces").dataset.activePlace==="iut"');
    await ev('document.querySelector("#explorePlaces .carousel-viewport").scrollLeft=0');
    await ev('document.querySelector("#explorePlaces .is-current .card-visual").scrollIntoView({block:"center",inline:"center",behavior:"instant"})');
    const railPoint = await ev('(()=>{const r=document.querySelector("#explorePlaces .is-current .card-visual").getBoundingClientRect();return {x:r.x+r.width*.8,y:r.y+r.height*.5};})()');
    await drag(railPoint,{x:railPoint.x-220,y:railPoint.y});
    await until('document.getElementById("explorePlaces").dataset.activePlace==="palazzu"');
    assert.equal(await ev('document.getElementById("tab-explore").getAttribute("aria-current")'),'page');
    await shot('explore-carousel-'+width);
    if (width === 1440) {
      await ev('document.querySelector("#explorePlaces .carousel-viewport").scrollTo({left:99999,behavior:"instant"})');
      await ev('document.querySelector("#explorePlaces [data-place=palazzu] .card-visual").scrollIntoView({block:"center",inline:"center",behavior:"instant"})');
      const mouseStart = await ev('(()=>{const r=document.querySelector("#explorePlaces [data-place=palazzu] .card-visual").getBoundingClientRect();return {x:r.x+r.width*.25,y:r.y+r.height*.5};})()');
      await send('Input.dispatchMouseEvent',{type:'mousePressed',...mouseStart,button:'left',clickCount:1});
      for(let n=1;n<=10;n++) {
        await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:mouseStart.x+n*28,y:mouseStart.y,button:'left',buttons:1});
        await ev('new Promise(r=>setTimeout(r,16))');
      }
      await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:mouseStart.x+280,y:mouseStart.y,button:'left',clickCount:1});
      await until('document.getElementById("explorePlaces").dataset.activePlace==="iut"');
      assert.equal(await ev('document.getElementById("tab-explore").getAttribute("aria-current")'),'page');
    }

    await click('filterAvailable');
    assert.equal(await ev('document.querySelectorAll("#explorePlaces article").length'),1);
    assert.equal(await ev('document.querySelector("#explorePlaces .carousel-controls").hidden'),true);
    await click('filterComing');
    assert.equal(await ev('document.querySelector("#explorePlaces article").dataset.place'),'palazzu');
    await click('filterAll');
    await input('exploreSearch','zzzzzz');
    assert.equal(await ev('document.getElementById("explorePlaces").hidden'),true);
    assert.equal(await ev('document.getElementById("exploreEmpty").hidden'),false);
    await input('exploreSearch','');
    assert.equal(await ev('document.querySelectorAll("#explorePlaces article").length'),2);
    assert.equal(await ev('document.querySelectorAll("#homePlaces .stack-card").length'),2);
    for(const page of ['explore','listen','profile']){await click('tab-'+page);assert.equal(await ev('document.getElementById("appView").scrollWidth>innerWidth'),false);await shot(page+'-'+width);}

    await click('profileSettings-account');
    assert.equal(await ev('document.getElementById("profileSettings").dataset.stackPage'),'account');
    assert.equal(await ev('document.getElementById("profileEditorHome").closest(".settings-stack-page").inert'),true);
    await shot('profile-settings-account-'+width);
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    assert.equal(await ev('document.activeElement.id'),'profileSettings-account');
    await click('profileSettings-progress');
    const settingsPoint = await ev('(()=>{const r=document.querySelector("#profileSettings h2").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
    await drag(settingsPoint,{x:settingsPoint.x+75,y:settingsPoint.y});
    assert.equal(await ev('document.getElementById("profileSettings").dataset.stackPage'),'settings');
    assert.equal(await ev('document.getElementById("tab-profile").getAttribute("aria-current")'),'page');
    await click('profileSettings-identity');
    await input('pseudoInput','Brouillon panneau');
    await click('profileSettingsBack');
    await click('profileSettings-identity');
    assert.equal(await ev('document.getElementById("pseudoInput").value'),'Brouillon panneau');
    await input('pseudoInput','Lisandra Corti');
    await click('profileSettingsBack');
    await shot('profile-settings-'+width);
    await click('tab-route');await ev('document.querySelector(".sheet-positions [data-position=compact]").click()');await click('map-reset');await shot('map-'+width);
    assert.ok(await ev('(()=>{const n=document.querySelector(".leaflet-control-attribution a"),r=n.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return h===n||n.contains(h);})()'),'Cartographic attribution must remain visible and clickable');
    assert.equal(await ev('document.querySelector(".sheet-handle").getClientRects().length>0'),width<900);
  }
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await click('tab-profile');await click('profileSettings-identity');await input('pseudoInput','Brouillon local');await click('tab-home');await click('tab-profile');
  assert.equal(await ev('document.getElementById("pseudoInput").value'),'Brouillon local');await input('pseudoInput','Lisandra Corti');await click('saveProfileButton');
  // A separate configured run exercises actual auth/REST/Storage HTTP boundaries.
  withAuth = true; await ev('localStorage.clear()'); await nav();
  await click('createAccountButton'); await input('emailInput','lisandra@example.com'); await input('passwordInput','password-fixture'); await click('authSubmit');
  await until('document.getElementById("authMessage").textContent.includes("messagerie")');
  assert.equal(await ev('document.getElementById("onboardingAuth").hidden'),false);
  await click('authSwitch'); await input('passwordInput','wrong'); await click('authSubmit');
  await until('document.getElementById("authMessage").textContent.includes("incorrect")');
  await input('passwordInput','password-fixture'); await click('authSubmit');
  await until('!document.getElementById("onboardingSetup").hidden'); await input('pseudoInput','Mattea');
  await ev('document.querySelector("[data-avatar=riviere]").click()'); await click('saveProfileButton');
  await until('document.getElementById("onboarding").hidden');
  assert.equal(await ev('document.getElementById("sessionBadge").textContent'),'Profil connecté');
  await click('tab-profile'); await click('profileSettings-identity'); await importPhoto(); await until('!!document.querySelector("#tab-profile img")');
  assert.ok(storedProfile.photo_path.startsWith(user.id+'/'));
  await click('tab-route'); await ev('document.querySelector(".sheet-positions [data-position=list]").click()'); await click('routeStartButton'); await ev('document.querySelector("#pointList button").click()');
  await until('!document.getElementById("poiModal").hidden'); await click('closePointButton'); await click('backToApp'); await click('tab-home');
  await click('tab-profile'); await click('profileSettingsBack'); await click('profileSettings-account'); await click('logoutButton'); await until('!document.getElementById("onboardingWelcome").hidden');
  await click('signinButton'); await input('emailInput','lisandra@example.com'); await input('passwordInput','password-fixture'); await click('authSubmit');
  await until('document.getElementById("onboarding").hidden');
  assert.match(await ev('document.getElementById("greeting").textContent'),/Mattea/);
  assert.ok(await ev('!!document.querySelector("#tab-profile img")'));
  assert.match(await ev('document.getElementById("resumeDescription").textContent'),/1 repère/);
  assert.ok(calls.includes('/auth/v1/signup') && calls.includes('/rest/v1/memoria_progress'));
  await click('tab-profile'); await click('profileSettings-identity'); await ev('document.querySelector("[data-avatar=montagne]").click()'); await until('!document.querySelector("#tab-profile img")');
  await until('!document.getElementById("saveProfileButton").disabled');
  assert.equal(storedProfile.avatar,'montagne'); assert.equal(storedProfile.photo_path,null);
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert.equal(await ev('getComputedStyle(document.getElementById("appView")).scrollBehavior'),'auto');
  assert.equal(await ev('getComputedStyle(document.querySelector(".nav-active-pill")).transitionDuration'),'0s');
  await ev('document.getElementById("tab-profile").focus()');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft'});
  assert.equal(await ev('document.getElementById("tab-listen").getAttribute("aria-current")'),'page');
  assert.equal(await ev('document.getElementById("page-listen").getAnimations().length'),0);
  await ev('document.getElementById("tab-listen").focus()');
  assert.notEqual(await ev('getComputedStyle(document.getElementById("tab-listen")).outlineStyle'),'none');
  await nav();
  assert.equal(await ev('document.getElementById("content").inert'),false);
  assert.equal(await ev('document.querySelector(".intro-emblem").getAnimations().length'),0);
  await ev('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  assert.equal(await ev('document.getAnimations().filter(a=>["memoria-reveal","memoria-settings"].includes(a.id)).length'),0);
  // These checks emulate platform selection; native viewers still need real phones.
  await send('Network.setUserAgentOverride',{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',platform:'iPhone'});
  failNative=true;await nav();await click('heroAction');if(await ev('!document.getElementById("poiModal").hidden'))await click('closePointButton');
  await until('!document.getElementById("retrySystemAR").hidden');
  assert.equal(await ev('document.getElementById("systemARLink").hidden'),true);
  failNative=false;await click('retrySystemAR');
  await until('!document.getElementById("systemARLink").hidden');
  assert.equal(await ev('document.getElementById("systemARLink").rel'),'ar');
  assert.equal(await ev('document.getElementById("systemARLink").children.length'),1);
  assert.equal(await ev('document.getElementById("systemARLink").firstElementChild.tagName'),'IMG');
  assert.equal(await ev('fetch(document.getElementById("systemARLink").href).then(r=>r.headers.get("content-type"))'),'model/vnd.usdz+zip');
  await ev('document.getElementById("systemARLink").scrollIntoView({block:"center",behavior:"instant"})');await shot('native-apple-mobile');
  await ev('document.getElementById("systemARLink").addEventListener("click",e=>{e.preventDefault();window.nativeLaunchObserved=true;})');
  await click('systemARLink');assert.equal(await ev('window.nativeLaunchObserved'),true);
  await send('Network.setUserAgentOverride',{userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Firefox/140.0 Mobile',platform:'Linux armv8l'});
  await nav();await click('heroAction');if(await ev('!document.getElementById("poiModal").hidden'))await click('closePointButton');await until('!document.getElementById("systemARLink").hidden');
  const androidLink=await ev('document.getElementById("systemARLink").href');
  assert.match(androidLink,/^intent:\/\//);assert.match(androidLink,/mode=ar_preferred/);
  assert.ok(androidLink.includes(encodeURIComponent('/B3MAR56-TD3/#etape/iut?vue=360')));
  await ev('document.getElementById("systemARLink").scrollIntoView({block:"center",behavior:"instant"})');await shot('native-android-mobile');
  await click('backToApp');await click('tab-explore');
  await ev('document.querySelector("#explorePlaces [data-place=iut] .map-link").id="testMapAction"');
  await ev('document.getElementById("testMapAction").scrollIntoView({block:"center",behavior:"instant"})');await shot('map-action-mobile');
  await click('testMapAction');await until('document.getElementById("mapPlaceTitle").textContent==="IUT de Corse"');
  assert.equal(await ev('document.querySelectorAll(".leaflet-place-icon").length'),2);

  assert.equal(errors.length,0,JSON.stringify(errors));
  console.log('PASS: five destinations, history/deep links under GitHub Pages path, audio continuity, real Leaflet map, IGN response parsing, GPS following with simulated positions, routing errors/cancellation, profiles/auth fixture, AR preparation/360, responsive screenshots and reduced motion.');
} catch (error) {
  if (ev) console.error('Failure diagnostic',await ev('({crop:window.__cropTrace,errors:document.getElementById("cropMessage")?.textContent,focus:document.activeElement?.id,scale:visualViewport.scale,root:document.getElementById("cropModal")?.parentElement.id})'));
  if (send) { const shot = await send('Page.captureScreenshot',{format:'png'}); const file = path.join(profileDir,'failure.png'); fs.writeFileSync(file,Buffer.from(shot.data,'base64')); console.error('Failure screenshot: '+file); }
  throw error;
} finally { socket?.close(); chrome.kill(); server.close(); }
