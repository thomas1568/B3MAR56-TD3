let pending;
export function loadLeaflet() {
  if(pending)return pending;
  const styles=new Promise((resolve,reject)=>{
    let link=document.getElementById('leafletStyles');
    if(link?.sheet){resolve();return;}
    if(!link){link=document.createElement('link');link.id='leafletStyles';link.rel='stylesheet';link.href=new URL('../vendor/leaflet/leaflet.css',import.meta.url).href;document.head.append(link);}
    link.addEventListener('load',resolve,{once:true});
    link.addEventListener('error',()=>{link.remove();reject(Error('La présentation de la carte ne peut pas se charger. Les lieux restent accessibles dans la liste.'));},{once:true});
  });
  const script=globalThis.L?Promise.resolve(globalThis.L):new Promise((resolve,reject)=>{
    const node=document.createElement('script');node.src=new URL('../vendor/leaflet/leaflet.js',import.meta.url).href;node.async=true;
    node.onload=()=>resolve(globalThis.L);node.onerror=()=>{node.remove();reject(Error('Le moteur de carte ne peut pas se charger. Les lieux restent accessibles dans la liste.'));};
    document.head.append(node);
  });
  pending=Promise.all([styles,script]).then(([,L])=>L).catch(error=>{pending=null;throw error;});
  return pending;
}
