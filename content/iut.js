// Historical content is independent from the renderer. No remote media is loaded
// until a file and explicit reuse permission are supplied.
const sources = {
  iut: { title: 'IUT de Corse', url: 'https://iut.universita.corsica/', checked: '2026-10-05' },
  history: { title: 'Historique de l’Université de Corse', url: 'https://www.universita.corsica/fr/universita/historique/', checked: '2026-10-05' },
  university: { title: 'Présentation de l’Université', url: 'https://www.universita.corsica/fr/universita/presentation/', checked: '2026-10-05' },
  m3c: { title: 'Médiathèque culturelle de la Corse et des Corses', url: 'https://www.universita.corsica/fr/recherche/mediatheque-culturelle-de-corse-corses-m3c/', checked: '2026-10-05' },
  museum: { title: 'Collections iconographiques du Musée de la Corse', url: 'https://www.museudiacorsica.corsica/fr/arts-graphiques/', checked: '2026-10-05' }
};
const missingImage = (label, caption) => ({ src: null, label, caption, date: null, credit: null, rights: { status: 'a-verifier', label: 'Autorisation de réutilisation à fournir' } });
const missingAudio = { src: null, credit: null, rights: { status: 'a-verifier', label: 'Enregistrement et droits à fournir' } };
const point = (data) => ({ ...data, transcript: data.text, audio: { ...missingAudio }, status: 'documente', visualStatus: 'evocation', orientation: [0, 0, 0], model: { kind: data.id, src: null, status: 'evocation', credit: 'Formes originales du projet Memoria Corti' } });

