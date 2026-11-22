import { useMemo } from 'react';
import { motion } from 'framer-motion';
import AnimatedNumber from '../components/AnimatedNumber';
import ControlBar from '../components/ControlBar';
import ErrorState from '../components/ErrorState';
import KpiCard from '../components/KpiCard';
import MapPanel from '../components/MapPanel';
import { CardSkeleton, Skeleton } from '../components/Skeleton';
import WardDetail from '../components/WardDetail';
import WardTable from '../components/WardTable';
import { tierMeta } from '../config';
import { useApp } from '../context/AppContext';
import { fmtDateLong } from '../utils/format';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } } };

export default function Dashboard() {
  const app = useApp();
  const { predictions, selected, setWardId, meta, predError, predLoading, retry, predCached, predMock, asOf, horizon, whatIf } = app;

  const kpi = useMemo(() => ({
    critical: predictions.filter((p) => p.risk_tier === 'Critical').length,
    high: predictions.filter((p) => p.risk_tier === 'High').length,
    cases: predictions.reduce((s, p) => s + p.predicted_cases, 0),
    top: predictions[0],
  }), [predictions]);

  if (predError && !predictions.length) {
    return (
      <div className="space-y-4">
        <ControlBar />
        <ErrorState title="Could not load risk predictions" message={predError.message} onRetry={retry} />
      </div>
    );
  }

  const loadingFirst = !predictions.length;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
      <motion.div variants={item}><ControlBar /></motion.div>

      {meta?.data_as_of_date && (
        <motion.p variants={item} role="note" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-muted">
          Forecast inputs use observed data through {fmtDateLong(meta.data_as_of_date)}. No live 2026 surveillance feed is connected.
        </motion.p>
      )}

      {predError && <ErrorState title="Refresh failed" message={`${predError.message}. Showing the last successful result.`} onRetry={retry} />}

      <motion.div variants={item} className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        {loadingFirst ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[104px]" />) : (
          <>
            <KpiCard label="Critical wards" icon="siren" accent={tierMeta('Critical').color} glow={kpi.critical > 0} sub="Act within 7 days">
              <AnimatedNumber value={kpi.critical} />
            </KpiCard>
            <KpiCard label="High-risk wards" icon="alert" accent={tierMeta('High').color} sub="Larvicide within 14 days">
              <AnimatedNumber value={kpi.high} />
            </KpiCard>
            <KpiCard label="Highest training-target percentile rank" icon="map" onClick={() => kpi.top && setWardId(kpi.top.ward_id)} sub={kpi.top ? `${(kpi.top.risk_score * 100).toFixed(1)}th percentile · click to inspect` : ''}>
              <span className="text-2xl">{kpi.top?.ward_name}</span>
            </KpiCard>
            <KpiCard label={`Expected cases at ${horizon}-week horizon`} icon="droplet" sub="Sum across wards; fractional values are expected cases">
              <AnimatedNumber value={kpi.cases} digits={2} />
            </KpiCard>
            <KpiCard label="Model" icon="layers" sub={`Surveillance through ${fmtDateLong(meta?.data_as_of_date || meta?.as_of_date || asOf)}${predCached ? ' · cached' : ''}`}>
              <span className="text-xl">{meta?.model_version || '–'}</span>
            </KpiCard>
          </>
        )}
      </motion.div>

      {(predMock || whatIf || predCached) && (
        <motion.div variants={item} className="flex flex-wrap gap-2 text-xs">
          {predMock && <span className="rounded-full px-2.5 py-1 font-semibold" style={{ background: '#e0a71026', color: '#c98f00' }}>Generated demo data. Not a real prediction.</span>}
          {whatIf && <span className="rounded-full px-2.5 py-1 font-semibold bg-lagoon/15 text-lagoon">What-if weather applied: {whatIf.rainfall_mm} mm, {whatIf.avg_temp_C} °C, {whatIf.relative_humidity_pct}%</span>}
          {predCached && <span className="rounded-full px-2.5 py-1 font-semibold bg-raised text-muted" title="Served from the in-browser cache, no network request">Cached response</span>}
        </motion.div>
      )}

      <div className="grid gap-4 xl:grid-cols-12 items-start">
        <div className="xl:col-span-7 space-y-4 min-w-0">
          <motion.div variants={item}>{loadingFirst ? <CardSkeleton height={430} label="Loading map" /> : <MapPanel />}</motion.div>
          <motion.div variants={item}>
            {loadingFirst ? <CardSkeleton height={360} label="Loading table" /> : (
              <WardTable predictions={predictions} selectedId={selected?.ward_id} onSelect={setWardId} asOf={asOf} horizon={horizon} />
            )}
          </motion.div>
        </div>
        <motion.div variants={item} className="xl:col-span-5 min-w-0">
          {loadingFirst ? <CardSkeleton height={640} label="Loading ward details" /> : <WardDetail prediction={selected} />}
        </motion.div>
      </div>
      {predLoading && !loadingFirst && <span className="sr-only" role="status">Updating predictions</span>}
      <p className="text-center text-xs text-muted pb-4">
        Live tiers use H{horizon} training-target case percentiles (p50/p80/p95), not an ML probability.
        {meta?.risk_thresholds?.training_percentiles && ` Thresholds: ${meta.risk_thresholds.training_percentiles.p50}, ${meta.risk_thresholds.training_percentiles.p80}, ${meta.risk_thresholds.training_percentiles.p95} cases.`}
      </p>
    </motion.div>
  );
}
