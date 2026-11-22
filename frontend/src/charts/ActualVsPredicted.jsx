import { memo } from 'react';
import { Brush, CartesianGrid, ComposedChart, Legend, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { chartColors, useTheme } from '../hooks/useTheme';
import { fmtDate } from '../utils/format';

function ActualVsPredicted({ series }) {
  const { theme } = useTheme();
  const c = chartColors(theme);
  const data = series.map((s) => ({ ...s, label: fmtDate(s.week_start, { day: 'numeric', month: 'short', year: '2-digit' }) }));
  const firstTest = data.find((d) => d.split === 'test');
  const valEnd = [...data].reverse().find((d) => d.split === 'validation');
  const hasBoth = Boolean(firstTest && valEnd);

  return (
    <div role="img" aria-label="Actual versus predicted weekly cases across the validation and test periods" style={{ height: 320 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 14, left: 0, bottom: 4 }}>
          <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
          {hasBoth && <ReferenceArea x1={data[0].label} x2={valEnd.label} fill="#e0a710" fillOpacity={0.07} label={{ value: 'Validation', fill: c.axis, fontSize: 11, position: 'insideTopLeft' }} />}
          {hasBoth && <ReferenceArea x1={firstTest.label} x2={data[data.length - 1].label} fill="#22a55b" fillOpacity={0.07} label={{ value: 'Test', fill: c.axis, fontSize: 11, position: 'insideTopLeft' }} />}
          <XAxis dataKey="label" stroke={c.axis} fontSize={11} minTickGap={40} tickLine={false} />
          <YAxis stroke={c.axis} fontSize={11} width={48} tickLine={false} label={{ value: 'Cases per week', angle: -90, position: 'insideLeft', fill: c.axis, fontSize: 11 }} />
          <Tooltip contentStyle={{ background: c.surface, border: `1px solid ${c.grid}`, borderRadius: 12, fontSize: 12, color: c.text }} labelFormatter={(l) => `Week of ${l}`} formatter={(v, n) => [`${v} cases`, n]} />
          <Legend verticalAlign="top" height={28} iconType="plainline" />
          <Line name="Actual" type="monotone" dataKey="actual" stroke={c.text} strokeWidth={2.2} dot={false} animationDuration={900} />
          <Line name="Predicted" type="monotone" dataKey="predicted" stroke={c.coral} strokeWidth={2.2} strokeDasharray="6 4" dot={false} animationDuration={900} />
          <Brush dataKey="label" height={22} stroke={c.lagoon} fill="transparent" travellerWidth={8} tickFormatter={() => ''} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default memo(ActualVsPredicted);
