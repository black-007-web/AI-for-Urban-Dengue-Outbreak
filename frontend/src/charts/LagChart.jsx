import { memo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { chartColors, useTheme } from '../hooks/useTheme';
import { fmtDate } from '../utils/format';

const LAGS = [
  { key: 'rainfall_lag_1w', label: 'Lag 1 week', color: '#38bdf8', width: 1.8 },
  { key: 'rainfall_lag_2w', label: 'Lag 2 weeks', color: '#818cf8', width: 1.8 },
  { key: 'rainfall_lag_4w', label: 'Lag 4 weeks', color: '#fb923c', width: 1.8 },
  { key: 'rainfall_rolling_mean_4w', label: '4-week mean', color: '#f472b6', width: 1.8 },
  { key: 'rainfall_rolling_mean_8w', label: '8-week mean', color: '#a3e635', width: 1.8 },
];

/** Toggle each lag on and off to see the same rainfall shifted later in time. */
function LagChart({ series }) {
  const { theme } = useTheme();
  const c = chartColors(theme);
  const [on, setOn] = useState(() => new Set(['rainfall_lag_1w', 'rainfall_lag_4w']));
  const toggle = (k) => setOn((s) => { const n = new Set(s); if (n.has(k) && n.size > 1) n.delete(k); else n.add(k); return n; });
  const data = series.map((s) => ({ ...s, label: fmtDate(s.week_start, { day: 'numeric', month: 'short' }) }));

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-3" role="group" aria-label="Show or hide lagged rainfall lines">
        {LAGS.map((l) => {
          const col = l.color === 'text' ? c.text : l.color;
          const active = on.has(l.key);
          return (
            <button
              key={l.key} type="button" aria-pressed={active} onClick={() => toggle(l.key)}
              className="rounded-full px-3 py-1 text-xs font-bold transition-all"
              style={{ background: active ? col : 'transparent', color: active ? (theme === 'dark' && l.color === 'text' ? '#06151c' : '#fff') : col, boxShadow: `inset 0 0 0 1.5px ${col}` }}
            >
              {l.label}
            </button>
          );
        })}
      </div>
      <div role="img" aria-label="Rainfall model inputs: 1, 2 and 4 week lags, and 4 and 8 week rolling means, in millimetres" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 14, left: 0, bottom: 22 }}>
            <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" stroke={c.axis} fontSize={11} minTickGap={34} tickLine={false} label={{ value: 'Week starting', position: 'insideBottom', offset: -14, fill: c.axis, fontSize: 11 }} />
            <YAxis stroke={c.axis} fontSize={11} width={46} tickLine={false} label={{ value: 'Rainfall (mm)', angle: -90, position: 'insideLeft', fill: c.axis, fontSize: 11 }} />
            <Tooltip contentStyle={{ background: c.surface, border: `1px solid ${c.grid}`, borderRadius: 12, fontSize: 12, color: c.text }} formatter={(v, n) => [`${v} mm`, n]} labelFormatter={(l) => `Week of ${l}`} />
            {LAGS.filter((l) => on.has(l.key)).map((l) => (
              <Line key={l.key} name={l.label} type="monotone" dataKey={l.key} stroke={l.color === 'text' ? c.text : l.color} strokeWidth={l.width} dot={false} animationDuration={600} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default memo(LagChart);
