// Public browser configuration. Never put a service_role/secret key here.
export const ACCOUNT_CONFIG = Object.freeze({
  supabaseUrl: '',
  publishableKey: ''
});


// Public services only. No key or secret is needed by the static application.
// Documentation and limits: docs/cartographie.md
export const MAP_CONFIG = Object.freeze({
  tilesURL: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  tilesAttribution: '© OpenStreetMap contributors',
  routingURL: 'https://data.geopf.fr/navigation/itineraire',
  routingResource: 'bdtopo-valhalla'
});
