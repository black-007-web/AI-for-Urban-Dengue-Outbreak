import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import { fmtDateLong } from '../utils/format';

const PARTS = [
  { key: 'train', label: 'Train', color: '#64748b', note: 'The model learns from these weeks only.' },
  { key: 'validation', label: 'Validation', color: '#e0a710', note: 'Used to tune settings. Never trained on.' },
  { key: 'test', label: 'Test', color: '#22a55b', note: 'The most recent weeks. Scored once, as a true forward-looking check.' },
];

/** Chronological split: proportional segments, so leakage of future into past is visibly impossible. */
function SplitTimeline({ split }) {
  const [hover, setHover] = useState(null);
  const spans = PARTS.map((p) => {
    const s = split?.[p.key];
    return s ? { ...p, ...s, days: (Date.parse(s.end) - Date.parse(s.start)) / 864e5 + 7 } : null;
  }).filter(Boolean);
  const total = spans.reduce((a, s) => a + s.days, 0);
  const active = spans.find((s) => s.key === hover);

  return (
    <div>
      <div role="img" aria-label={`Chronological split. ${spans.map((s) => `${s.label} ${s.start} to ${s.end}`).join('; ')}`} className="flex h-12 rounded-xl overflow-hidden gap-0.5">
        {spans.map((s, i) => (
          <motion.button
            key={s.key} type="button" onMouseEnter={() => setHover(s.key)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(s.key)} onBlur={() => setHover(null)}
            initial={{ flexBasis: 0 }} animate={{ flexBasis: `${(s.days / total) * 100}%` }} transition={{ duration: 0.9, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="grow-0 shrink-0 grid place-items-center text-sm font-bold text-white"
            style={{ background: s.color, opacity: hover && hover !== s.key ? 0.45 : 1 }}
          >
            {s.label}
          </motion.button>
        ))}
      </div>
      <div className="mt-2 flex text-[11px] text-muted gap-0.5">
        {spans.map((s) => (
          <div key={s.key} style={{ flexBasis: `${(s.days / total) * 100}%` }} className="min-w-0">
            <div className="truncate">{fmtDateLong(s.start)}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm min-h-[2.5rem]" aria-live="polite">
        {active ? <><b>{active.label}</b>: {fmtDateLong(active.start)} to {fmtDateLong(active.end)}. {active.note}</> : 'Time flows left to right. The model never sees weeks to the right of the data it trains on.'}
      </p>
    </div>
  );
}

export default memo(SplitTimeline);
