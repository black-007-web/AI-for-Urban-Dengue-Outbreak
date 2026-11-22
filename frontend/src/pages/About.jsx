import { motion } from 'framer-motion';
import AnimatedNumber from '../components/AnimatedNumber';
import GlassCard from '../components/GlassCard';
import Icon from '../components/Icon';
import { API_BASE_URL, CACHE_TTL_MS, DEBOUNCE_MS } from '../config';
import { useApiStatus, useCacheStats } from '../hooks/useApiStatus';
import { clearCache } from '../services/cache';
import { ENDPOINTS } from '../services/api';

const FLOW = [
  { icon: 'cloud', title: 'Weather and ward data', text: 'Rainfall, temperature, humidity plus drainage, density and sanitation per ward.' },
  { icon: 'layers', title: 'Lag engine', text: 'Backend builds notebook-aligned 49-feature inputs, including weather lags 1, 2 and 4 and 4/8-week rolling means.' },
  { icon: 'bolt', title: 'Trained model', text: 'A serialized model scores each ward. Loaded once, not retrained per request.' },
  { icon: 'siren', title: 'Risk tiers', text: 'Predicted cases map to Low, Medium, High or Critical using training-target percentiles.' },
  { icon: 'map', title: 'This dashboard', text: 'Map, ranking and model-specific forecast intervals; locations are approximate and local drivers are not fabricated.' },
];

const COST = [
  ['Response cache', `GET and predict responses are kept in memory for ${Math.round(CACHE_TTL_MS / 60000)} minutes, keyed by their parameters, and mirrored to sessionStorage.`],
  ['Request de-duplication', 'Identical requests that are in flight at the same moment share a single network call.'],
  ['Abort stale requests', 'Changing a control cancels the previous request with AbortController so old answers never overwrite new ones.'],
  ['Debounced inputs', `Search boxes and sliders wait ${DEBOUNCE_MS} ms. Prediction runs only when a main control changes or you press Run prediction.`],
  ['Lazy-loaded pages', 'Each page is a separate code chunk, loaded when you open it.'],
  ['No paid services', 'No API keys, no LLM calls and no paid map services. Map tiles come from OpenStreetMap.'],
];

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-xl bg-raised p-3" title={hint}>
      <div className="font-display text-3xl font-extrabold"><AnimatedNumber value={value} /></div>
      <div className="text-xs text-muted mt-0.5">{label}</div>
    </div>
  );
}

export default function About() {
  const stats = useCacheStats();
  const status = useApiStatus();
  const saved = stats.hits + stats.deduped;

  return (
    <div className="space-y-4 max-w-6xl">
      <h1 className="font-display text-3xl font-extrabold">About and cost controls</h1>

      <GlassCard className="p-5">
        <h2 className="font-display font-bold text-lg mb-4">How data flows</h2>
        <ol className="grid gap-3 md:grid-cols-5">
          {FLOW.map((f, i) => (
            <motion.li key={f.title} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12 }} className="relative rounded-xl bg-raised p-4">
              <div className="grid place-items-center size-9 rounded-lg bg-lagoon/15 text-lagoon mb-2"><Icon name={f.icon} /></div>
              <div className="font-display font-bold leading-tight">{f.title}</div>
              <p className="text-xs text-muted mt-1 leading-relaxed">{f.text}</p>
              {i < FLOW.length - 1 && (
                <svg className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 z-10" width="24" height="16" viewBox="0 0 24 16" aria-hidden="true">
                  <path d="M0 8h18" stroke="rgb(var(--lagoon))" strokeWidth="2" className="flow" fill="none" />
                  <path d="m15 3 6 5-6 5" stroke="rgb(var(--lagoon))" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </motion.li>
          ))}
        </ol>
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="p-5">
          <h2 className="font-display font-bold text-lg mb-3">Cost controls in this UI</h2>
          <dl className="space-y-3">
            {COST.map(([t, d]) => (
              <div key={t}><dt className="font-semibold text-sm">{t}</dt><dd className="text-sm text-muted leading-relaxed">{d}</dd></div>
            ))}
          </dl>
        </GlassCard>
        <GlassCard className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-lg">Live request savings</h2>
            <button type="button" onClick={clearCache} className="text-xs font-semibold rounded-lg bg-raised border border-line px-2.5 py-1 hover:bg-line/50">Clear cache</button>
          </div>
          <div className="grid grid-cols-2 gap-3" role="status" aria-live="polite">
            <Stat label="Network calls made" value={stats.network} />
            <Stat label="Served from cache" value={stats.hits} />
            <Stat label="Shared in-flight calls" value={stats.deduped} />
            <Stat label="Stale requests aborted" value={stats.aborted} />
          </div>
          <p className="mt-3 text-sm text-muted">{saved} request{saved === 1 ? '' : 's'} avoided this session. Navigate between cities and dates, then come back to see the numbers grow.</p>
          <p className="mt-3 text-xs text-muted">Data source: {status.mock ? 'built-in generated demo data (no backend calls are made)' : API_BASE_URL}</p>
        </GlassCard>
      </div>

      <GlassCard className="p-5">
        <h2 className="font-display font-bold text-lg mb-3">API endpoints the dashboard expects</h2>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(ENDPOINTS).map(([k, path]) => (
                <tr key={k} className="border-t border-line/60 first:border-0"><td className="py-1.5 pr-4 font-semibold">{k}</td><td className="py-1.5 text-muted">{path}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <h2 className="font-display font-bold text-lg mb-2">AI assistants used</h2>
        <p className="text-sm text-muted">Disclosure for the hackathon submission:</p>
        <p className="mt-2 rounded-xl border border-dashed border-line bg-raised p-3 text-sm font-semibold">{'{{AI_DISCLOSURE}}'}</p>
      </GlassCard>
    </div>
  );
}
