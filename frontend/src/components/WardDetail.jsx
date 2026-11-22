import { AnimatePresence, motion } from 'framer-motion';
import { tierMeta } from '../config';
import DriverBarChart from '../charts/DriverBarChart';
import ForecastBandChart from '../charts/ForecastBandChart';
import LagTimeline from '../charts/LagTimeline';
import { summarize } from '../utils/explain';
import { fmtNum } from '../utils/format';
import AnimatedNumber from './AnimatedNumber';
import GlassCard from './GlassCard';
import Icon from './Icon';
import RiskBadge from './RiskBadge';

export default function WardDetail({ prediction }) {
  if (!prediction) return null;
  const t = tierMeta(prediction.risk_tier);
  const critical = prediction.risk_tier === 'Critical';
  const targetWeek = prediction.forecast?.[prediction.forecast.length - 1]?.week_start;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={prediction.ward_id}
        initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.25 }}
        className="space-y-4"
      >
        <GlassCard className={`p-5 ${critical ? 'glow-border' : ''}`} style={{ '--glow': t.color }} aria-label={`Details for ${prediction.ward_name}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted">Ranked #{prediction.rank} for risk</p>
              <h2 className="font-display text-3xl font-extrabold leading-tight">{prediction.ward_name}</h2>
            </div>
            <div className="text-right">
              <RiskBadge tier={prediction.risk_tier} size="lg" />
              <div className="mt-1 text-sm text-muted">training-target percentile rank <b className="text-ink font-display text-lg"><AnimatedNumber value={prediction.risk_score * 100} digits={1} />%</b></div>
            </div>
          </div>
          <div className="mt-4 rounded-xl p-3.5 flex gap-3" style={{ background: t.soft, boxShadow: `inset 0 0 0 1px ${t.color}55` }}>
            <Icon name={t.icon} size={22} className="shrink-0 mt-0.5" style={{ color: t.color }} />
            <div>
              <div className="text-xs text-muted">Recommended action (based on training-target case percentiles)</div>
              <div className="font-display font-bold text-lg leading-snug">{t.action}</div>
              <div className="text-sm text-muted mt-0.5">{t.detail}</div>
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed">{summarize(prediction)}</p>
          <p className="mt-2 text-xs text-muted">
            Model forecast: <b className="text-ink">{fmtNum(prediction.predicted_cases, 3)}</b> expected cases for the week of {targetWeek}.
            {Number.isFinite(prediction.ci_lower) && Number.isFinite(prediction.ci_upper) && (
              <> 95% interval: <b className="text-ink">{fmtNum(prediction.ci_lower, 3)}–{fmtNum(prediction.ci_upper, 3)}</b>.</>
            )}
          </p>
        </GlassCard>
        <GlassCard className="p-5"><DriverBarChart drivers={prediction.drivers} /></GlassCard>
        <GlassCard className="p-5"><ForecastBandChart forecast={prediction.forecast || []} /></GlassCard>
        {prediction.drivers.some((d) => d.feature.startsWith('rainfall_lag_'))
          && <GlassCard className="p-5"><LagTimeline prediction={prediction} targetWeek={targetWeek} /></GlassCard>}
      </motion.div>
    </AnimatePresence>
  );
}
