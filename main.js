import { IUT_STEP } from './content/iut.js?v=32';
import { createExperience } from './memoria/experience.js?v=32';
import { createShell } from './memoria/shell.js?v=32';

// Three.js and the XR engine are fetched when the visitor opens an experience.
let runtime=null, pending=null;
function prepareAR() {
  if(runtime)return Promise.resolve(runtime);
  if(pending)return pending;
  experience.setAvailability(false,'Préparation de l’AR… Les fiches restent accessibles.');
  pending=import('./memoria/ar-runtime.js?v=32').then(module=>runtime=module.initializeAR(experience)).catch(error=>{
    pending=null;experience.setAvailability(false,'AR indisponible. Les fiches et la vue 360° restent accessibles.');
    console.error('Chargement de l’AR',error);
    return null;
  });
  return pending;
}
const experience=createExperience(IUT_STEP,{
  startAR(){if(runtime)runtime.startAR();else{prepareAR();experience.showMessage('L’AR se prépare. Utilisez le bouton lorsqu’il sera disponible.');}},
  exit(){return runtime?runtime.exitExperience():experience.leave();},
  setMode(mode){runtime?runtime.setExperienceMode(mode):experience.setMode(mode);},
  placeScene(){runtime?.placeMemoriaScene();},
  saveLayout(){runtime?.saveMemoriaLayout();},resetLayout(){runtime?.resetMemoriaLayout();},
  onPointAction(id){runtime?runtime.onPointAction(id):experience.openPoint(id);},
  viewInAR(id){if(runtime)runtime.viewPointInAR(id);else{prepareAR();experience.showMessage('L’AR se prépare. Réessayez lorsque le bouton est disponible.');}},
  onCardOpen(){runtime?.stopDrag();}
});
createShell(experience,IUT_STEP);
experience.setAvailability(false,'Ouvrez une étape pour vérifier la disponibilité de l’AR.');
document.addEventListener('memoria:prepare',prepareAR);
