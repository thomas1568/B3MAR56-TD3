import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccount, validatePseudo, validatePhoto, normaliseProgress } from '../memoria/account.js';
import { initials, AVATARS } from '../memoria/avatars.js';

const memory = () => { const data = new Map(); return { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }; };
function backend() {
  const requests = [], users = new Map(); let confirmed = false, current = null, storedProfile = null, storedProgress = null;
  const config = { supabaseUrl: 'https://test.supabase.co', publishableKey: 'sb_publishable_test' };
  const session = () => ({ access_token: 'access-fixture', refresh_token: 'refresh-fixture', expires_in: 3600, user: current });
  async function fetcher(url, options) {
    const route = url.replace(config.supabaseUrl, ''); const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
    requests.push({ route, method: options.method, body, headers: options.headers });
    const ok = data => Response.json(data), denied = () => Response.json({ error_code: 'invalid_credentials' }, { status: 400 });
    if (route.startsWith('/auth/v1/signup')) { current = { id: 'user-1' }; users.set(body.email, body.password); return ok(confirmed ? session() : { user: current }); }
    if (route === '/auth/v1/token?grant_type=password') { if (users.get(body.email) !== body.password) return denied(); current = { id: 'user-1' }; return ok(session()); }
    if (route === '/auth/v1/token?grant_type=refresh_token') return ok(session());
    if (route === '/auth/v1/user') return ok(current);
    if (route.startsWith('/auth/v1/logout')) return ok({});
    assert.equal(options.headers.Authorization, 'Bearer access-fixture');
    if (route.startsWith('/rest/v1/memoria_profiles')) { if (options.method === 'POST') storedProfile = body; return ok(options.method === 'POST' ? {} : storedProfile ? [storedProfile] : []); }
    if (route.startsWith('/rest/v1/memoria_progress')) { if (options.method === 'POST') storedProgress = body; return ok(options.method === 'POST' ? {} : storedProgress ? [storedProgress] : []); }
    if (route.startsWith('/storage/v1/object/sign/')) return ok({ signedURL: '/object/sign/avatars/user-1/photo.jpg?token=test' });
    if (route.startsWith('/storage/v1/object/avatars/')) return ok({ Key: 'avatars/photo.jpg' });
    if (route === '/storage/v1/object/avatars') return ok([]);
    throw Error('Unexpected endpoint: ' + route);
  }
  return { fetcher, config, requests, confirm() { confirmed = true; }, profile: () => storedProfile, progress: () => storedProgress };
}
const location = { origin: 'https://example.com', pathname: '/Memoria/', search: '', hash: '' };

