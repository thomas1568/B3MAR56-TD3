// Upgrade regression: retain an actual legacy module in Chrome's HTTP cache.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';

const root=process.cwd(),prefix='/B3MAR56-TD3',expectBroken=process.argv.includes('--expect-broken');
const legacy=fs.readFileSync(new URL('./fixtures/legacy-corte-v22.js',import.meta.url));
let legacyRequests=0,failMain=false;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname===prefix+'/prime.html'){
  res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});
  res.end('<script type="module">import * as old from "./content/corte.js";localStorage.setItem("memoria:guest:v1",JSON.stringify({pseudo:"Visiteur",avatar:"montagne",progress:{started:true,visited:["paoli"],lastPoint:"paoli"}}));window.primed=Object.keys(old);</script>');return;
 }
 if(!url.pathname.startsWith(prefix+'/')){res.writeHead(404);res.end();return;}
 const name=url.pathname.slice(prefix.length);
 if(name==='/content/corte.js'&&!url.search){
  legacyRequests++;res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'public,max-age=3600','ETag':'"legacy-v22"'});res.end(legacy);return;
 }
 if(name==='/main.js'&&failMain){res.writeHead(503,{'Content-Type':'text/javascript','Cache-Control':'no-store'});res.end();return;}
 const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 try{res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg'})[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(fs.readFileSync(file));}
 catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'memoria-upgrade-'));
const chrome=spawn(process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
let socket,send,ev;
const deadline=setTimeout(()=>{console.error('Upgrade test timeout');socket?.close();chrome.kill();server.close();process.exitCode=1;},60000);
try{
 for(let i=0;i<100&&!fs.existsSync(path.join(profile,'DevToolsActivePort'));i++)await new Promise(r=>setTimeout(r,100));
 const port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];
 const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));
 let id=0;const pending=new Map(),errors=[];
 socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);});
 send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params}));});
 ev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const until=async expression=>{for(let i=0;i<160;i++){if(await ev(expression))return;await new Promise(r=>setTimeout(r,50));}throw Error('Timeout: '+expression);};
 const shot=async name=>{const result=await send('Page.captureScreenshot',{format:'png'}),dir=path.join(root,'artifacts','refonte');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,name+'.png'),Buffer.from(result.data,'base64'));};
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 const base='http://127.0.0.1:'+server.address().port+prefix+'/';
 await send('Page.navigate',{url:base+'prime.html'});await until('Array.isArray(window.primed)');
 assert.equal(await ev('window.primed.includes("photoVariants")'),false);
 assert.equal(legacyRequests,1);
 await send('Page.navigate',{url:base});await until('document.getElementById("appIntro")?.hidden');
 if(expectBroken){
  assert.ok(errors.some(e=>e.includes('photoVariants')),JSON.stringify(errors));
  assert.equal(await ev('!!document.getElementById("appView")'),false);
  assert.equal(legacyRequests,1,'The legacy module was reused from the HTTP cache');
  await shot('startup-before');console.log('REPRODUCED: cached v22 Corte module prevents v30 startup; blank screen after intro.');console.log(errors);
 }else{
  await until('document.getElementById("onboarding")?.hidden && !!document.getElementById("appView")');
  assert.equal(await ev('document.getElementById("startupFallback").hidden'),true);
  assert.equal(await ev('document.getElementById("appView").inert'),false);
  assert.match(await ev('document.getElementById("greeting").textContent'),/Visiteur/);
  assert.match(await ev('document.getElementById("resumeDescription").textContent'),/1 rep/);
  assert.equal(await ev('location.search'),'');
  assert.equal(legacyRequests,1);
  assert.equal(errors.length,0,JSON.stringify(errors));
  await shot('startup-after');
  failMain=true;await send('Page.reload');
  await until('document.getElementById("startupFallback")?.getAttribute("role")==="alert"');
  assert.equal(await ev('document.getElementById("startupFallback").hidden'),false);
  assert.equal(await ev('document.getElementById("content").hidden'),true);
  assert.equal(await ev('document.getElementById("appIntro").hidden'),true);
  await shot('startup-recovery');
  failMain=false;await ev('document.getElementById("startupRetry").click()');
  await until('document.getElementById("onboarding")?.hidden && !document.getElementById("content").hidden');
  assert.equal(await ev('location.search'),'');
  assert.match(await ev('document.getElementById("greeting").textContent'),/Visiteur/);
  assert.equal(errors.length,0,JSON.stringify(errors));
  console.log('PASS: legacy HTTP cache upgrade on the normal URL, saved guest profile/progress, visible module failure and retry without URL parameters.');
 }
}catch(error){if(send){const s=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(profile,'failure.png'),Buffer.from(s.data,'base64'));console.error('Failure:',path.join(profile,'failure.png'));}throw error;}
finally{clearTimeout(deadline);socket?.close();chrome.kill();server.close();}
