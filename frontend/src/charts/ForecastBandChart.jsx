import { memo, useMemo } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import HelpTip from '../components/HelpTip';
import RiskBadge from '../components/RiskBadge';
import { TIERS, tierFromScore, tierMeta } from '../config';
import { chartColors, useTheme } from '../hooks/useTheme';
import { fmtDate } from '../utils/format';

function Dot({ cx, cy, payload }) {
  if (cx == null) return null;
  return <circle cx={cx} cy={cy} r={6} fill={tierMeta(payload.tier).color} stroke="#fff" strokeWidth={2} />;
}

function Tip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="glass rounded-xl p-3 text-xs space-y-1">
      <div className="font-display font-bold text-sm">Week of {fmtDate(d.week_start)}</div>
      {Number.isFinite(d.predicted_cases) && <div>Model-predicted cases <b>{d.predicted_cases.toFixed(3)}</b></div>}
      {Number.isFinite(d.ci_lower) && Number.isFinite(d.ci_upper) && (
        <div>95% model interval <b>{d.ci_lower.toFixed(3)}–{d.ci_upper.toFixed(3)}</b></div>
      )}
      <div>Training-target percentile rank <b>{(d.risk_score * 100).toFixed(1)}%</b></div>
      <RiskBadge tier={d.tier} size="sm" />
    </div>
  );
}

function ForecastBandChart({ forecast, height = 230 }) {
  const { theme } = useTheme();
  const c = chartColors(theme);
  const data = useMemo(() => forecast.map((f) => ({
    ...f,
    interval: Number.isFinite(f.ci_lower) && Number.isFinite(f.ci_upper) ? [f.ci_lower, f.ci_upper] : undefined,
    tier: f.risk_tier || tierFromScore(f.risk_score),
    label: fmtDate(f.week_start),
  })), [forecast]);
  const hasCaseForecast = data.some((d) => Number.isFinite(d.predicted_cases));
  const summary = data.map((d) => `week of ${d.label}: ${Number.isFinite(d.predicted_cases) ? `${d.predicted_cases.toFixed(3)} predicted cases, ` : ''}training-target percentile rank ${(d.risk_score * 100).toFixed(1)}%, ${d.tier}`).join('; ');

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-display font-bold text-lg">Horizon-specific case forecast</h3>
        <HelpTip>
          Cases are the selected horizon model’s output. The 95% interval uses forest-tree spread for H2 and held-out 2024 residual quantiles for H3/H4; it is an empirical model interval, not a calibrated coverage guarantee. The risk tier is based on the forecast’s percentile against training targets.
        </HelpTip>
      </div>
      <div role="img" aria-label={`Weekly risk forecast. ${summary}`} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 14, bottom: 22, left: 4 }}>
            {!hasCaseForecast && TIERS.map((t, i) => (
              <ReferenceArea key={t.key} y1={i === 0 ? 0 : TIERS[i - 1].max} y2={Math.min(1, t.max)} fill={t.color} fillOpacity={0.07} ifOverflow="hidden" />
            ))}
            <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" stroke={c.axis} fontSize={12} tickLine={false} label={{ value: 'Week starting', position: 'insideBottom', offset: -12, fill: c.axis, fontSize: 12 }} />
            <YAxis
              domain={hasCaseForecast ? [0, 'auto'] : [0, 1]}
              ticks={hasCaseForecast ? undefined : [0, 0.25, 0.5, 0.75, 1]}
              stroke={c.axis} fontSize={12} tickLine={false} width={56}
              label={{ value: hasCaseForecast ? 'Predicted cases' : 'Risk index (0–1)', angle: -90, position: 'insideLeft', offset: -2, fill: c.axis, fontSize: 12 }}
            />
            <Tooltip content={<Tip />} cursor={{ stroke: c.axis, strokeDasharray: '3 3' }} />
            {hasCaseForecast && <Area type="monotone" dataKey="interval" stroke="none" fill="rgb(var(--lagoon))" fillOpacity={0.2} connectNulls />}
            <Line type="monotone" dataKey={hasCaseForecast ? 'predicted_cases' : 'risk_score'} stroke={c.text} strokeWidth={2.5} dot={<Dot />} activeDot={{ r: 8 }} animationDuration={900} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default memo(ForecastBandChart);
