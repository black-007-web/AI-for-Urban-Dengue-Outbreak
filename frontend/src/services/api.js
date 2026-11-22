/**
 * ALL HTTP lives here. Endpoint paths are defined once in ENDPOINTS so the
 * backend team can adjust them in one place.
 *
 * Every call resolves to { data, cached, mock }.
 * If the backend is unreachable (or VITE_USE_MOCK=true) the deterministic
 * generators in src/mocks are used and `mock: true` is reported so the UI can
 * label the data honestly.
 */
import { API_BASE_URL, FORCE_MOCK, HEALTH_TIMEOUT_MS } from '../config';
import * as mocks from '../mocks';
import { cachedRequest, stableKey } from './cache';

export const ENDPOINTS = {
  health: '/api/health',
  cities: '/api/cities',
  wards: '/api/wards',
  geojson: '/api/wards/geojson',
  predict: '/api/predict',
  weather: '/api/weather',
  metrics: '/api/metrics',
  importance: '/api/model/importance',
};

/* ---------- backend status store (works with useSyncExternalStore) ---------- */
let status = { mock: FORCE_MOCK, reason: FORCE_MOCK ? 'forced' : null, ready: FORCE_MOCK, health: null };
const subs = new Set();
const setStatus = (patch) => { status = { ...status, ...patch }; subs.forEach((s) => s()); };
export const subscribeStatus = (fn) => { subs.add(fn); return () => subs.delete(fn); };
export const getStatus = () => status;

export async function probeBackend() {
  if (FORCE_MOCK) { setStatus({ ready: true }); return; }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(API_BASE_URL + ENDPOINTS.health, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const health = await res.json();
    setStatus({ mock: false, reason: null, ready: true, health });
  } catch {
    setStatus({ mock: true, reason: 'backend-offline', ready: true });
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- low-level http ---------- */
class HttpError extends Error {
  constructor(message, httpStatus) { super(message); this.status = httpStatus; }
}

async function http(path, { method = 'GET', params, body, signal } = {}) {
  const url = new URL(API_BASE_URL + path);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });
  const res = await fetch(url, {
    method,
    signal,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new HttpError(`${method} ${path} failed (${res.status})`, res.status);
  return res.json();
}

const isAbort = (e) => e?.name === 'AbortError';

/**
 * Try the live backend; on a network failure flip the whole app to demo data.
 * HTTP 4xx/5xx from a reachable backend are surfaced (not hidden by mocks).
 */
async function call(name, params, { live, mock, signal, force, optional = false }) {
  const key = stableKey(name, params);
  if (!getStatus().mock) {
    try {
      const { data, cached } = await cachedRequest(`live:${key}`, (s) => live(s), { signal, force });
      return { data, cached, mock: false };
    } catch (err) {
      if (isAbort(err)) throw err;
      if (err instanceof HttpError) {
        if (optional) return { data: null, cached: false, mock: false };
        throw err;
      }
      setStatus({ mock: true, reason: 'backend-offline' });
    }
  }
  const { data, cached } = await cachedRequest(`mock:${key}`, (s) => mock(s), { signal, force, volatile: true });
  return { data, cached, mock: true };
}

/* ---------- public API ---------- */
export const getHealth = (o = {}) => call('health', {}, {
  ...o, live: (signal) => http(ENDPOINTS.health, { signal }), mock: () => mocks.health(),
});

export const getCities = (o = {}) => call('cities', {}, {
  ...o, live: (signal) => http(ENDPOINTS.cities, { signal }), mock: () => mocks.cities(),
});

export const getWards = (city, o = {}) => call('wards', { city }, {
  ...o, live: (signal) => http(ENDPOINTS.wards, { params: { city }, signal }), mock: (s) => mocks.wards(city, s),
});

export const getWardGeojson = (city, o = {}) => call('geojson', { city }, {
  ...o,
  optional: true,
  live: (signal) => http(ENDPOINTS.geojson, { params: { city }, signal }),
  mock: () => mocks.geojson(city),
});

/** body: { ward_id | city, as_of_date, horizon_weeks } */
export const predict = (body, o = {}) => call('predict', body, {
  ...o,
  live: (signal) => http(ENDPOINTS.predict, { method: 'POST', body, signal }),
  mock: (s) => mocks.predict(body, s),
});

export const getWeather = ({ ward_id, city, weeks = 52, as_of }, o = {}) => call('weather', { ward_id, city, weeks, as_of }, {
  ...o,
  live: (signal) => http(ENDPOINTS.weather, { params: { ward_id, city, weeks, as_of }, signal }),
  mock: (s) => mocks.weather({ ward_id, city, weeks, as_of }, s),
});

export const getMetrics = (o = {}) => call('metrics', {}, {
  ...o, live: (signal) => http(ENDPOINTS.metrics, { signal }), mock: (s) => mocks.metrics(s),
});

export const getImportance = (o = {}) => call('importance', {}, {
  ...o, live: (signal) => http(ENDPOINTS.importance, { signal }), mock: (s) => mocks.importance(s),
});
