import { FEATURE_META } from '../config';

const meta = (d) => FEATURE_META[d.feature] || {
  label: d.label || d.feature,
  unit: d.unit || '',
  digits: d.unit === 'cases' ? 1 : 2,
  phrase: d.phrase || (d.label || d.feature).toLowerCase(),
};

export const driverValue = (d) => {
  if (d.value === null || d.value === undefined) return '';
  const m = meta(d);
  const v = Number(d.value);
  const text = Number.isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: m.digits }) : String(d.value);
  return m.unit ? `${text}${m.unit.startsWith('/') ? '' : ' '}${m.unit}` : text;
};

/** "Rainfall 3 weeks ago: 182 mm, raises risk" */
export function driverSentence(d) {
  const m = meta(d);
  const dir = d.contribution >= 0 ? 'raises risk' : 'lowers risk';
  const value = driverValue(d);
  return value ? `${d.label || m.label}: ${value}, ${dir}` : `${d.label || m.label} ${dir}`;
}

/** One-sentence summary of the top positive drivers. */
export function summarize(prediction) {
  const pos = [...prediction.drivers].filter((d) => d.contribution > 0).sort((a, b) => b.contribution - a.contribution).slice(0, 2);
  const neg = [...prediction.drivers].filter((d) => d.contribution < 0).sort((a, b) => a.contribution - b.contribution)[0];
  if (!pos.length) return 'Per-feature attribution is not available in the exported model package.';
  const phrases = pos.map((d) => meta(d).phrase);
  const main = phrases.length === 2 ? `${phrases[0]} and ${phrases[1]}` : phrases[0];
  const negValue = neg ? driverValue(neg) : '';
  const tail = neg ? `, while ${(neg.label || meta(neg).label).toLowerCase()}${negValue ? ` (${negValue})` : ''} helps hold it down` : '';
  return `Risk is driven mainly by ${main}${tail}.`;
}
