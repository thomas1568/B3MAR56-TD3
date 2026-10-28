import { ACCOUNT_CONFIG } from './config.js';
import { AVATARS } from './avatars.js';

export const GUEST_KEY = 'memoria:guest:v1';
const SESSION_KEY = 'memoria:session:v1';
const allowedPoints = ['iut', 'naissance', 'paoli', 'reouverture', 'corte'];
export function validatePseudo(value) {
  const pseudo = String(value || '').trim().normalize('NFC');
  if (pseudo.length < 3 || pseudo.length > 24) throw new Error('Le pseudo doit contenir entre 3 et 24 caractères.');
  if (!/^[\p{L}\p{N} ._-]+$/u.test(pseudo)) throw new Error('Utilisez des lettres, chiffres, espaces, points, tirets ou traits de soulignement.');
  return pseudo;
}
export function validatePhoto(file) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choisissez une image JPEG, PNG ou WebP.');
  if (!file.size || file.size > 5 * 1024 * 1024) throw new Error('La photo doit peser au maximum 5 Mo.');
}
export function normaliseProgress(value) {
  const visited = [...new Set(Array.isArray(value?.visited) ? value.visited.filter(id => allowedPoints.includes(id)) : [])];
  return { started: !!value?.started, visited, lastPoint: allowedPoints.includes(value?.lastPoint) ? value.lastPoint : null };
}
const blank = () => ({ pseudo: '', avatar: 'citadelle', photo_path: null, photoURL: null, progress: normaliseProgress(null) });
const safeRead = (storage, key) => { try { return JSON.parse(storage?.getItem(key) || 'null'); } catch { return null; } };
const defaultStorage = () => { try { return globalThis.localStorage; } catch { return null; } };
export function createAccount({ config = ACCOUNT_CONFIG, fetcher = globalThis.fetch?.bind(globalThis), storage = defaultStorage(), location = globalThis.location, history = globalThis.history } = {}) {
  const base = String(config.supabaseUrl || '').trim().replace(/\/$/, '');
  const configured = /^(https:\/\/[^/]+|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/.test(base) && !!config.publishableKey && !config.publishableKey.startsWith('sb_secret_');
  let session = null, profile = blank(), guest = false, refreshPromise = null, queue = Promise.resolve();
  const listeners = new Set();
  const emit = () => { for (const listener of listeners) listener(getState()); };
  function getState() { return { configured, connected: !!session, guest, profile: structuredClone(profile) }; }
  function write(key, value) {
    try { if (!storage) throw new Error('Storage unavailable'); if (value === null) storage.removeItem(key); else storage.setItem(key, JSON.stringify(value)); }
    catch { throw new Error('Le stockage de cet appareil est indisponible ou plein. Libérez de l’espace puis réessayez.'); }
  }
  async function request(route, { method = 'GET', body, authenticated = true, headers = {} } = {}) {
    if (!configured) throw new Error('La connexion n’est pas encore disponible. Vous pouvez continuer en invité.');
    if (authenticated) await ensureSession();
    let response;
    try {
      response = await fetcher(base + route, { method, headers: { apikey: config.publishableKey, ...(authenticated ? { Authorization: 'Bearer ' + session.access_token } : {}), ...(body instanceof Blob ? {} : { 'Content-Type': 'application/json' }), ...headers }, body: body instanceof Blob ? body : body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    } catch { throw new Error('Connexion impossible. Vérifiez votre réseau et réessayez.'); }
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const code = data?.error_code || data?.code;
      if (code === 'invalid_credentials') throw new Error('Adresse e-mail ou mot de passe incorrect.');
      if (code === 'email_not_confirmed') throw new Error('Confirmez votre adresse e-mail avant de vous connecter.');
      if (response.status === 429) throw new Error('Trop de tentatives. Patientez quelques instants avant de réessayer.');
      if (response.status === 401 || response.status === 403) throw new Error('Votre session a expiré ou cet accès est refusé. Reconnectez-vous.');
      if (response.status === 422) throw new Error('Vérifiez votre adresse e-mail et utilisez un mot de passe d’au moins 8 caractères.');
      throw new Error('L’enregistrement a échoué. Réessayez ; si le problème persiste, contactez Memoria Corti.');
    }
    return data;
  }
  function acceptSession(data) {
    if (!data?.access_token || !data.refresh_token) throw new Error('La connexion n’a pas pu être confirmée. Réessayez.');
    session = { ...data, expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600) };
    write(SESSION_KEY, session);
  }
  async function ensureSession() {
    if (!session) throw new Error('Connectez-vous pour retrouver votre profil.');
    if (session.expires_at * 1000 > Date.now() + 60000) return;
    if (!refreshPromise) refreshPromise = request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token }, authenticated: false }).then(acceptSession).finally(() => { refreshPromise = null; });
    await refreshPromise;
  }
  async function photoURL(path) {
    if (!path) return null;
    const data = await request('/storage/v1/object/sign/avatars/' + path, { method: 'POST', body: { expiresIn: 3600 } });
    const signed = data?.signedURL || data?.signedUrl;
    return signed ? base + '/storage/v1' + signed : null;
  }
  async function loadProfile() {
    const [rows, progressRows] = await Promise.all([
      request('/rest/v1/memoria_profiles?user_id=eq.' + session.user.id + '&select=pseudo,avatar,photo_path'),
      request('/rest/v1/memoria_progress?user_id=eq.' + session.user.id + '&step_id=eq.iut-grimaldi&select=started,visited,last_point')
    ]);
    const row = rows?.[0], progressRow = progressRows?.[0];
    profile = { ...blank(), ...row, progress: normaliseProgress({ ...progressRow, lastPoint: progressRow?.last_point }) };
    if (row?.photo_path) {
      try { profile.photoURL = await photoURL(row.photo_path); }
      catch { profile.photoWarning = 'Votre photo est momentanément indisponible. Vous pouvez la remplacer ou choisir un avatar.'; }
    }
  }
  async function restore() {
    if (configured) {
      const hash = new URLSearchParams(location?.hash?.slice(1));
      if (hash.get('error')) {
        history?.replaceState(null, '', location.pathname + location.search);
        throw new Error('Ce lien de confirmation est expiré ou invalide. Connectez-vous, ou recommencez l’inscription si votre adresse n’a pas encore été confirmée.');
      }
      if (hash.get('access_token')) {
        try {
          const token = hash.get('access_token'), refresh = hash.get('refresh_token');
          // Clear credentials from the address bar before any additional request.
          history?.replaceState(null, '', location.pathname + location.search);
          session = { access_token: token, refresh_token: refresh, expires_at: 0 };
          await ensureSession();
        } catch (error) { session = null; write(SESSION_KEY, null); throw error; }
      } else session = safeRead(storage, SESSION_KEY);
      if (session) {
        try {
          await ensureSession();
          const user = await request('/auth/v1/user'); session.user = user;
          await loadProfile(); guest = false; emit(); return getState();
        } catch (error) { session = null; profile = blank(); emit(); throw error; }
      }
    }
    const saved = safeRead(storage, GUEST_KEY);
    if (saved) {
      try { profile = { ...blank(), ...saved, pseudo: validatePseudo(saved.pseudo), avatar: AVATARS.some(a => a.id === saved.avatar) ? saved.avatar : 'citadelle', progress: normaliseProgress(saved.progress) }; guest = true; }
      catch { write(GUEST_KEY, null); }
    }
    emit(); return getState();
  }
  async function authenticate(email, password, signup = false) {
    email = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Saisissez une adresse e-mail valide.');
    if (password.length < (signup ? 8 : 1)) throw new Error('Le mot de passe doit contenir au moins 8 caractères.');
    const route = signup ? '/auth/v1/signup?redirect_to=' + encodeURIComponent(location.origin + location.pathname) : '/auth/v1/token?grant_type=password';
    const result = await request(route, { method: 'POST', body: { email, password }, authenticated: false });
    if (!result?.access_token) return { confirmationRequired: true };
    acceptSession(result); guest = false; profile = blank(); await loadProfile(); emit(); return getState();
  }
  async function saveProfile(values) {
    const pseudo = validatePseudo(values.pseudo), avatar = AVATARS.some(a => a.id === values.avatar) ? values.avatar : 'citadelle';
    const next = { ...profile, pseudo, avatar, photo_path: values.photo_path || null, photoURL: values.photoURL || null, photoWarning: '' };
    if (session) {
      await request('/rest/v1/memoria_profiles?on_conflict=user_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: { user_id: session.user.id, pseudo, avatar, photo_path: next.photo_path } });
    } else { write(GUEST_KEY, next); guest = true; }
    profile = next; emit(); return getState();
  }
  async function savePhoto(blob) {
    if (blob.type !== 'image/jpeg' || blob.size > 1024 * 1024) throw new Error('Impossible de préparer cette photo. Choisissez une autre image.');
    if (session) {
      const path = session.user.id + '/' + crypto.randomUUID() + '.jpg';
      await request('/storage/v1/object/avatars/' + path, { method: 'POST', body: blob, headers: { 'Content-Type': 'image/jpeg' } });
      return { photo_path: path, photoURL: await photoURL(path) };
    }
    const photo = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Impossible de lire cette photo.')); reader.readAsDataURL(blob); });
    return { photo_path: null, photoURL: photo };
  }
  async function removePhoto(path) {
    if (session && path) await request('/storage/v1/object/avatars', { method: 'DELETE', body: { prefixes: [path] } });
  }
  function progress(change) {
    // Serialize updates: opening several cards quickly must not lose visited points.
    const accountId = session?.user?.id || (guest ? 'guest' : null);
    if (!accountId) return Promise.resolve();
    queue = queue.catch(() => {}).then(async () => {
      if (accountId !== (session?.user?.id || (guest ? 'guest' : null))) return;
      const next = normaliseProgress({ ...profile.progress, ...change, visited: [...profile.progress.visited, ...(change.visited || [])] });
      if (session) await request('/rest/v1/memoria_progress?on_conflict=user_id,step_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: { user_id: session.user.id, step_id: 'iut-grimaldi', started: next.started, visited: next.visited, last_point: next.lastPoint } });
      else write(GUEST_KEY, { ...profile, progress: next });
      profile.progress = next; emit();
    });
    return queue;
  }
  async function signOut() {
    await queue.catch(() => {});
    if (session) await request('/auth/v1/logout?scope=local', { method: 'POST' });
    session = null; guest = false; profile = blank(); write(SESSION_KEY, null); emit();
  }
  return { getState, restore, authenticate, saveProfile, savePhoto, removePhoto, progress, signOut, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); } };
}
