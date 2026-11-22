import { memo } from 'react';
import { motion } from 'framer-motion';

function ImportanceChart({ items }) {
  const max = Math.max(0.0001, ...items.map((i) => i.importance));
  return (
    <ul role="img" aria-label={`Global feature importance. ${items.map((i) => `${i.label} ${(i.importance * 100).toFixed(0)} percent`).join('; ')}`} className="space-y-2">
      {items.map((it, i) => (
        <li key={it.feature} className="grid grid-cols-[10.5rem_1fr_3rem] items-center gap-3 text-sm">
          <span className="truncate" title={it.label}>{it.label}</span>
          <span className="h-3 rounded-full bg-line/60 overflow-hidden">
            <motion.span className="block h-full rounded-full" style={{ background: 'linear-gradient(90deg, rgb(var(--lagoon)), #6366f1)' }}
              initial={{ width: 0 }} animate={{ width: `${(it.importance / max) * 100}%` }} transition={{ duration: 0.8, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }} />
          </span>
          <span className="text-xs font-bold tabular-nums text-right">{(it.importance * 100).toFixed(1)}%</span>
        </li>
      ))}
    </ul>
  );
}

export default memo(ImportanceChart);
