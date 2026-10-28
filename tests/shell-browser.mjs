// Real Chrome UI and HTTP requests. Supabase responses are test fixtures;
// no real user account is created and no remote deployment is modified.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const root = process.cwd(); let withAuth = false, storedProfile = null, storedProgress = null, user = null;
const users = new Map(), photos = new Map(), calls = [];
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost'); res.setHeader('Cache-Control', 'no-store');
  const json = (data, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
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
  if (url.pathname === '/memoria/config.js' && withAuth) { res.writeHead(200, { 'Content-Type': 'text/javascript' }); res.end(`export const ACCOUNT_CONFIG={supabaseUrl:'http://127.0.0.1:${server.address().port}',publishableKey:'public-ui-fixture'};`); return; }
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
    await ev(`document.getElementById(${JSON.stringify(id)}).scrollIntoView({block:'center',behavior:'instant'})`);
    await ev('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
    const point = await ev(`(()=>{const node=document.getElementById(${JSON.stringify(id)});if(node.disabled||!node.getClientRects().length)throw Error('Unavailable '+node.id);const r=node.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]}); await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await ev('new Promise(r=>setTimeout(r,70))');
  };
  const shot = async name => { const result = await send('Page.captureScreenshot',{format:'png'}); const file = path.join(profileDir,name+'.png'); fs.writeFileSync(file,Buffer.from(result.data,'base64')); console.log('Screenshot: '+file); };
  let firstNavigation = true;
  const nav = async () => { const loaded = new Promise(resolve => { onLoad = resolve; }); await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/?run=${Date.now()}`}); await loaded; await until('!!document.getElementById("guestButton")');
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
  await click('tab-profile'); await shot('profile-mobile');
  await ev('document.querySelector("[data-avatar=initiales]").click()'); await until('!document.getElementById("saveProfileButton").disabled');
  assert.equal(await ev('document.querySelector("#tab-profile .avatar").textContent'),'L');
  await input('pseudoInput','Lisandra Corti'); await click('saveProfileButton');
  await until('document.getElementById("profileMessage").textContent.includes("enregistré")');
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
    await shot('photo-crop'); await click('confirmCrop'); await until('document.getElementById("cropModal").hidden'); await until('!document.getElementById("saveProfileButton").disabled');
  }
  await ev('window.createImageBitmap=undefined'); // Also exercise the decoder used on older phones.
  await importPhoto();
  await until('!!document.querySelector("#tab-profile img")');
  assert.equal(await ev('document.querySelector("#tab-profile img").src'),await ev('document.querySelector("#headerProfile img").src'));
  { const loaded = new Promise(resolve => { onLoad = resolve; }); await send('Page.reload'); await loaded; } await until('document.getElementById("onboarding")?.hidden && document.getElementById("appIntro").hidden');
  assert.match(await ev('document.getElementById("greeting").textContent'),/Lisandra Corti/);
  assert.ok(await ev('!!document.querySelector("#tab-profile img")'));
  await click('tab-route');
  await until('document.querySelectorAll(".map-roads path").length>100');
  assert.ok(await ev('!!document.querySelector(".map-route-line")'));
  const originalMap=await ev('document.querySelector(".city-map-svg").getAttribute("viewBox")');
  await click('map-in');assert.notEqual(await ev('document.querySelector(".city-map-svg").getAttribute("viewBox")'),originalMap);
  await click('map-reset');
  const mapPoint=await ev('(()=>{const r=document.querySelector(".city-map-frame").getBoundingClientRect();return {x:r.x+r.width*.5,y:r.y+r.height*.6};})()');
  await drag(mapPoint,{x:mapPoint.x+42,y:mapPoint.y+25});
  assert.equal(await ev('document.getElementById("tab-route").getAttribute("aria-current")'),'page');
  assert.notEqual(await ev('document.querySelector(".city-map-svg").getAttribute("viewBox")'),originalMap);
  await click('map-reset');await click('map-stop-palazzu');
  assert.match(await ev('document.querySelector(".map-stop-status").textContent'),/À venir/);
  await shot('city-map-mobile');
  await click('map-stop-iut');assert.match(await ev('document.querySelector(".map-stop-status").textContent'),/Disponible/);
  await click('routeStartButton');
  await shot('step-mobile');
  assert.equal(await ev('new Set([...document.querySelectorAll("#pointList .point-card-visual")].map(image=>image.getAttribute("src"))).size'),5);
  assert.equal(await ev('!!document.querySelector("#homeView .hero")'),false);
  assert.equal(await ev('!!document.querySelector("#homeView .step-cover img")'),true);
  await ev('document.querySelector("#pointList button").click()'); await until('!document.getElementById("poiModal").hidden');
  await shot('point-mobile');
  await click('closePointButton'); await click('backToApp');
  await until('!document.getElementById("resumeCard").hidden'); assert.match(await ev('document.getElementById("resumeDescription").textContent'),/1 repère/);
  await click('resumeButton'); assert.match(await ev('document.getElementById("pointTitle").textContent'),/IUT/); await click('closePointButton'); await click('backToApp');
  await click('tab-listen'); await ev('document.querySelector("#listenStories button").click()');
  await until('!document.getElementById("storiesModal").hidden'); await shot('stories-mobile'); await click('closeStoriesButton');
  await click('tab-route'); await click('routeStartButton');
  if(!await ev('document.getElementById("poiModal").hidden'))await click('closePointButton');
  await click('openPanoramaButton'); await until('!document.getElementById("panoramaPanel").hidden'); await shot('panorama-mobile');
  await ev('document.getElementById("panoramaPanel").scrollTop=1000');
  await ev('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  assert.equal(await ev('getComputedStyle(document.querySelector("#panoramaPanel > header")).position'),'static');
  assert.ok(await ev('document.querySelector("#panoramaPanel > header").getBoundingClientRect().bottom<0'));
  assert.ok(await ev('(()=>{const r=document.getElementById("closePanoramaButton").getBoundingClientRect();return r.top>=0&&r.bottom<innerHeight&&r.width>=44&&r.height>=44;})()'));
  await shot('panorama-scrolled');
  await click('closePanoramaButton'); await click('backToApp');
  for (const [width,height] of [[320,740],[768,1024],[1440,1000]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<1000});
    await ev('document.getElementById("appView").scrollTop=0');
    assert.equal(await ev('document.getElementById("appView").scrollWidth>innerWidth'),false);
    assert.ok(await ev('[...document.querySelectorAll("#appDock button")].every(b=>{const r=b.getBoundingClientRect();return r.width>=44&&r.height>=44&&r.left>=0&&r.right<=innerWidth;})'));
    await shot('home-'+width);
  }
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
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
  await click('tab-profile'); await importPhoto(); await until('!!document.querySelector("#tab-profile img")');
  assert.ok(storedProfile.photo_path.startsWith(user.id+'/'));
  await click('tab-route'); await click('routeStartButton'); await ev('document.querySelector("#pointList button").click()');
  await until('!document.getElementById("poiModal").hidden'); await click('closePointButton'); await click('backToApp');
  await click('tab-profile'); await click('logoutButton'); await until('!document.getElementById("onboardingWelcome").hidden');
  await click('signinButton'); await input('emailInput','lisandra@example.com'); await input('passwordInput','password-fixture'); await click('authSubmit');
  await until('document.getElementById("onboarding").hidden');
  assert.match(await ev('document.getElementById("greeting").textContent'),/Mattea/);
  assert.ok(await ev('!!document.querySelector("#tab-profile img")'));
  assert.match(await ev('document.getElementById("resumeDescription").textContent'),/1 repère/);
  assert.ok(calls.includes('/auth/v1/signup') && calls.includes('/rest/v1/memoria_progress'));
  await click('tab-profile'); await ev('document.querySelector("[data-avatar=montagne]").click()'); await until('!document.querySelector("#tab-profile img")');
  await until('!document.getElementById("saveProfileButton").disabled');
  assert.equal(storedProfile.avatar,'montagne'); assert.equal(storedProfile.photo_path,null);
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert.equal(await ev('getComputedStyle(document.getElementById("appView")).scrollBehavior'),'auto');
  assert.equal(await ev('getComputedStyle(document.querySelector(".nav-active-pill")).transitionDuration'),'0s');
  await ev('document.getElementById("tab-profile").focus()');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft'});
  assert.equal(await ev('document.getElementById("tab-listen").getAttribute("aria-current")'),'page');
  assert.equal(await ev('document.getElementById("page-listen").getAnimations().length'),0);
  await nav();
  assert.equal(await ev('document.getElementById("content").inert'),false);
  assert.equal(await ev('document.querySelector(".intro-emblem").getAnimations().length'),0);
  assert.equal(errors.length,0,JSON.stringify(errors));
  console.log('PASS: onboarding, explicit guest mode, validation, seven avatars, crop/import, reactive nav image, persistence/reload, resume, responsive layouts, real HTTP auth/profile/storage/progress against a Supabase fixture.');
} catch (error) {
  if (send) { const shot = await send('Page.captureScreenshot',{format:'png'}); const file = path.join(profileDir,'failure.png'); fs.writeFileSync(file,Buffer.from(shot.data,'base64')); console.error('Failure screenshot: '+file); }
  throw error;
} finally { socket?.close(); chrome.kill(); server.close(); }
