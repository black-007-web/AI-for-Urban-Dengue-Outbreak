import { memo } from 'react';
import { Area, Bar, Brush, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { chartColors, useTheme } from '../hooks/useTheme';
import { fmtDate } from '../utils/format';

const PANELS = [
  { key: 'rainfall_mm', title: 'Weekly rainfall', unit: 'mm', color: 'blue', kind: 'bar' },
  { key: 'avg_temp_C', title: 'Average temperature', unit: '°C', color: 'coral', kind: 'line' },
  { key: 'relative_humidity_pct', title: 'Relative humidity', unit: '%', color: 'lagoon', kind: 'area' },
];

/** Three small multiples that share one hover cursor (syncId) and one zoom brush. */
function WeatherChart({ series }) {
  const { theme } = useTheme();
  const c = chartColors(theme);
  const data = series.map((s) => ({ ...s, label: fmtDate(s.week_start, { day: 'numeric', month: 'short', year: '2-digit' }) }));
  const tip = (unit) => ({ contentStyle: { background: c.surface, border: `1px solid ${c.grid}`, borderRadius: 12, fontSize: 12, color: c.text }, formatter: (v) => [`${v} ${unit}`], labelFormatter: (l) => `Week of ${l}` });

  return (
    <div className="space-y-1">
      {PANELS.map((p, i) => (
        <div key={p.key} role="img" aria-label={`${p.title} in ${p.unit} by week`}>
          <div className="text-sm font-semibold px-1">{p.title} <span className="text-muted font-normal">({p.unit})</span></div>
          <ResponsiveContainer width="100%" height={i === 0 ? 170 : 130}>
            <ComposedChart data={data} syncId="weather" margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" hide={i < 2} stroke={c.axis} fontSize={11} minTickGap={36} tickLine={false} label={i === 2 ? { value: 'Week starting', position: 'insideBottom', offset: 4, fill: c.axis, fontSize: 11 } : undefined} height={i === 2 ? 34 : 0} />
              <YAxis stroke={c.axis} fontSize={11} width={44} tickLine={false} domain={p.key === 'rainfall_mm' ? [0, 'auto'] : ['auto', 'auto']} label={{ value: p.unit, angle: -90, position: 'insideLeft', fill: c.axis, fontSize: 11 }} />
              <Tooltip {...tip(p.unit)} />
              {p.kind === 'bar' && <Bar dataKey={p.key} fill={c[p.color]} radius={[3, 3, 0, 0]} animationDuration={700} />}
              {p.kind === 'line' && <Line type="monotone" dataKey={p.key} stroke={c[p.color]} strokeWidth={2.2} dot={false} animationDuration={700} />}
              {p.kind === 'area' && <Area type="monotone" dataKey={p.key} stroke={c[p.color]} fill={c[p.color]} fillOpacity={0.2} strokeWidth={2} animationDuration={700} />}
              {i === 2 && <Brush dataKey="label" height={20} y={undefined} stroke={c.lagoon} fill="transparent" travellerWidth={8} tickFormatter={() => ''} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  );
}

export default memo(WeatherChart);
