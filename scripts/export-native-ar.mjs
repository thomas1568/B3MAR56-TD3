// Build static native AR assets from the same documented procedural scene.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import http from 'node:http';import {spawn} from 'node:child_process';
const root=process.cwd(),types={'.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname;
 if(name==='/export.html'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<script type="importmap">{"imports":{"three":"/build/three.module.js"}}</script>');return;}
 const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 try{const bytes=fs.readFileSync(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(bytes);}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'memoria-native-export-'));
const chrome=spawn(process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--no-default-browser-check','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
let socket;
try{
 for(let i=0;i<100&&!fs.existsSync(path.join(profile,'DevToolsActivePort'));i++)await new Promise(r=>setTimeout(r,100));
 const port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0],targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));
 let id=0;const pending=new Map();
 socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method,params}));});
 await send('Page.enable');await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/export.html'});
 await new Promise(r=>setTimeout(r,150));
 const expression=String.raw`(async()=>{
 const THREE=await import('three');
 const {createMemoriaScene}=await import('./memoria/scene.js?v=33');
 const {IUT_STEP}=await import('./content/iut.js?v=33');
 const {GLTFExporter}=await import('./vendor/three-r180/exporters/GLTFExporter.js');
 const {USDZExporter}=await import('./vendor/three-r180/exporters/USDZExporter.js');
 const memoria=createMemoriaScene(IUT_STEP),root=memoria.root;root.visible=true;root.name='Memoria Corti - IUT - evocation';
 root.updateMatrixWorld(true);
 const labels=[];root.traverse(node=>{if(node.isSprite)labels.push(node);});
 for(const sprite of labels){
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshStandardMaterial({map:sprite.material.map,color:sprite.material.color,side:THREE.DoubleSide,roughness:1}));
  sprite.getWorldPosition(plane.position);sprite.getWorldScale(plane.scale);plane.scale.z=1;plane.name='Label_'+plane.id;
  sprite.removeFromParent();root.add(plane);
 }
 let bounds=new THREE.Box3().setFromObject(root);root.position.y-=bounds.min.y;root.updateMatrixWorld(true);
 bounds=new THREE.Box3().setFromObject(root);const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 const scene=new THREE.Scene();scene.add(root);scene.userData={description:'Evocation culturelle, sans reconstitution historique',points:IUT_STEP.points.map(p=>p.id)};
 const glb=await new GLTFExporter().parseAsync(scene,{binary:true,onlyVisible:true,maxTextureSize:1024});
 const usdz=await new USDZExporter().parseAsync(scene,{quickLookCompatible:true,includeAnchoringProperties:true});
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(320,320);renderer.setPixelRatio(1);
 scene.background=new THREE.Color('#F4F0E8');scene.add(new THREE.HemisphereLight(0xffffff,0x697866,3));
 const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(2,4,3);scene.add(light);
 const camera=new THREE.PerspectiveCamera(40,1,.01,30),distance=Math.max(size.x,size.y,size.z)*2.1;
 camera.position.copy(center).add(new THREE.Vector3(.65,.45,1).normalize().multiplyScalar(distance));camera.lookAt(center);
 renderer.render(scene,camera);
 const bytesToBase64=value=>{const bytes=new Uint8Array(value),parts=[];for(let i=0;i<bytes.length;i+=32768)parts.push(String.fromCharCode(...bytes.subarray(i,i+32768)));return btoa(parts.join(''));};
 return {glb:bytesToBase64(glb),usdz:bytesToBase64(usdz),poster:renderer.domElement.toDataURL('image/webp',.85).split(',')[1],points:IUT_STEP.points.map(p=>p.id),size:size.toArray(),meshes:scene.children[0].getObjectsByProperty('isMesh',true).length};
})()`;
 const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
 if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||JSON.stringify(result.exceptionDetails));
 const assets=result.result.value,dir=path.join(root,'assets/ar');fs.mkdirSync(dir,{recursive:true});
 for(const [key,name]of[['glb','iut-scene-v1.glb'],['usdz','iut-scene-v1.usdz'],['poster','iut-scene-preview.webp']]){
  const bytes=Buffer.from(assets[key],'base64');fs.writeFileSync(path.join(dir,name),bytes);console.log(name+': '+bytes.length+' bytes');
 }
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({generator:'Three.js r180 GLTFExporter/USDZExporter; scripts/export-native-ar.mjs',kind:'evocation',units:'meter',points:assets.points,size:assets.size,meshes:assets.meshes},null,2)+'\n');
 console.log('Exported points: '+assets.points.join(', '));await send('Browser.close');
}finally{socket?.close();chrome.kill();server.close();}
