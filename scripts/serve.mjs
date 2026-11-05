import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),port=Number(process.env.PORT||8080),prefix='/B3MAR56-TD3';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp','.png':'image/png','.mp3':'audio/mpeg','.glb':'model/gltf-binary'};
const server=http.createServer((req,res)=>{
 try{let name=new URL(req.url,'http://localhost').pathname;if(name===prefix){res.writeHead(302,{Location:prefix+'/'});res.end();return;}if(name.startsWith(prefix+'/'))name=name.slice(prefix.length);
 const file=path.resolve(root,'.'+decodeURIComponent(name==='/'?'/index.html':name));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 const data=fs.readFileSync(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
 }catch{res.writeHead(404);res.end('Ressource introuvable');}
});
server.listen(port,'127.0.0.1',()=>console.log('Memoria Corti : http://127.0.0.1:'+port+prefix+'/#accueil'));
