import { tierMeta } from '../config';
import Icon from './Icon';

const SIZES = {
  sm: 'text-xs px-2 py-0.5 gap-1',
  md: 'text-sm px-2.5 py-1 gap-1.5',
  lg: 'text-lg px-4 py-1.5 gap-2 font-display font-bold',
};

/** Tier is always communicated by text AND icon, never colour alone. */
export default function RiskBadge({ tier, size = 'md', className = '' }) {
  const t = tierMeta(tier);
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold whitespace-nowrap ${SIZES[size]} ${className}`}
      style={{ background: t.soft, color: t.color, boxShadow: `inset 0 0 0 1px ${t.color}66` }}
      aria-label={`Risk tier: ${t.key}`}
    >
      <Icon name={t.icon} size={size === 'lg' ? 20 : 14} strokeWidth={2.2} />
      {t.key}
    </span>
  );
}
