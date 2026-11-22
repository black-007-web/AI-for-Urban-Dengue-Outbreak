/**
 * Request cache + de-duplication + abort handling.
 *
 *  - In-memory TTL cache keyed by endpoint + params (mirrored to sessionStorage).
 *  - Identical in-flight requests share ONE promise (and one network call).
 *  - The underlying fetch is aborted only when every consumer has aborted.
 *  - Counters feed the "request savings" panel on the About page.
 */
const SS_KEY = 'dw-cache-v2';
const store = new Map();
const inflight = new Map();
const listeners = new Set();
export const stats = { network: 0, hits: 0, deduped: 0, aborted: 0 };

function emit() { listeners.forEach((l) => l()); }
export function subscribeStats(fn) { listeners.add(fn); return () => listeners.delete(fn); }

let snapshot = { ...stats };
export function getStatsSnapshot() {
  if (snapshot.network !== stats.network || snapshot.hits !== stats.hits
    || snapshot.deduped !== stats.deduped || snapshot.aborted !== stats.aborted) {
    snapshot = { ...stats };
  }
  return snapshot;
}

try {
  const raw = sessionStorage.getItem(SS_KEY);
  if (raw) {
    const now = Date.now();
    Object.entries(JSON.parse(raw)).forEach(([k, v]) => { if (v.expires > now) store.set(k, v); });
  }
} catch { /* storage unavailable: memory cache only */ }

let persistTimer;
function persist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      const out = {};
      store.forEach((v, k) => { if (!v.volatile) out[k] = v; });
      sessionStorage.setItem(SS_KEY, JSON.stringify(out));
    } catch { /* quota or privacy mode */ }
  }, 300);
}

export function stableKey(name, params) {
  const p = params ?? {};
  const sorted = Object.keys(p).sort().reduce((acc, k) => ({ ...acc, [k]: p[k] }), {});
  return `${name}?${JSON.stringify(sorted)}`;
}

export function clearCache() {
  store.clear();
  try { sessionStorage.removeItem(SS_KEY); } catch { /* ignore */ }
  emit();
}

const abortError = () => new DOMException('Request aborted', 'AbortError');

/**
 * @param {string} key  cache key
 * @param {(signal: AbortSignal) => Promise<any>} loader
 * @param {{ttl?: number, signal?: AbortSignal, force?: boolean, volatile?: boolean}} opts
 * @returns {Promise<{data: any, cached: boolean}>}
 */
export function cachedRequest(key, loader, { ttl = 300000, signal, force = false, volatile = false } = {}) {
  if (signal?.aborted) return Promise.reject(abortError());

  if (!force) {
    const hit = store.get(key);
    if (hit && hit.expires > Date.now()) {
      stats.hits += 1; emit();
      return Promise.resolve({ data: hit.value, cached: true });
    }
  }

  let entry = inflight.get(key);
  if (entry) {
    stats.deduped += 1;
  } else {
    const controller = new AbortController();
    stats.network += 1;
    const promise = loader(controller.signal)
      .then((value) => {
        store.set(key, { value, expires: Date.now() + ttl, volatile });
        persist();
        return value;
      })
      .finally(() => { inflight.delete(key); emit(); });
    entry = { promise, controller, consumers: 0 };
    inflight.set(key, entry);
  }
  entry.consumers += 1;
  emit();

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      entry.consumers -= 1;
      stats.aborted += 1;
      if (entry.consumers <= 0) {
        entry.controller.abort();
        if (inflight.get(key) === entry) inflight.delete(key);
      }
      emit();
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    entry.promise.then(
      (data) => { signal?.removeEventListener('abort', onAbort); resolve({ data, cached: false }); },
      (err) => { signal?.removeEventListener('abort', onAbort); reject(err); },
    );
  });
}
