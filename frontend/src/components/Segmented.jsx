import { useId } from 'react';
import { motion } from 'framer-motion';

export default function Segmented({ options, value, onChange, label, size = 'md' }) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl bg-raised p-1 gap-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value} type="button" role="radio" aria-checked={active} onClick={() => onChange(o.value)}
            className={`relative rounded-lg font-semibold ${size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'} ${active ? 'text-canvas' : 'text-muted hover:text-ink'}`}
          >
            {active && (
              <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-lg bg-lagoon" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
