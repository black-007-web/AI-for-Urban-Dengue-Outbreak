import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import ActualVsPredicted from '../charts/ActualVsPredicted';
import ImportanceChart from '../charts/ImportanceChart';
import ResidualsChart from '../charts/ResidualsChart';
import SplitTimeline from '../charts/SplitTimeline';
import AnimatedNumber from '../components/AnimatedNumber';
import ErrorState from '../components/ErrorState';
import GlassCard from '../components/GlassCard';
import HelpTip from '../components/HelpTip';
import RiskBadge from '../components/RiskBadge';
import Segmented from '../components/Segmented';
import { CardSkeleton } from '../components/Skeleton';
import { useResource } from '../hooks/useResource';
import { getImportance, getMetrics } from '../services/api';
import { fmtNum } from '../utils/format';

const METRIC_HELP = {
  mae: 'Mean absolute error: the average miss, in cases per week. Lower is better.',
  rmse: 'Root mean squared error: like MAE but punishes big misses harder, so it shows how badly the worst weeks were missed.',
  r2: 'R squared: the share of week-to-week variation the model explains. 1 is perfect, 0 is no better than predicting the average.',
};

function Metric({ label, value, digits, help, delay }) {
  return (
    <GlassCard className="p-4" as="div">
      <div className="flex items-center justify-between text-sm text-muted">{label}<HelpTip title={label}>{help}</HelpTip></div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className="mt-1 font-display text-4xl font-extrabold">
        {value == null ? '–' : <AnimatedNumber value={value} digits={digits} />}
      </motion.div>
    </GlassCard>
  );
}

export default function ModelPerformance() {
  const m = useResource((signal, force) => getMetrics({ signal, force }), []);
  const imp = useResource((signal, force) => getImportance({ signal, force }), []);
  const [which, setWhich] = useState('test');

  const d = m.data;
  const scores = d?.metrics_by_split?.[which] || d?.metrics;
  const shown = useMemo(() => {
    const all = d?.series || [];
    const f = all.filter((s) => s.split === which);
    return f.length ? f : all;
  }, [d, which]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-extrabold mr-auto">Model performance</h1>
        {d?.metrics_by_split && (
          <Segmented label="Which period to score" value={which} onChange={setWhich} options={[{ value: 'validation', label: 'Validation' }, { value: 'test', label: 'Test' }]} />
        )}
        {m.mock && <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: '#e0a71026', color: '#c98f00' }}>Generated demo data. These are not real model scores.</span>}
      </div>

      {m.error && <ErrorState title="Could not load model metrics" message={m.error.message} onRetry={m.retry} />}
      {m.loading && !d && <CardSkeleton height={380} label="Loading metrics" />}

      {d && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="MAE (cases/week)" value={scores?.mae} digits={2} help={METRIC_HELP.mae} delay={0} />
            <Metric label="RMSE (cases/week)" value={scores?.rmse} digits={2} help={METRIC_HELP.rmse} delay={0.08} />
            <Metric label="R²" value={scores?.r2} digits={3} help={METRIC_HELP.r2} delay={0.16} />
          </div>

          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-bold text-lg">Chronological split</h2>
              <HelpTip>Random splits would let the model peek at the future. Here training weeks always come before validation weeks, which come before test weeks.</HelpTip>
            </div>
            <SplitTimeline split={d.split} />
          </GlassCard>

          <div className="grid gap-4 xl:grid-cols-2">
            <GlassCard className="p-5">
              <h2 className="font-display font-bold text-lg mb-2">Actual vs predicted cases</h2>
              <ActualVsPredicted series={d.series} />
            </GlassCard>
            <GlassCard className="p-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-display font-bold text-lg">Error by week</h2>
                <HelpTip>Orange bars: the model predicted too many cases. Blue bars: it predicted too few. Dashed lines mark the average miss (MAE).</HelpTip>
              </div>
              <ResidualsChart series={shown} mae={scores?.mae} />
            </GlassCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <GlassCard className="p-5">
              <h2 className="font-display font-bold text-lg mb-3">Global feature importance</h2>
              {imp.error && <ErrorState title="Could not load importance" message={imp.error.message} onRetry={imp.retry} />}
              {imp.loading && !imp.data && <CardSkeleton height={240} />}
              {imp.data && (
                <>
                  <p className="text-xs text-muted mb-3">
                    H3 permutation importance recomputed on {imp.data.split || 'the held-out test'} set
                    {imp.data.sample_count ? ` (${imp.data.sample_count} samples)` : ''}. These are global effects, not per-ward explanations.
                  </p>
                  <ImportanceChart items={imp.data.items || imp.data} />
                </>
              )}
            </GlassCard>
            <div className="space-y-4">
              {d.per_tier?.length > 0 && (
                <GlassCard className="p-5">
                  <h2 className="font-display font-bold text-lg mb-3">Precision and recall by tier</h2>
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted text-left"><tr><th className="py-1 font-semibold">Tier</th><th className="font-semibold">Precision</th><th className="font-semibold">Recall</th><th className="font-semibold">Weeks</th></tr></thead>
                    <tbody>
                      {d.per_tier.map((r) => (
                        <tr key={r.tier} className="border-t border-line/60">
                          <td className="py-2"><RiskBadge tier={r.tier} size="sm" /></td>
                          <td className="tabular-nums">{r.precision == null ? '–' : fmtNum(r.precision, 2)}</td>
                          <td className="tabular-nums">{r.recall == null ? '–' : fmtNum(r.recall, 2)}</td>
                          <td className="tabular-nums text-muted">{r.support ?? '–'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </GlassCard>
              )}
              <GlassCard className="p-5">
                <h2 className="font-display font-bold text-lg mb-1">Model notes</h2>
                <p className="text-sm font-semibold">{d.model_name}</p>
                <p className="text-sm text-muted mt-2 leading-relaxed">{d.notes}</p>
              </GlassCard>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