test('nickname, initials, media and progress reject invalid or fabricated data', () => {
  assert.equal(validatePseudo('  Éléa Corti  '), 'Éléa Corti');
  for (const value of ['a', '<script>', 'x'.repeat(25), '😀😀😀']) assert.throws(() => validatePseudo(value));
  assert.equal(initials('élisa corti'), 'ÉC'); assert.equal(initials(''), 'MC'); assert.equal(AVATARS.length, 7);
  assert.throws(() => validatePhoto({ type: 'image/svg+xml', size: 10 }));
  assert.throws(() => validatePhoto({ type: 'image/png', size: 6 * 1024 * 1024 }));
  validatePhoto({ type: 'image/webp', size: 1024 });
  assert.deepEqual(normaliseProgress({ visited: ['iut','iut','invented'], lastPoint: 'invented' }), { started: false, visited: ['iut'], lastPoint: null });
});
test('a persistent guest profile is explicitly local and is never authenticated', async () => {
  const storage = memory(), account = createAccount({ storage, location }); await account.restore();
  await account.saveProfile({ pseudo: 'Mattea', avatar: 'montagne' });
  await Promise.all([account.progress({ started: true, visited: ['iut'], lastPoint: 'iut' }), account.progress({ visited: ['naissance'], lastPoint: 'naissance' })]);
  const again = createAccount({ storage, location }); await again.restore();
  assert.equal(again.getState().connected, false); assert.equal(again.getState().guest, true);
  assert.equal(again.getState().profile.pseudo, 'Mattea'); assert.equal(again.getState().profile.avatar, 'montagne');
  assert.deepEqual(again.getState().profile.progress.visited, ['iut','naissance']);
  await assert.rejects(again.authenticate('test@example.com', 'password'), /pas encore disponible/);
});
test('email confirmation does not create a fake connected session', async () => {
  const server = backend(), account = createAccount({ ...server, storage: memory(), location });
  const result = await account.authenticate('corti@example.com', 'password123', true);
  assert.equal(result.confirmationRequired, true); assert.equal(account.getState().connected, false);
  assert.match(server.requests[0].route, /redirect_to=https%3A%2F%2Fexample.com%2FMemoria%2F/);
});
test('sign-up, profile, private avatar, progress, logout and sign-in use remote persistence', async () => {
  const server = backend(), storage = memory(); server.confirm();
  const account = createAccount({ ...server, storage, location });
  await account.authenticate('corti@example.com', 'password123', true);
  const photo = await account.savePhoto(new Blob(['jpeg-fixture'], { type: 'image/jpeg' }));
  await account.saveProfile({ pseudo: 'Elisa', avatar: 'boussole', ...photo });
  await Promise.all([account.progress({ started: true, visited: ['iut'], lastPoint: 'iut' }), account.progress({ visited: ['paoli'], lastPoint: 'paoli' })]);
  assert.equal(server.profile().user_id, 'user-1'); assert.equal(server.profile().pseudo, 'Elisa');
  assert.deepEqual(server.progress().visited, ['iut','paoli']);
  await account.signOut(); assert.equal(account.getState().connected, false);
  const again = createAccount({ ...server, storage, location });
  await assert.rejects(again.authenticate('corti@example.com', 'incorrect'), /incorrect/);
  await again.authenticate('corti@example.com', 'password123');
  assert.equal(again.getState().profile.pseudo, 'Elisa'); assert.equal(again.getState().profile.avatar, 'boussole');
  assert.match(again.getState().profile.photoURL, /^https:\/\/test.supabase.co\/storage\/v1\/object\/sign/);
  assert.deepEqual(again.getState().profile.progress.visited, ['iut','paoli']);
  const freshTab = createAccount({ ...server, storage, location }); await freshTab.restore();
  assert.equal(freshTab.getState().connected, true); assert.equal(freshTab.getState().profile.pseudo, 'Elisa');
  await freshTab.removePhoto(photo.photo_path); assert.equal(server.requests.at(-1).method, 'DELETE');
});
test('an expired session refreshes before requesting the authenticated profile', async () => {
  const server = backend(), storage = memory(); server.confirm(); const first = createAccount({ ...server, storage, location });
  await first.authenticate('corti@example.com', 'password123', true);
  const saved = JSON.parse(storage.getItem('memoria:session:v1')); saved.expires_at = 1; storage.setItem('memoria:session:v1', JSON.stringify(saved));
  const next = createAccount({ ...server, storage, location }); await next.restore();
  assert.ok(server.requests.some(request => request.route.includes('grant_type=refresh_token'))); assert.equal(next.getState().connected, true);
});
test('storage and network failures are actionable and do not report successful saves', async () => {
  const account = createAccount({ storage: { setItem() { throw Error('quota'); }, getItem() { return null; } }, location });
  await assert.rejects(account.saveProfile({ pseudo: 'Elisa', avatar: 'livre' }), /stockage/);
  assert.equal(account.getState().guest, false);
  const offline = createAccount({ config: { supabaseUrl: 'https://test.supabase.co', publishableKey: 'test' }, storage: memory(), location, fetcher: async () => { throw Error('offline'); } });
  await assert.rejects(offline.authenticate('corti@example.com', 'password123'), /réseau/);
  assert.equal(offline.getState().connected, false);
});
