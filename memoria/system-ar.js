import {nativeARMode,nativeModelURLs,sceneViewerURL} from './ar-platform.js?v=33';

export function createSystemARAccess({onChange=()=>{},onLaunch=()=>{},onReturn=()=>{}}={}) {
  const probe=document.createElement('a');
  let quickLook=false;try{quickLook=probe.relList.supports('ar');}catch{}
  const mode=nativeARMode({userAgent:navigator.userAgent,platform:navigator.platform,maxTouchPoints:navigator.maxTouchPoints,quickLook,secure:window.isSecureContext});
  const urls=nativeModelURLs(document.baseURI),button=document.getElementById('startARButton');
  const link=document.createElement('a');link.id='systemARLink';link.className='system-ar-link primary-link';link.hidden=true;
  // Safari requires exactly one image/picture child inside a rel=ar link.
  const image=document.createElement('img');image.src=urls.poster;image.alt='';image.width=40;image.height=40;link.append(image);
  const label=mode==='quick-look'?'Ouvrir l’AR Apple':'Ouvrir l’AR / 3D Android';
  link.dataset.label=label;link.setAttribute('aria-label',label);
  if(mode==='quick-look')link.rel='ar';else if(mode==='scene-viewer')link.href=sceneViewerURL(urls.glb,urls.back);
  button.before(link);
  const retry=document.createElement('button');retry.id='retrySystemAR';retry.type='button';retry.textContent='Réessayer le chargement AR';retry.hidden=true;link.after(retry);
  const note=document.createElement('p');note.id='systemARNote';note.className='small-note';note.hidden=true;
  document.getElementById('arAvailability').after(note);
  let ready=false,pending=null,blobURL=null,launched=false;
  function notify(message,error=false) {
    note.hidden=!mode;note.textContent=mode==='quick-look'
      ? 'Le téléphone gère le placement. Retrouvez les récits et les transcriptions en revenant ici. Si votre navigateur ne lance pas l’AR, ouvrez cette page dans Safari.'
      : 'Le téléphone gère le placement. Retrouvez les récits et les transcriptions en revenant ici. Sans AR compatible, la visionneuse Android propose la 3D.';
    retry.hidden=!error;
    onChange({mode,ready,link,message});
  }
  function prepare() {
    if(!mode){const apple=/iPhone|iPad|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;onChange(apple?{mode:null,ready:false,link,message:'Pour le placement AR sur cet appareil Apple, ouvrez cette page dans Safari. Les récits et la vue 360° restent accessibles ici.'}:null);return Promise.resolve();}
    if(ready){notify(mode==='quick-look'?'Scène prête pour la visionneuse AR Apple.':'Scène prête · le téléphone proposera l’AR selon sa compatibilité.');return Promise.resolve();}
    if(pending)return pending;
    if(mode==='scene-viewer'){ready=true;notify('Ouvrez la visionneuse Android : AR si l’appareil est compatible, sinon 3D.');return Promise.resolve();}
    notify('Préparation du modèle pour l’AR Apple…');
    pending=(async()=>{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
      try{
        const response=await fetch(urls.usdz,{signal:controller.signal,credentials:'omit'});
        if(!response.ok)throw Error('Modèle AR indisponible.');
        const data=await response.arrayBuffer(),bytes=new Uint8Array(data);
        if(bytes.length<30||bytes[0]!==80||bytes[1]!==75)throw Error('Modèle AR invalide.');
        // Preserve the registered USDZ MIME type even on static hosts.
        blobURL=URL.createObjectURL(new Blob([data],{type:'model/vnd.usdz+zip'}));
        link.href=blobURL;ready=true;notify('Scène prête pour la visionneuse AR Apple.');
      }catch{ready=false;notify('Le modèle AR n’a pas pu être chargé. Réessayez ou consultez la vue 360°.',true);}
      finally{clearTimeout(timer);pending=null;}
    })();
    return pending;
  }
  retry.addEventListener('click',prepare);
  link.addEventListener('click',event=>{if(!ready){event.preventDefault();return;}launched=true;onLaunch();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&launched){launched=false;onReturn();}});
  return {prepare,get ready(){return ready;},get mode(){return mode;},launch(){if(ready)link.click();}};
}
