/**
 * Single source of truth for tier colours, thresholds, action text,
 * feature metadata and runtime settings. No component hardcodes these.
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
export const FORCE_MOCK = String(import.meta.env.VITE_USE_MOCK).toLowerCase() === 'true';
export const DEFAULT_AS_OF = import.meta.env.VITE_DEFAULT_AS_OF || '2025-08-04';

export const CACHE_TTL_MS = 5 * 60 * 1000;
export const DEBOUNCE_MS = 400;
export const HEALTH_TIMEOUT_MS = 10000; // allow for a cold-starting hosted backend
export const HORIZONS = [2, 3, 4];

/** Upper bounds are exclusive empirical percentile ranks against training targets. */
export const TIERS = [
  {
    key: 'Low', max: 0.50, color: '#22a55b', soft: '#22a55b26', icon: 'check',
    action: 'Routine monitoring',
    detail: 'Keep weekly surveillance. No extra field teams needed.',
  },
  {
    key: 'Medium', max: 0.80, color: '#e0a710', soft: '#e0a71026', icon: 'eye',
    action: 'Heighten surveillance and clear drains',
    detail: 'Inspect known breeding sites and run community awareness this fortnight.',
  },
  {
    key: 'High', max: 0.95, color: '#f0742a', soft: '#f0742a26', icon: 'alert',
    action: 'Schedule larvicide rounds within 14 days',
    detail: 'Prioritise stagnant-water sites, construction yards and drains.',
  },
  {
    key: 'Critical', max: Infinity, color: '#e11d48', soft: '#e11d4826', icon: 'siren',
    action: 'Deploy larvicide and fogging teams within 7 days',
    detail: 'Mobilise spraying teams, open fever triage and alert nearby hospitals.',
  },
];

export const TIER_KEYS = TIERS.map((t) => t.key);
export const tierMeta = (key) => TIERS.find((t) => t.key === key) || TIERS[0];
export const tierFromScore = (s) => (TIERS.find((t) => s < t.max) || TIERS[TIERS.length - 1]).key;
export const tierRank = (key) => TIER_KEYS.indexOf(key);

/** Plain-English metadata for features. Backend labels win when present. */
export const FEATURE_META = {
  rainfall_lag_1w: { label: 'Rainfall 1 week ago', unit: 'mm', digits: 0, phrase: 'rainfall last week' },
  rainfall_lag_2w: { label: 'Rainfall 2 weeks ago', unit: 'mm', digits: 0, phrase: 'rainfall 2 weeks ago' },
  rainfall_lag_4w: { label: 'Rainfall 4 weeks ago', unit: 'mm', digits: 0, phrase: 'rainfall 4 weeks ago' },
  rainfall_rolling_mean_4w: { label: 'Rainfall 4-week mean', unit: 'mm', digits: 0, phrase: 'recent rainfall' },
  rainfall_rolling_mean_8w: { label: 'Rainfall 8-week mean', unit: 'mm', digits: 0, phrase: 'rainfall over recent weeks' },
  avg_temp_C: { label: 'Average temperature', unit: '°C', digits: 1, phrase: 'warm temperatures' },
  relative_humidity_pct: { label: 'Relative humidity', unit: '%', digits: 0, phrase: 'high humidity' },
  water_logging_risk_index: { label: 'Water-logging risk', unit: '', digits: 2, phrase: 'poor drainage' },
  population_density_sqkm: { label: 'Population density', unit: '/km²', digits: 0, phrase: 'crowded housing' },
  sanitation_score: { label: 'Sanitation score', unit: '/100', digits: 0, phrase: 'weak sanitation' },
};

export const WHATIF = {
  avg_temp_C: { label: 'Average temperature', unit: '°C', min: 15, max: 40, step: 0.5, def: 29 },
  rainfall_mm: { label: 'Weekly rainfall', unit: 'mm', min: 0, max: 400, step: 5, def: 80 },
  relative_humidity_pct: { label: 'Relative humidity', unit: '%', min: 30, max: 100, step: 1, def: 80 },
};

export const NAV = [
  { to: '/', label: 'Dashboard', icon: 'map' },
  { to: '/weather', label: 'Weather & lags', icon: 'cloud' },
  { to: '/model', label: 'Model performance', icon: 'chart' },
  { to: '/about', label: 'About & costs', icon: 'info' },
];
