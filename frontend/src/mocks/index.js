/** Mock handlers: same shapes as the real backend contract. Deterministic and clearly labelled DEMO. */
import {
  CITIES, wardsOf, findCity, predictWard, weatherSeries, buildMetrics, IMPORTANCE,
} from './engine';

const LATENCY_MS = 140;
const delay = (signal) => new Promise((resolve, reject) => {
  const t = setTimeout(resolve, LATENCY_MS);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
});

export const health = async () => ({ status: 'ok', model_version: 'demo-mock-v1', mock: true });
export const cities = async () => CITIES.map(({ id, name }) => ({ id, name }));
export const geojson = async () => null;

export async function wards(city, signal) {
  await delay(signal);
  return wardsOf(findCity(city).id);
}

export async function predict(body, signal) {
  await delay(signal);
  const horizon = body.horizon_weeks || 3;
  const city = findCity(body.city || (body.ward_id?.startsWith('CTG') ? 'chattogram' : 'dhaka'));
  const list = body.ward_id
    ? wardsOf(city.id).filter((w) => w.ward_id === body.ward_id)
    : wardsOf(city.id);
  return {
    as_of_date: body.as_of_date,
    horizon_weeks: horizon,
    model_version: 'demo-mock-v1',
    generated_at: null,
    predictions: list.map((w) => predictWard(w, body.as_of_date, horizon, body.weather_override)),
    cached: false,
  };
}

export async function weather({ ward_id, city, weeks, as_of }, signal) {
  await delay(signal);
  const cityId = ward_id ? undefined : findCity(city).id;
  return {
    ward_id: ward_id || null,
    city: city || null,
    series: weatherSeries({ wardId: ward_id, cityId, weeks: Number(weeks) || 52, asOfIso: as_of }),
  };
}

let metricsMemo;
export async function metrics(signal) {
  await delay(signal);
  metricsMemo = metricsMemo || buildMetrics();
  return {
    model_name: 'Demo gradient-boosted trees (mock, not the trained model)',
    notes: 'These figures come from a synthetic case index so the page can be demonstrated offline. '
      + 'Connect the backend to see the real chronological validation: train on the earliest weeks, validate on the next block, '
      + 'and test on the most recent weeks so no future information leaks into training.',
    ...metricsMemo,
  };
}

export async function importance(signal) {
  await delay(signal);
  return IMPORTANCE;
}
