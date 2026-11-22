import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import HelpTip from '../components/HelpTip';
import RiskBadge from '../components/RiskBadge';
import { tierMeta } from '../config';
import { driverSentence } from '../utils/explain';
import { fmtDate } from '../utils/format';

const LAGS = [4, 2, 1];

/** Displays only rainfall lag features present in the trained model. */
function LagTimeline({ prediction, targetWeek }) {
  const [hover, setHover] = useState(null);
  const byFeature = Object.fromEntries(prediction.drivers.map((d) => [d.feature, d]));
  const items = LAGS.map((l) => ({ lag: l, d: byFeature[`rainfall_lag_${l}w`] }));
  const have = items.filter((i) => i.d);
  if (!have.length) return null;
  const maxRain = Math.max(120, ...have.map((i) => Number(i.d.value)));
  const maxC = Math.max(0.0001, ...have.map((i) => Math.abs(i.d.contribution)));
  const tier = tierMeta(prediction.risk_tier);
  const target = targetWeek ? new Date(`${targetWeek}T00:00:00Z`) : null;
  const dateFor = (l) => {
    const weeksBeforeTarget = l + (prediction.horizon_weeks || 0);
    return target ? fmtDate(new Date(target.getTime() - weeksBeforeTarget * 7 * 864e5).toISOString().slice(0, 10)) : '';
  };
  const hovered = items.find((i) => i.lag === hover)?.d;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display font-bold text-lg">The breeding clock</h3>
        <HelpTip>
          These are the model&apos;s rainfall lag inputs (1, 2 and 4 weeks before the as-of date). The 2–4 week forecast horizon places the rain-to-target gap roughly 3–8 weeks back. Bars show rainfall values; they are not per-ward attribution strengths.
        </HelpTip>
      </div>
      <div className="grid grid-cols-[repeat(3,minmax(0,1fr))_auto] gap-1 items-end" role="img"
        aria-label={`Rainfall model lag values feeding into a ${prediction.risk_tier} risk. ${have.map((i) => driverSentence(i.d)).join('; ')}`}
      >
        {items.map(({ lag, d }) => {
          const h = d ? Math.max(6, (Number(d.value) / maxRain) * 92) : 6;
          const strength = d ? Math.min(1, Math.abs(d.contribution) / maxC) : 0;
          return (
            <div key={lag} className="flex flex-col items-center" onMouseEnter={() => setHover(lag)} onMouseLeave={() => setHover(null)}>
              <span className="text-xs font-bold tabular-nums mb-1">{d ? `${Math.round(d.value)} mm` : 'n/a'}</span>
              <div className="h-24 w-full flex items-end justify-center">
                <motion.div
                  className="w-8 rounded-t-lg"
                  style={{ background: `rgb(43 125 224 / ${0.35 + strength * 0.65})`, boxShadow: hover === lag ? '0 0 0 2px rgb(var(--lagoon))' : 'none' }}
                  initial={{ height: 0 }} animate={{ height: `${h}%` }} transition={{ duration: 0.8, delay: (4 - lag) * 0.12, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <span className="mt-1 text-xs font-semibold">T−{lag}w</span>
              <span className="text-[10px] text-muted">{dateFor(lag)}</span>
            </div>
          );
        })}
        <div className="flex flex-col items-center pl-1">
          <svg width="46" height="24" viewBox="0 0 46 24" aria-hidden="true" className="mb-6">
            <path d="M2 12h34" stroke={tier.color} strokeWidth="2.5" className="flow" fill="none" />
            <path d="m34 5 9 7-9 7" stroke={tier.color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      <motion.div
        key={prediction.ward_id}
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="mt-1 flex items-center justify-between rounded-xl px-4 py-3" style={{ background: tier.soft, boxShadow: `inset 0 0 0 1px ${tier.color}55` }}
      >
        <div>
          <div className="text-xs text-muted">Predicted risk{target ? `, week of ${fmtDate(targetWeek)}` : ''}</div>
          <div className="font-display text-2xl font-extrabold" style={{ color: tier.color }}>{prediction.risk_score.toFixed(2)}</div>
        </div>
        <RiskBadge tier={prediction.risk_tier} />
      </motion.div>
      <p className="mt-2 text-xs text-muted min-h-[1.25rem]" aria-live="polite">
        {hovered ? driverSentence(hovered) : 'Hover a bar to see how that week’s rain moves the score.'}
      </p>
    </div>
  );
}

export default memo(LagTimeline);
