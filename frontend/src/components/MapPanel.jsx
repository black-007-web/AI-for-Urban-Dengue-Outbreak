import { useMemo } from 'react';
import { TIERS } from '../config';
import { useApp } from '../context/AppContext';
import { fmtDate } from '../utils/format';
import GlassCard from './GlassCard';
import HelpTip from './HelpTip';
import Icon from './Icon';
import WardMap from './WardMap';

export default function MapPanel() {
  const { predictions, selected, setWardId, city, geojson, horizon, predLoading } = useApp();

  const items = useMemo(() => predictions.filter((p) => p.ward).map((p) => {
    const score = p.risk_score;
    return {
      ward_id: p.ward_id, ward_name: p.ward_name, lat: p.ward.lat, lon: p.ward.lon,
      score, tier: p.risk_tier,
    };
  }), [predictions]);

  const counts = useMemo(() => Object.fromEntries(TIERS.map((t) => [t.key, items.filter((i) => i.tier === t.key).length])), [items]);
  const weekLabel = predictions[0]?.forecast?.[0]?.week_start;
  const sr = TIERS.slice().reverse().map((t) => `${counts[t.key]} ${t.key}`).join(', ');

  return (
    <GlassCard className="p-0 overflow-hidden" spotlight={false} aria-label="Ward risk heatmap">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <h2 className="font-display font-bold text-lg">Ward risk map</h2>
        <HelpTip>
          Each circle is a ward, coloured by the empirical percentile rank of its case forecast against training targets. The case forecast comes from the selected horizon&apos;s trained model. Ward locations are approximate centroids because the workbook has no ward coordinates.
        </HelpTip>
      </div>
      <div className="relative h-[430px] mx-3 rounded-xl overflow-hidden border border-line" role="region" aria-label={`Map of ward risk tiers. ${sr}.`}>
        {items.length > 0 && <WardMap items={items} geojson={geojson} selectedId={selected?.ward_id} onSelect={setWardId} cityKey={city} />}
        {predLoading && <div className="absolute inset-0 z-[500] grid place-items-center bg-canvas/40 backdrop-blur-[1px]" role="status"><span className="text-sm font-semibold">Updating risk…</span></div>}
        <div className="absolute z-[500] left-3 bottom-3 glass rounded-xl p-2.5 text-xs space-y-1" aria-hidden="true">
          {TIERS.slice().reverse().map((t) => (
            <div key={t.key} className="flex items-center gap-2">
              <span className="grid place-items-center size-5 rounded-full" style={{ background: t.color, color: '#fff' }}><Icon name={t.icon} size={12} strokeWidth={2.6} /></span>
              <span className="font-semibold w-14">{t.key}</span><span className="tabular-nums text-muted">{counts[t.key]}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between px-4 py-3 text-sm">
        <span className="text-muted">H{horizon} model target</span>
        <span className="font-display font-bold">{weekLabel ? `Week of ${fmtDate(weekLabel)}` : '–'}</span>
      </div>
    </GlassCard>
  );
}
