// Persistencia. Regla: nunca perder datos.
// Cada mutación escribe sincrónicamente en localStorage (sobrevive a que maten la app)
// y en diferido en IndexedDB (aguanta más volumen). Al abrir gana el más nuevo.

const LS_KEY = 'rutina:db';
const IDB_NAME = 'rutina';
const IDB_STORE = 'kv';
const MAX_SNAPS = 5;

let _idb = null;
function idb() {
  if (_idb) return _idb;
  _idb = new Promise((res, rej) => {
    if (!('indexedDB' in globalThis)) return rej(new Error('sin indexedDB'));
    const r = indexedDB.open(IDB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }).catch(() => null);
  return _idb;
}

async function idbGet(key) {
  const d = await idb();
  if (!d) return null;
  return new Promise((res) => {
    const tx = d.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
    tx.onsuccess = () => res(tx.result ?? null);
    tx.onerror = () => res(null);
  });
}

async function idbSet(key, val) {
  const d = await idb();
  if (!d) return false;
  return new Promise((res) => {
    const tx = d.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).put(val, key);
    tx.onsuccess = () => res(true);
    tx.onerror = () => res(false);
  });
}

/** Pide almacenamiento persistente para que iOS no desaloje los datos. */
export async function pedirPersistencia() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      return await navigator.storage.persist();
    }
    return true;
  } catch { return false; }
}

export async function cargar() {
  let local = null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) local = JSON.parse(raw);
  } catch { /* corrupto: lo ignoramos y sigue el de IndexedDB */ }

  const remoto = await idbGet('db');
  if (!local) return remoto;
  if (!remoto) return local;
  return (remoto.mtime || 0) > (local.mtime || 0) ? remoto : local;
}

let _cola = Promise.resolve();
export function guardar(db) {
  db.mtime = Date.now();
  try { localStorage.setItem(LS_KEY, JSON.stringify(db)); }
  catch (e) { console.warn('localStorage lleno', e); }
  _cola = _cola.then(() => idbSet('db', db)).catch(() => {});
  return db;
}

/** Foto de seguridad antes de toda operación destructiva. */
export async function tomarFoto(db, motivo) {
  const snaps = (await idbGet('snaps')) || [];
  snaps.unshift({ ts: Date.now(), motivo, data: JSON.parse(JSON.stringify(db)) });
  await idbSet('snaps', snaps.slice(0, MAX_SNAPS));
}

export async function fotos() {
  return (await idbGet('snaps')) || [];
}

export async function restaurarFoto(i) {
  const snaps = await fotos();
  const s = snaps[i];
  if (!s) return null;
  return JSON.parse(JSON.stringify(s.data));
}
