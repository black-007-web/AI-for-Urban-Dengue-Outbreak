import { memo, useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { chartColors, useTheme } from '../hooks/useTheme';
import { fmtDate } from '../utils/format';

/** Error per week = predicted minus actual. Above zero: over-predicted. Below: under-predicted (missed cases). */
function ResidualsChart({ series, mae }) {
  const { theme } = useTheme();
  const c = chartColors(theme);
  const data = useMemo(() => series.map((s) => ({ label: fmtDate(s.week_start, { day: 'numeric', month: 'short', year: '2-digit' }), error: Math.round((s.predicted - s.actual) * 10) / 10 })), [series]);
  return (
    <div role="img" aria-label="Prediction error per week in cases. Positive means over-predicted, negative means under-predicted." style={{ height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 14, left: 0, bottom: 4 }}>
          <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" stroke={c.axis} fontSize={11} minTickGap={40} tickLine={false} />
          <YAxis stroke={c.axis} fontSize={11} width={48} tickLine={false} label={{ value: 'Error (cases)', angle: -90, position: 'insideLeft', fill: c.axis, fontSize: 11 }} />
          <Tooltip contentStyle={{ background: c.surface, border: `1px solid ${c.grid}`, borderRadius: 12, fontSize: 12, color: c.text }} labelFormatter={(l) => `Week of ${l}`} formatter={(v) => [`${v > 0 ? '+' : ''}${v} cases`, v > 0 ? 'Over-predicted' : 'Under-predicted']} />
          <ReferenceLine y={0} stroke={c.axis} />
          {mae != null && <ReferenceLine y={mae} stroke={c.axis} strokeDasharray="4 4" label={{ value: `MAE ${mae}`, fill: c.axis, fontSize: 11, position: 'insideTopRight' }} />}
          {mae != null && <ReferenceLine y={-mae} stroke={c.axis} strokeDasharray="4 4" />}
          <Bar dataKey="error" animationDuration={800}>
            {data.map((d, i) => <Cell key={i} fill={d.error >= 0 ? '#f0742a' : '#2b9cd8'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default memo(ResidualsChart);
