import { memo, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TIERS, tierMeta, tierRank } from '../config';
import { useDebouncedValue } from '../hooks/useDebounce';
import { downloadCsv } from '../utils/csv';
import { fmtNum } from '../utils/format';
import GlassCard from './GlassCard';
import Icon from './Icon';
import RiskBadge from './RiskBadge';

const COLS = [
  { key: 'rank', label: 'Rank' },
  { key: 'ward_name', label: 'Ward' },
  { key: 'tier', label: 'Tier' },
  { key: 'risk_score', label: 'Case-derived risk index' },
  { key: 'predicted_cases', label: 'Model predicted cases' },
];

function ScoreBar({ score, tier }) {
  const t = tierMeta(tier);
  return (
    <div className="flex items-center gap-2 min-w-[8rem]">
      <div className="relative h-2 flex-1 rounded-full bg-line/70 overflow-hidden">
        <motion.div className="absolute inset-y-0 left-0 rounded-full" style={{ background: t.color }} initial={{ width: 0 }} animate={{ width: `${score * 100}%` }} transition={{ duration: 0.6 }} />
      </div>
      <span className="text-xs font-bold tabular-nums w-10 text-right">{score.toFixed(3)}</span>
    </div>
  );
}

function WardTable({ predictions, selectedId, onSelect, asOf, horizon }) {
  const [search, setSearch] = useState('');
  const [tiers, setTiers] = useState(new Set());
  const [sort, setSort] = useState({ key: 'rank', dir: 'asc' });
  const dsearch = useDebouncedValue(search);

  const rows = useMemo(() => {
    const needle = dsearch.trim().toLowerCase();
    const list = predictions.filter((p) => (!tiers.size || tiers.has(p.risk_tier)) && (!needle || p.ward_name.toLowerCase().includes(needle)));
    const val = (p) => (sort.key === 'tier' ? tierRank(p.risk_tier) : sort.key === 'ward_name' ? p.ward_name : p[sort.key]);
    return [...list].sort((a, b) => {
      const x = val(a); const y = val(b);
      const c = typeof x === 'string' ? x.localeCompare(y) : x - y;
      return sort.dir === 'asc' ? c : -c;
    });
  }, [predictions, dsearch, tiers, sort]);

  const toggleTier = (k) => setTiers((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const onSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'ward_name' ? 'asc' : key === 'rank' ? 'asc' : 'desc' }));

  const exportCsv = () => downloadCsv(`dengue-risk-${asOf}-${horizon}w.csv`, rows, [
    { header: 'rank', value: (r) => r.rank },
    { header: 'ward_id', value: (r) => r.ward_id },
    { header: 'ward_name', value: (r) => r.ward_name },
    { header: 'risk_tier', value: (r) => r.risk_tier },
    { header: 'risk_score', value: (r) => r.risk_score },
    { header: 'predicted_cases', value: (r) => r.predicted_cases },
    { header: 'forecast_date', value: (r) => r.forecast?.[0]?.week_start },
  ]);

  return (
    <GlassCard className="p-4" spotlight={false} aria-label="Ranked wards">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <h2 className="font-display font-bold text-lg mr-auto">Ranked wards <span className="text-muted font-sans text-sm font-medium">({rows.length})</span></h2>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by tier">
          {TIERS.slice().reverse().map((t) => {
            const on = tiers.has(t.key);
            return (
              <button
                key={t.key} type="button" aria-pressed={on} onClick={() => toggleTier(t.key)}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition-colors"
                style={{ background: on ? t.color : t.soft, color: on ? '#fff' : t.color, boxShadow: `inset 0 0 0 1px ${t.color}66` }}
              >
                <Icon name={t.icon} size={12} strokeWidth={2.4} /> {t.key}
              </button>
            );
          })}
        </div>
        <div className="relative">
          <Icon name="search" size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ward" aria-label="Search wards in table"
            className="rounded-xl bg-raised border border-line pl-8 pr-3 py-1.5 text-sm w-40"
          />
        </div>
        <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-xl bg-raised border border-line px-3 py-1.5 text-sm font-semibold hover:bg-line/50">
          <Icon name="download" size={15} /> Export CSV
        </button>
      </div>
      <div className="max-h-[420px] overflow-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface z-10">
            <tr className="text-left text-xs text-muted">
              {COLS.map((c) => (
                <th key={c.key} scope="col" aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className="px-3 py-2 font-semibold">
                  <button type="button" onClick={() => onSort(c.key)} className="inline-flex items-center gap-1 hover:text-ink">
                    {c.label}
                    {sort.key === c.key && <Icon name={sort.dir === 'asc' ? 'up' : 'down'} size={12} />}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {rows.map((p) => {
                const sel = p.ward_id === selectedId;
                return (
                  <motion.tr
                    layout="position" key={p.ward_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    tabIndex={0} role="button" aria-pressed={sel} aria-label={`${p.ward_name}, rank ${p.rank}, ${p.risk_tier}, score ${p.risk_score}`}
                    onClick={() => onSelect(p.ward_id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(p.ward_id); } }}
                    className={`cursor-pointer border-t border-line/60 hover:bg-lagoon/10 ${sel ? 'bg-lagoon/15' : ''}`}
                  >
                    <td className="px-3 py-2 tabular-nums text-muted">{p.rank}</td>
                    <td className="px-3 py-2 font-semibold whitespace-nowrap">{p.ward_name}</td>
                    <td className="px-3 py-2"><RiskBadge tier={p.risk_tier} size="sm" /></td>
                    <td className="px-3 py-2"><ScoreBar score={p.risk_score} tier={p.risk_tier} /></td>
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                      <b>{fmtNum(p.predicted_cases, 3)}</b>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-6 text-center text-sm text-muted">No wards match these filters. Clear the tier chips or the search.</p>}
      </div>
    </GlassCard>
  );
}

export default memo(WardTable);