export const IUT_STEP = {
  id: 'iut-grimaldi',
  title: 'Corte, une ville de savoir',
  subtitle: 'De Pasquale Paoli aux étudiants d’aujourd’hui',
  location: 'IUT de Corse · Campus Grimaldi · Corte',
  introduction: 'À l’IUT de Corse, trois dates racontent une même envie : apprendre et transmettre. Explorez une scène de savoir, des origines de l’université à la vie étudiante d’aujourd’hui.',
  instructions: 'Observez le lieu, touchez les cinq repères et écoutez les récits.',
  positioning: 'Placement manuel : alignez la scène avec le lieu. Un nouveau recalage est nécessaire à chaque session.',
  historicalNote: 'L’IUT actuel est situé sur le campus Grimaldi. L’université de 1765 ouvrait au Palazzu Naziunale. La scène est une évocation, pas une restitution du XVIIIe siècle sur le site de l’IUT.',
  dates: [
    { year: '1765', title: 'Naissance de l’université', poiId: 'naissance', source: sources.history },
    { year: '1981', title: 'Réouverture à Corte', poiId: 'reouverture', source: sources.university },
    { year: '1983', title: 'Création de l’IUT', poiId: 'iut', source: sources.iut }
  ],
  questions: ['Pourquoi créer une université ?', 'Pourquoi Corte ?', 'Comment cette histoire se poursuit-elle aujourd’hui ?'],
  narrations: {
    welcome: {
      id: 'accueil', title: 'Bienvenue à l’IUT', duration: '15–20 s',
      text: 'Bienvenue dans Memoria Corti. Ici, sur le campus Grimaldi, l’IUT ouvre notre visite de Corte. Prenez un instant pour observer le lieu. Touchez les repères pour découvrir trois dates, des objets d’évocation et une histoire de transmission, de Pasquale Paoli aux étudiants d’aujourd’hui.',
      audio: { ...missingAudio }
    },
    main: {
      id: 'recit', title: 'Trois dates, une histoire de savoir', duration: 'environ 1 min',
      text: 'Notre parcours commence devant l’IUT de Corse, sur le campus Grimaldi. Le lieu actuel nous invite à remonter le temps, sans confondre les bâtiments. En 1765, Pasquale Paoli fonde l’Université de Corse. Elle ouvre à Corte, au Palazzu Naziunale. Le livre et le document de notre scène évoquent cette transmission du savoir ; ils ne reproduisent pas une salle historique. Après une longue interruption, l’université rouvre à Corte en 1981. Deux ans plus tard, en 1983, l’IUT de Corse est créé. Aujourd’hui, ce campus accueille des formations qui relient apprentissage et pratique. Pourquoi créer une université ? Pourquoi choisir Corte ? Comment cette histoire continue-t-elle ? Ces questions accompagnent votre exploration. Touchez un repère, lisez les sources et observez à nouveau le lieu qui vous entoure. La suite du parcours nous conduira vers les lieux de l’université historique.',
      audio: { ...missingAudio }
    }
  },
  points: [
    point({ id: 'iut', shortTitle: 'L’IUT aujourd’hui', title: 'L’IUT aujourd’hui', date: '1983 → aujourd’hui', question: 'Comment cette histoire se poursuit-elle aujourd’hui ?',
      text: 'Créé en 1983, l’IUT de Corse est installé sur le campus Grimaldi, à Corte. Ses formations associent savoirs et pratique dans plusieurs domaines technologiques et professionnels. Le bâtiment actuel est notre point de départ, pas le lieu de l’université de 1765.',
      position: [-0.85, 0, 0.12], panorama: { yaw: -55, pitch: 0 }, image: missingImage('Photographie de l’IUT à fournir', 'Vue actuelle de l’IUT sur le campus Grimaldi'), sources: [sources.iut] }),
    point({ id: 'naissance', shortTitle: '1765 · Le livre', title: '1765 — La naissance de l’université', date: '1765', question: 'Pourquoi créer une université ?',
      text: 'L’Université de Corse ouvre le 3 janvier 1765, à Corte, au Palazzu Naziunale, sous l’impulsion de Pasquale Paoli. Le livre ouvert et le document de cette scène évoquent l’enseignement. Ce sont des formes symboliques, sans reproduction d’un ouvrage ou d’un manuscrit identifié.',
      position: [-0.28, 0.77, 0.08], panorama: { yaw: -25, pitch: 8 }, image: missingImage('Document historique à fournir', 'Archive liée à la fondation de l’université, à identifier'), sources: [sources.history, sources.m3c] }),
    point({ id: 'paoli', shortTitle: 'Pasquale Paoli', title: 'Pasquale Paoli', date: '1765', question: 'Pourquoi créer une université ?',
      text: 'Pasquale Paoli est à l’origine de la fondation de l’Université de Corse en 1765. Son nom reste associé à l’université actuelle. Un support de portrait marque ici son rôle : aucune ressemblance historique n’est fabriquée en l’absence d’une image identifiée et autorisée.',
      position: [0.58, 0, -0.18], panorama: { yaw: 5, pitch: 8 }, image: missingImage('Portrait de Pasquale Paoli à fournir', 'Portrait historique à choisir dans une collection et à documenter'), sources: [sources.history, sources.museum] }),
    point({ id: 'reouverture', shortTitle: '1981 · Archives', title: '1981 — La réouverture', date: '1981', question: 'Comment cette histoire se poursuit-elle aujourd’hui ?',
      text: 'En 1981, l’Université de Corse rouvre ses portes dans la ville de Corte. La fenêtre d’archives invite à explorer ce retour de l’enseignement universitaire. Une photographie ou un document daté de cette période reste à sélectionner, avec son crédit et ses conditions de réutilisation.',
      position: [-0.62, 0, -0.48], panorama: { yaw: 35, pitch: 0 }, image: missingImage('Archive de la réouverture à fournir', 'Document de 1981 à identifier et à créditer'), sources: [sources.university, sources.m3c] }),
    point({ id: 'corte', shortTitle: 'Corte universitaire', title: 'Corte, ville universitaire', date: '1765 · 1981 · 1983', question: 'Pourquoi Corte ?',
      text: 'Corte relie les deux moments de l’histoire universitaire : la fondation de 1765 et la réouverture de 1981. Le campus Grimaldi et le Palazzu Naziunale correspondent à des lieux distincts. Notre carte est, pour l’instant, un schéma de parcours sans précision géographique.',
      position: [0.3, 0.77, 0.08], panorama: { yaw: 65, pitch: -5 }, image: missingImage('Carte de Corte à fournir', 'Carte du parcours, avec échelle, crédits et points géographiques vérifiés'), sources: [sources.history, sources.iut],
      next: { id: 'palazzu-naziunale', title: 'Le Palazzu Naziunale', status: 'etape-a-preparer' } })
  ],
  panorama: { src: null, status: 'ressource-a-fournir', title: 'Panorama à fournir', credit: null, rights: { status: 'a-verifier' }, calibrated: false },
  ambiences: [
    { id: 'ancien', title: 'Pages, écriture et murmures', src: null, credit: null, rights: { status: 'a-verifier' } },
    { id: 'campus', title: 'Ambiance contemporaine du campus', src: null, credit: null, rights: { status: 'a-verifier' } }
  ],
  music: { entry: { src: null, rights: { status: 'a-verifier' } }, exit: { src: null, rights: { status: 'a-verifier' } } },
  beforeAfter: null,
  designReference: { title: 'Archistoire — référence d’expérience', url: 'https://archistoire.com/' }
};

export function mediaReady(asset) {
  return !!asset?.src && asset.rights?.status === 'autorise';
}
export const findPoint = (id, step = IUT_STEP) => step.points.find(item => item.id === id);
