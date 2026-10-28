// Card illustrations are distinct from documentary archive assets in iut.js.
// Existing photographs retain their visible attribution in each card.
import { CORTE_PHOTOS } from './corte.js';
const photo = id => CORTE_PHOTOS.find(item => item.id === id);
export const POINT_VISUALS = {
  iut: { src: 'assets/campus-illustration.svg', alt: 'Évocation d’un campus contemporain : étudiants, bâtiments et montagnes', label: 'Illustration · Vie de campus' },
  naissance: { src: 'assets/savoir-illustration.svg', alt: 'Un livre ouvert et un document évoquent la fondation et la transmission du savoir', label: 'Illustration · Transmission' },
  paoli: { ...photo('paoli'), label: 'Photographie · Statue à Corte' },
  reouverture: { src: 'assets/archives-1981-illustration.svg', alt: 'Dossiers et boîte d’archives illustrés autour de la date de 1981', label: 'Illustration · Réouverture de 1981' },
  corte: { ...photo('citadelle'), label: 'Photographie · Corte aujourd’hui' }
};
