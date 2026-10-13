// Envoltorio mínimo de IndexedDB con promesas, migraciones versionadas y errores tipados.

const DB_NAME = 'fitweek';
export const DB_VERSION = 1;

// Cada migración lleva la base de la versión n-1 a la n. Nunca se editan las ya publicadas:
// los cambios futuros se agregan como una migración nueva para no perder datos de nadie.
const MIGRATIONS = {
  1(db) {
    db.createObjectStore('settings');
    const ex = db.createObjectStore('exercises', { keyPath: 'id' });
    ex.createIndex('nameKey', 'nameKey', { unique: true });
    db.createObjectStore('cycleDays', { keyPath: 'id' });
    const ses = db.createObjectStore('sessions', { keyPath: 'id' });
    ses.createIndex('date', 'date');
    ses.createIndex('status', 'status');
  },
};

export class StorageError extends Error {
  constructor(code, cause) {
    super(code);
    this.name = 'StorageError';
    this.code = code; // 'unavailable' | 'quota' | 'blocked' | 'unknown'
    this.cause = cause;
  }
}

function wrapError(err) {
  if (err instanceof StorageError) return err;
  if (err?.name === 'QuotaExceededError') return new StorageError('quota', err);
  return new StorageError('unknown', err);
}

const listeners = new Set();
export function onDbEvent(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const emit = (type) => listeners.forEach((fn) => fn(type));

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis) || !globalThis.indexedDB) return reject(new StorageError('unavailable'));
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      return reject(new StorageError('unavailable', e));
    }
    req.onupgradeneeded = (e) => {
      const db = req.result;
      for (let v = e.oldVersion + 1; v <= DB_VERSION; v++) MIGRATIONS[v]?.(db, req.transaction);
    };
    req.onblocked = () => emit('blocked');
    req.onerror = () => reject(wrapError(req.error));
    req.onsuccess = () => {
      const db = req.result;
      // Otra pestaña con una versión nueva necesita actualizar: cerramos y avisamos.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
        emit('versionchange');
      };
      resolve(db);
    };
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

export const req = (r) =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

/**
 * Ejecuta fn dentro de una transacción. fn solo debe esperar pedidos de IndexedDB
 * (await req(...)); esperar otra cosa cerraría la transacción antes de tiempo.
 */
export async function tx(stores, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    let t;
    try {
      t = db.transaction(stores, mode);
    } catch (e) {
      return reject(wrapError(e));
    }
    let result;
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(wrapError(t.error));
    t.onabort = () => reject(wrapError(t.error ?? new Error('abort')));
    Promise.resolve()
      .then(() => fn(t))
      .then((r) => {
        result = r;
      })
      .catch((err) => {
        try {
          t.abort();
        } catch {
          /* ya terminada */
        }
        reject(wrapError(err));
      });
  });
}

export const getAll = (store) => tx([store], 'readonly', (t) => req(t.objectStore(store).getAll()));
export const getOne = (store, key) => tx([store], 'readonly', (t) => req(t.objectStore(store).get(key)));
export const putOne = (store, value, key) =>
  tx([store], 'readwrite', (t) => req(key === undefined ? t.objectStore(store).put(value) : t.objectStore(store).put(value, key)));
export const deleteOne = (store, key) => tx([store], 'readwrite', (t) => req(t.objectStore(store).delete(key)));

export async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function storageInfo() {
  try {
    const [est, persisted] = await Promise.all([navigator.storage?.estimate?.(), navigator.storage?.persisted?.()]);
    return { usage: est?.usage ?? null, quota: est?.quota ?? null, persisted: persisted ?? null };
  } catch {
    return { usage: null, quota: null, persisted: null };
  }
}
