import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import HelpTip from '../components/HelpTip';
import { driverSentence, driverValue } from '../utils/explain';

const UP = 'linear-gradient(90deg, #f0742a, #e11d48)';
const DOWN = 'linear-gradient(270deg, #2b9cd8, #1fb5a8)';

/** Diverging bars: right pushes risk up, left pulls it down. Handles positive and negative SHAP-style values. */
function DriverBarChart({ drivers, limit = 7 }) {
  const [hover, setHover] = useState(null);
  const rows = [...drivers].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, limit);
  const max = Math.max(0.0001, ...rows.map((r) => Math.abs(r.contribution)));
  const summary = rows.map(driverSentence).join('; ');

  if (!rows.length) {
    return (
      <div>
        <h3 className="font-display font-bold text-lg">Feature attribution</h3>
        <p className="mt-2 text-sm text-muted">No per-ward attribution is available from the exported artifact. Global test-set importance is shown on the Model performance page; this dashboard does not invent local contributions.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display font-bold text-lg">Why this score</h3>
        <HelpTip>
          Each bar is one factor. Bars to the right push this ward’s risk <b>up</b>, bars to the left pull it <b>down</b>, compared with an average ward.
          Longer bar means a bigger effect. Units are score points (0 to 1).
        </HelpTip>
      </div>
      <ul role="img" aria-label={`Risk drivers. ${summary}`} className="space-y-1.5" onMouseLeave={() => setHover(null)}>
        {rows.map((d, i) => {
          const up = d.contribution >= 0;
          const w = (Math.abs(d.contribution) / max) * 34;
          const dim = hover !== null && hover !== d.feature;
          return (
            <li
              key={d.feature} onMouseEnter={() => setHover(d.feature)}
              className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 items-center rounded-lg px-1 py-1 transition-opacity ${dim ? 'opacity-40' : ''}`}
            >
              <span className="text-[13px] leading-tight">
                <span className="font-semibold">{d.label}: {driverValue(d)}</span>
                <span className={`block text-xs ${up ? 'text-coral' : 'text-lagoon'}`}>{up ? 'raises risk' : 'lowers risk'}</span>
              </span>
              <span className="relative h-6 block">
                <span className="absolute left-1/2 top-0 bottom-0 w-px bg-line" />
                <motion.span
                  className="absolute top-1 bottom-1 rounded-full"
                  style={{ background: up ? UP : DOWN, [up ? 'left' : 'right']: '50%' }}
                  initial={{ width: 0 }} animate={{ width: `${w}%` }}
                  transition={{ duration: 0.7, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                />
                <span
                  className="absolute top-0 text-[11px] font-bold tabular-nums leading-6"
                  style={{ [up ? 'left' : 'right']: `calc(50% + ${w}% + 6px)` }}
                >
                  {up ? '+' : '−'}{Math.abs(d.contribution).toFixed(2)}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 flex justify-between text-[11px] text-muted px-1">
        <span>← lowers risk</span><span>contribution to risk score</span><span>raises risk →</span>
      </div>
    </div>
  );
}

export default memo(DriverBarChart);
