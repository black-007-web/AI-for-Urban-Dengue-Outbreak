/**
 * Deterministic DEMO data engine. Nothing here is real epidemiology:
 * ward coordinates are approximate, and every number is generated from seeded
 * hashes so the same inputs always return the same outputs.
 */
import { FEATURE_META, tierFromScore } from '../config';

/* ---------- seeded randomness ---------- */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** Uniform [0,1) derived purely from a string key. */
export const unit = (key) => {
  let a = hash(key);
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

/* ---------- calendar (weeks start on Monday) ---------- */
const DAY = 864e5;
const EPOCH = Date.UTC(2019, 11, 30);
export const weekIndex = (iso) => Math.floor((Date.parse(`${iso}T00:00:00Z`) - EPOCH) / (7 * DAY));
export const weekStart = (idx) => new Date(EPOCH + idx * 7 * DAY).toISOString().slice(0, 10);
const dayOfYear = (idx) => {
  const d = new Date(EPOCH + idx * 7 * DAY);
  return (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / DAY;
};

/* ---------- cities and wards (approximate centroids) ---------- */
export const CITIES = [
  { id: 'dhaka', name: 'Dhaka', center: [23.7806, 90.4000], rainScale: 1, tempShift: 0 },
  { id: 'chattogram', name: 'Chattogram', center: [22.3500, 91.8200], rainScale: 1.28, tempShift: -0.6 },
];

const RAW_WARDS = {
  dhaka: [
    ['Mirpur-10', 23.8069, 90.3687], ['Mirpur-1', 23.7956, 90.3537], ['Pallabi', 23.8250, 90.3650],
    ['Kafrul', 23.8100, 90.3820], ['Uttara Sector-7', 23.8759, 90.3795], ['Uttara Sector-12', 23.8680, 90.3990],
    ['Banani', 23.7937, 90.4066], ['Gulshan-1', 23.7806, 90.4162], ['Gulshan-2', 23.7925, 90.4143],
    ['Badda', 23.7806, 90.4261], ['Rampura', 23.7610, 90.4210], ['Khilgaon', 23.7480, 90.4290],
    ['Mugda', 23.7340, 90.4300], ['Basabo', 23.7400, 90.4250], ['Jatrabari', 23.7100, 90.4350],
    ['Demra', 23.7200, 90.4800], ['Sutrapur', 23.7110, 90.4170], ['Lalbagh', 23.7220, 90.3890],
    ['Hazaribagh', 23.7340, 90.3610], ['Dhanmondi', 23.7461, 90.3742], ['Mohammadpur', 23.7662, 90.3586],
    ['Adabor', 23.7700, 90.3480], ['Tejgaon', 23.7590, 90.3930], ['Karwan Bazar', 23.7510, 90.3930],
    ['Motijheel', 23.7330, 90.4172], ['Shahbagh', 23.7390, 90.3950], ['Malibagh', 23.7480, 90.4130],
    ['Mohakhali', 23.7780, 90.4050],
  ],
  chattogram: [
    ['Pahartali', 22.3650, 91.8000], ['Khulshi', 22.3560, 91.8100], ['Panchlaish', 22.3610, 91.8200],
    ['Nasirabad', 22.3700, 91.8300], ['Halishahar', 22.3300, 91.7800], ['Agrabad', 22.3250, 91.8100],
    ['Patenga', 22.2400, 91.8000], ['Double Mooring', 22.3180, 91.8330], ['Kotwali', 22.3380, 91.8350],
    ['Chawkbazar', 22.3550, 91.8420], ['Bakalia', 22.3450, 91.8500], ['Chandgaon', 22.3800, 91.8600],
    ['Bayezid', 22.3900, 91.8200], ['Muradpur', 22.3720, 91.8400], ['GEC Circle', 22.3600, 91.8310],
    ['Oxygen', 22.3820, 91.8100], ['Lalkhan Bazar', 22.3590, 91.8150], ['Dampara', 22.3380, 91.8210],
    ['Firingee Bazar', 22.3300, 91.8400], ['Sholoshahar', 22.3650, 91.8250], ['Akbar Shah', 22.3700, 91.8700],
    ['Kattali', 22.3100, 91.7700], ['Rahattarpul', 22.3500, 91.8300], ['Sugandha', 22.3480, 91.8180],
  ],
};

const PREFIX = { dhaka: 'DHK', chattogram: 'CTG' };
const WARD_CACHE = {};

export function wardsOf(cityId) {
  if (WARD_CACHE[cityId]) return WARD_CACHE[cityId];
  const list = (RAW_WARDS[cityId] || []).map(([name, lat, lon], i) => {
    const id = `${PREFIX[cityId]}-${String(i + 1).padStart(3, '0')}`;
    const dense = cityId === 'dhaka' ? 1 : 0.72;
    return {
      ward_id: id,
      ward_name: name,
      city: CITIES.find((c) => c.id === cityId).name,
      lat,
      lon,
      population_density_sqkm: Math.round((9000 + unit(`dens|${id}`) * 52000) * dense / 100) * 100,
      sanitation_score: Math.round(28 + unit(`san|${id}`) * 62),
      water_logging_risk_index: round(0.12 + unit(`wl|${id}`) * 0.8, 2),
    };
  });
  WARD_CACHE[cityId] = list;
  return list;
}
export const cityIdOf = (wardId) => (wardId.startsWith('CTG') ? 'chattogram' : 'dhaka');
export const findCity = (idOrName) => CITIES.find((c) => c.id === idOrName || c.name === idOrName) || CITIES[0];

/* ---------- weather ---------- */
function climRain(cityId, idx) {
  const doy = dayOfYear(idx);
  const c = findCity(cityId);
  const monsoon = 95 * Math.exp(-(((doy - 195) / 48) ** 2));
  const post = 28 * Math.exp(-(((doy - 285) / 20) ** 2));
  return (6 + monsoon + post) * c.rainScale;
}
function obsRain(cityId, idx) {
  const n = unit(`rain|${cityId}|${idx}`);
  const storm = unit(`storm|${cityId}|${idx}`) > 0.92 ? 1.1 : 0;
  return climRain(cityId, idx) * (0.3 + 1.5 * n * n + storm);
}
const climTemp = (cityId, idx) => 25 + 5.5 * Math.sin((2 * Math.PI * (dayOfYear(idx) - 60)) / 365) + findCity(cityId).tempShift;
const obsTemp = (cityId, idx) => climTemp(cityId, idx) + (unit(`temp|${cityId}|${idx}`) - 0.5) * 2.4;
const climHum = (cityId, idx) => 62 + 22 * Math.exp(-(((dayOfYear(idx) - 200) / 70) ** 2));
const obsHum = (cityId, idx) => clamp(climHum(cityId, idx) + (unit(`hum|${cityId}|${idx}`) - 0.5) * 12, 35, 98);

const wardFactor = (wardId) => 0.9 + 0.2 * unit(`wf|${wardId}`);

/** Weather for a ward in week idx. Weeks after as_of are *assumed* (climatology or what-if override). */
export function weatherAt(ward, idx, asOfIdx, override) {
  const cityId = cityIdOf(ward.ward_id);
  const f = wardFactor(ward.ward_id);
  if (override && idx >= asOfIdx) {
    return { rain: override.rainfall_mm, temp: override.avg_temp_C, hum: override.relative_humidity_pct, assumed: idx > asOfIdx };
  }
  if (idx > asOfIdx) {
    return { rain: climRain(cityId, idx) * f, temp: climTemp(cityId, idx), hum: climHum(cityId, idx), assumed: true };
  }
  const local = 0.9 + 0.2 * unit(`wr|${ward.ward_id}|${idx}`);
  return { rain: obsRain(cityId, idx) * f * local, temp: obsTemp(cityId, idx), hum: obsHum(cityId, idx), assumed: false };
}

/* ---------- risk model (a transparent linear-logit stand-in for the real ML model) ---------- */
export const FEATURES = [
  { key: 'rainfall_lag_1w', coef: 0.14, mean: 45, sd: 40 },
  { key: 'rainfall_lag_2w', coef: 0.3, mean: 45, sd: 40 },
  { key: 'rainfall_lag_4w', coef: 0.24, mean: 45, sd: 40 },
  { key: 'avg_temp_C', coef: 0.24, mean: 27, sd: 4 },
  { key: 'relative_humidity_pct', coef: 0.16, mean: 75, sd: 8 },
  { key: 'water_logging_risk_index', coef: 0.36, mean: 0.5, sd: 0.2 },
  { key: 'population_density_sqkm', coef: 0.24, mean: 30000, sd: 15000 },
  { key: 'sanitation_score', coef: -0.3, mean: 55, sd: 18 },
];
const INTERCEPT = -0.2;
const SCALE = 1.25;

function featuresAt(ward, target, asOfIdx, override) {
  const lags = [1, 2, 4].map((l) => weatherAt(ward, target - l, asOfIdx, override));
  const wx = weatherAt(ward, target - 1, asOfIdx, override);
  return {
    values: {
      rainfall_lag_1w: lags[0].rain,
      rainfall_lag_2w: lags[1].rain,
      rainfall_lag_4w: lags[2].rain,
      avg_temp_C: wx.temp,
      relative_humidity_pct: wx.hum,
      water_logging_risk_index: ward.water_logging_risk_index,
      population_density_sqkm: ward.population_density_sqkm,
      sanitation_score: ward.sanitation_score,
    },
    futureShare: lags.filter((l) => l.assumed).length / 3,
  };
}

function scoreOf(values) {
  let raw = INTERCEPT;
  const contributions = FEATURES.map((f) => {
    const z = (values[f.key] - f.mean) / f.sd;
    raw += f.coef * z;
    return { feature: f.key, z, contribution: f.coef * z };
  });
  return { score: sigmoid(SCALE * raw), contributions };
}

const weeklyCases = (score, ward) => score ** 2 * 26 * (ward.population_density_sqkm / 30000) ** 0.55;

export function predictWard(ward, asOfIso, horizon, override) {
  const asOfIdx = weekIndex(asOfIso);
  const forecast = [];
  let cases = 0;
  let casesLo = 0;
  let casesHi = 0;
  let last = null;
  for (let k = 1; k <= horizon; k += 1) {
    const t = asOfIdx + k;
    const { values, futureShare } = featuresAt(ward, t, asOfIdx, override);
    const { score, contributions } = scoreOf(values);
    const half = 0.035 + 0.02 * k + 0.05 * futureShare;
    const lo = clamp(score - half, 0, 1);
    const hi = clamp(score + half, 0, 1);
    forecast.push({ week_start: weekStart(t), risk_score: round(score, 3), ci_lower: round(lo, 3), ci_upper: round(hi, 3) });
    cases += weeklyCases(score, ward);
    casesLo += weeklyCases(lo, ward);
    casesHi += weeklyCases(hi, ward);
    last = { values, score, contributions };
  }
  const drivers = last.contributions
    .map((c) => {
      const meta = FEATURE_META[c.feature];
      return {
        feature: c.feature,
        label: meta.label,
        value: round(last.values[c.feature], meta.digits === 0 ? 1 : 2),
        contribution: round(c.contribution * 0.28, 3),
      };
    })
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  return {
    ward_id: ward.ward_id,
    ward_name: ward.ward_name,
    risk_score: round(last.score, 3),
    risk_tier: tierFromScore(last.score),
    predicted_cases: round(cases, 1),
    ci_lower: round(casesLo, 1),
    ci_upper: round(casesHi, 1),
    drivers,
    forecast,
  };
}

/* ---------- weather series for the Weather page ---------- */
export function weatherSeries({ wardId, cityId, weeks, asOfIso }) {
  const asOfIdx = weekIndex(asOfIso);
  const ward = wardId ? wardsOf(cityIdOf(wardId)).find((w) => w.ward_id === wardId) : null;
  const city = ward ? cityIdOf(ward.ward_id) : cityId;
  const rainAt = (idx) => (ward
    ? weatherAt(ward, idx, asOfIdx, null).rain
    : obsRain(city, idx));
  const series = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const idx = asOfIdx - i;
    const wx = ward ? weatherAt(ward, idx, asOfIdx, null) : { temp: obsTemp(city, idx), hum: obsHum(city, idx) };
    series.push({
      week_start: weekStart(idx),
      rainfall_mm: round(rainAt(idx), 1),
      avg_temp_C: round(wx.temp, 1),
      relative_humidity_pct: round(wx.hum, 1),
      rainfall_lag_1w: round(rainAt(idx - 1), 1),
      rainfall_lag_2w: round(rainAt(idx - 2), 1),
      rainfall_lag_4w: round(rainAt(idx - 4), 1),
      rainfall_rolling_mean_4w: round([1, 2, 3, 4].reduce((sum, lag) => sum + rainAt(idx - lag), 0) / 4, 1),
      rainfall_rolling_mean_8w: round([1, 2, 3, 4, 5, 6, 7, 8].reduce((sum, lag) => sum + rainAt(idx - lag), 0) / 8, 1),
    });
  }
  return series;
}

/* ---------- validation metrics (derived from a synthetic city-wide case index) ---------- */
export function buildMetrics() {
  const SPLIT = {
    train: { start: '2021-01-04', end: '2024-12-30' },
    validation: { start: '2025-01-06', end: '2025-12-29' },
    test: { start: '2026-01-05', end: '2026-11-16' },
  };
  const rainZ = (idx) => (obsRain('dhaka', idx) - 45) / 40;
  const signal = (idx) => 0.14 * rainZ(idx - 1) + 0.3 * rainZ(idx - 2) + 0.46 * rainZ(idx - 3) + 0.24 * rainZ(idx - 4);
  const series = [];
  const from = weekIndex(SPLIT.validation.start);
  const to = weekIndex(SPLIT.test.end);
  for (let idx = from; idx <= to; idx += 1) {
    const base = 18 + 440 * sigmoid(1.5 * (signal(idx) - 0.7)) ** 1.2;
    const actual = base * (0.78 + 0.44 * unit(`act|${idx}`));
    const predicted = base * (0.94 + 0.12 * unit(`prd|${idx}`)) + 6 * (unit(`bias|${idx}`) - 0.5);
    series.push({
      week_start: weekStart(idx),
      split: idx <= weekIndex(SPLIT.validation.end) ? 'validation' : 'test',
      actual: round(actual, 1),
      predicted: round(predicted, 1),
    });
  }
  const score = (rows) => {
    const n = rows.length;
    const mae = rows.reduce((s, r) => s + Math.abs(r.actual - r.predicted), 0) / n;
    const rmse = Math.sqrt(rows.reduce((s, r) => s + (r.actual - r.predicted) ** 2, 0) / n);
    const mean = rows.reduce((s, r) => s + r.actual, 0) / n;
    const ssTot = rows.reduce((s, r) => s + (r.actual - mean) ** 2, 0);
    const ssRes = rows.reduce((s, r) => s + (r.actual - r.predicted) ** 2, 0);
    return { mae: round(mae, 2), rmse: round(rmse, 2), r2: round(1 - ssRes / ssTot, 3) };
  };
  const val = series.filter((r) => r.split === 'validation');
  const test = series.filter((r) => r.split === 'test');
  const cut = [60, 150, 300];
  const tierOf = (x) => ['Low', 'Medium', 'High', 'Critical'][cut.filter((c) => x >= c).length];
  const perTier = ['Low', 'Medium', 'High', 'Critical'].map((tier) => {
    const tp = test.filter((r) => tierOf(r.actual) === tier && tierOf(r.predicted) === tier).length;
    const predicted = test.filter((r) => tierOf(r.predicted) === tier).length;
    const actual = test.filter((r) => tierOf(r.actual) === tier).length;
    return {
      tier,
      precision: predicted ? round(tp / predicted, 2) : null,
      recall: actual ? round(tp / actual, 2) : null,
      support: actual,
    };
  });
  return {
    split: SPLIT,
    metrics: score(test),
    metrics_by_split: { validation: score(val), test: score(test) },
    per_tier: perTier,
    series,
  };
}

export const IMPORTANCE = (() => {
  const raw = FEATURES.map((f) => ({ feature: f.key, v: Math.abs(f.coef) * (0.9 + 0.2 * unit(`imp|${f.key}`)) }));
  const total = raw.reduce((s, r) => s + r.v, 0);
  return raw
    .map((r) => ({ feature: r.feature, label: FEATURE_META[r.feature].label, importance: round(r.v / total, 3) }))
    .sort((a, b) => b.importance - a.importance);
})();
