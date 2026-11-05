export function nativeARMode({ userAgent='', platform='', maxTouchPoints=0, quickLook=false, secure=true }={}) {
  if (!secure) return null;
  const apple=/iPhone|iPad|iPod/.test(userAgent) || platform==='MacIntel'&&maxTouchPoints>1;
  if ((quickLook||apple) && !/GSA\//.test(userAgent)) return 'quick-look';
  return /Android/i.test(userAgent) ? 'scene-viewer' : null;
}
export function nativeModelURLs(baseURI) {
  const back=new URL(baseURI);back.search='';back.hash='etape/iut?vue=360';
  return {
    usdz:new URL('assets/ar/iut-scene-v1.usdz',baseURI).href,
    glb:new URL('assets/ar/iut-scene-v1.glb',baseURI).href,
    poster:new URL('assets/ar/iut-scene-preview.webp',baseURI).href,
    back:back.href
  };
}
export function sceneViewerURL(model, back) {
  const url=new URL('https://arvr.google.com/scene-viewer/1.0');
  url.searchParams.set('file',model);url.searchParams.set('mode','ar_preferred');
  url.searchParams.set('title','Memoria Corti · IUT de Corse');url.searchParams.set('link',back);
  return 'intent://'+url.host+url.pathname+url.search+'#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;S.browser_fallback_url='+encodeURIComponent(back)+';end;';
}
