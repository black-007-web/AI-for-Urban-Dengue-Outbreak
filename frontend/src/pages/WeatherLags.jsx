import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import LagChart from '../charts/LagChart';
import WeatherChart from '../charts/WeatherChart';
import ControlBar from '../components/ControlBar';
import ErrorState from '../components/ErrorState';
import GlassCard from '../components/GlassCard';
import HelpTip from '../components/HelpTip';
import Icon from '../components/Icon';
import Segmented from '../components/Segmented';
import { CardSkeleton } from '../components/Skeleton';
import { useApp } from '../context/AppContext';
import { useResource } from '../hooks/useResource';
import { getWeather } from '../services/api';
import { downloadCsv } from '../utils/csv';
import { fmtDate } from '../utils/format';

const COLUMNS = [
  { header: 'week_start', value: (r) => r.week_start },
  { header: 'rainfall_mm', value: (r) => r.rainfall_mm },
  { header: 'rainfall_lag_1w', value: (r) => r.rainfall_lag_1w },
  { header: 'rainfall_lag_2w', value: (r) => r.rainfall_lag_2w },
  { header: 'rainfall_lag_4w', value: (r) => r.rainfall_lag_4w },
  { header: 'rainfall_rolling_mean_4w', value: (r) => r.rainfall_rolling_mean_4w },
  { header: 'rainfall_rolling_mean_8w', value: (r) => r.rainfall_rolling_mean_8w },
  { header: 'avg_temp_C', value: (r) => r.avg_temp_C },
  { header: 'relative_humidity_pct', value: (r) => r.relative_humidity_pct },
];

export default function WeatherLags() {
  const { city, wardId, asOf, wardsById } = useApp();
  const [weeks, setWeeks] = useState(52);
  const params = wardId !== 'all' ? { ward_id: wardId } : { city };
  const res = useResource(
    (signal, force) => getWeather({ ...params, weeks, as_of: asOf }, { signal, force }),
    [city, wardId, weeks, asOf], { enabled: !!city },
  );
  const series = useMemo(() => res.data?.series || [], [res.data]);
  const scope = wardId !== 'all' ? wardsById[wardId]?.ward_name || wardId : `${city ? city[0].toUpperCase() + city.slice(1) : ''} (city average)`;
  const latest = useMemo(() => series.slice(-12).reverse(), [series]);

  return (
    <div className="space-y-4">
      <ControlBar variant="compact" />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-extrabold mr-auto">Weather and lags <span className="text-muted text-lg font-semibold">· {scope}</span></h1>
        <Segmented label="History length in weeks" value={weeks} onChange={setWeeks} options={[{ value: 26, label: '26 wks' }, { value: 52, label: '1 yr' }, { value: 104, label: '2 yrs' }]} />
        {res.mock && <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: '#e0a71026', color: '#c98f00' }}>Generated demo data</span>}
        {res.cached && <span className="rounded-full px-2.5 py-1 text-xs font-semibold bg-raised text-muted">Cached</span>}
      </div>

      {res.error && <ErrorState title="Could not load weather" message={res.error.message} onRetry={res.retry} />}
      {res.loading && !series.length && <CardSkeleton height={420} label="Loading weather" />}

      {series.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 xl:grid-cols-2">
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display font-bold text-lg">Weather history</h2>
              <HelpTip>Hover any chart: the cursor is shared across all three. Drag the handles under the humidity chart to zoom into a period.</HelpTip>
            </div>
            <WeatherChart series={series} />
          </GlassCard>
          <div className="space-y-4">
            <GlassCard className="p-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-display font-bold text-lg">Rainfall and its lags</h2>
                <HelpTip>The chart shows only the model&apos;s rainfall inputs: lags of 1, 2 and 4 weeks, plus 4- and 8-week rolling means that exclude the as-of week. Combined with the 2–4 week forecast horizon, the input-to-target gap spans roughly 3–8 weeks.</HelpTip>
              </div>
              <LagChart series={series} />
            </GlassCard>
            <GlassCard className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-bold text-lg">Computed lag features (latest 12 weeks)</h2>
                <button type="button" onClick={() => downloadCsv(`weather-lags-${wardId !== 'all' ? wardId : city}-${asOf}.csv`, series, COLUMNS)} className="inline-flex items-center gap-1.5 rounded-xl bg-raised border border-line px-3 py-1.5 text-sm font-semibold hover:bg-line/50">
                  <Icon name="download" size={15} /> CSV
                </button>
              </div>
              <div className="overflow-auto max-h-72 rounded-xl border border-line">
                <table className="w-full text-sm tabular-nums">
                  <thead className="sticky top-0 bg-surface text-xs text-muted">
                    <tr>{['Week', 'Rain (mm)', 'Lag 1w', 'Lag 2w', 'Lag 4w', 'Mean 4w', 'Mean 8w', '°C', 'RH %'].map((h) => <th key={h} scope="col" className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {latest.map((r) => (
                      <tr key={r.week_start} className="border-t border-line/60">
                        <td className="px-3 py-1.5 whitespace-nowrap">{fmtDate(r.week_start)}</td>
                        <td className="px-3 py-1.5 font-semibold">{r.rainfall_mm}</td>
                        <td className="px-3 py-1.5">{r.rainfall_lag_1w}</td><td className="px-3 py-1.5">{r.rainfall_lag_2w}</td>
                        <td className="px-3 py-1.5">{r.rainfall_lag_4w}</td>
                        <td className="px-3 py-1.5">{r.rainfall_rolling_mean_4w}</td><td className="px-3 py-1.5">{r.rainfall_rolling_mean_8w}</td>
                        <td className="px-3 py-1.5">{r.avg_temp_C}</td><td className="px-3 py-1.5">{r.relative_humidity_pct}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </div>
        </motion.div>
      )}
    </div>
  );
}
