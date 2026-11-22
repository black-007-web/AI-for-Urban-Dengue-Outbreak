import GlassCard from './GlassCard';
import Icon from './Icon';

export default function KpiCard({ label, children, sub, accent, icon, onClick, glow }) {
  const Inner = (
    <>
      <div className="flex items-center justify-between text-sm text-muted">
        <span>{label}</span>
        {icon && <Icon name={icon} size={18} className="opacity-80" />}
      </div>
      <div className="mt-2 font-display text-3xl font-extrabold leading-none" style={accent ? { color: accent } : undefined}>{children}</div>
      {sub && <div className="mt-2 text-xs text-muted truncate">{sub}</div>}
    </>
  );
  const cls = `p-4 text-left w-full ${glow ? 'glow-border' : ''}`;
  return (
    <GlassCard as="div" className={cls} style={glow ? { '--glow': accent } : undefined}>
      {onClick ? <button type="button" onClick={onClick} className="w-full text-left">{Inner}</button> : Inner}
    </GlassCard>
  );
}
