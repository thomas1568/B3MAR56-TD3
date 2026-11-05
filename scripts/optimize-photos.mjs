// Resize/encode the documented originals only. No generated or substituted imagery.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawn} from 'node:child_process';
const root=process.cwd(),folder=fs.mkdtempSync(path.join(os.tmpdir(),'memoria-images-'));
const chrome=spawn(process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+folder,'about:blank'],{windowsHide:true,stdio:'ignore'});
let socket;try {
 for(let i=0;i<100&&!fs.existsSync(path.join(folder,'DevToolsActivePort'));i++)await new Promise(r=>setTimeout(r,100));
 const port=fs.readFileSync(path.join(folder,'DevToolsActivePort'),'utf8').split('\n')[0],targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
 socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));
 let n=0;const waiting=new Map();socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const q=waiting.get(m.id);waiting.delete(m.id);m.error?q.reject(m.error):q.resolve(m.result);}});
 const send=(method,params)=>new Promise((resolve,reject)=>{const id=++n;waiting.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 const variants=[];
 for(const {name,extension='jpg',widths=[320,768,1280]} of [...['corte-citadelle','corte-palazzu','corte-paoli','corte-restonica'].map(name=>({name})),{name:'iut-corte',extension:'png',widths:[320,415]}]) {
  const file=path.join(root,'assets/photos',name+'.'+extension),source='data:image/'+(extension==='jpg'?'jpeg':extension)+';base64,'+fs.readFileSync(file).toString('base64');
  for(const width of widths){
   const expression=`new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=${width};canvas.height=Math.round(image.height*${width}/image.width);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);resolve({data:canvas.toDataURL('image/webp',.8),width:canvas.width,height:canvas.height});};image.onerror=reject;image.src=${JSON.stringify(source)};})`;
   const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
   const value=result.result.value;if(!value.data.startsWith('data:image/webp;'))throw Error('WebP unavailable');
   const output='assets/photos/'+name+'-'+width+'.webp',bytes=Buffer.from(value.data.split(',')[1],'base64');fs.writeFileSync(path.join(root,output),bytes);
   variants.push({source:'assets/photos/'+name+'.'+extension,file:output,width:value.width,height:value.height,bytes:bytes.length});console.log(output+' · '+Math.round(bytes.length/1024)+' Ko');
  }
 }
 fs.writeFileSync(path.join(root,'assets/photos/variants.json'),JSON.stringify({method:'Redimensionnement proportionnel et compression WebP, qualité 0,8. Contenu photographique inchangé. Droits : credits.json et README.md (photo IUT fournie pour le projet).',variants},null,2)+'\n');
}finally{socket?.close();chrome.kill();}
