import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { WHATIF } from '../config';
import { useApp } from '../context/AppContext';
import { useDebouncedValue } from '../hooks/useDebounce';
import Icon from './Icon';

const defaults = () => Object.fromEntries(Object.entries(WHATIF).map(([k, v]) => [k, v.def]));

export default function WhatIfPanel() {
  const { whatIf, applyWhatIf, predLoading } = useApp();
  const [draft, setDraft] = useState(whatIf || defaults());
  // Debounced copy drives the "ready to run" state so the button does not flicker while dragging.
  const settled = useDebouncedValue(draft);
  const dirty = useMemo(() => JSON.stringify(settled) !== JSON.stringify(whatIf || null), [settled, whatIf]);

  useEffect(() => { if (!whatIf) setDraft(defaults()); }, [whatIf]);

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden"
    >
      <div className="pt-4 mt-4 border-t border-line grid gap-5 md:grid-cols-[1fr_1fr_1fr_auto] items-end">
        {Object.entries(WHATIF).map(([key, cfg]) => (
          <label key={key} className="block text-sm">
            <span className="flex justify-between mb-1.5">
              <span className="text-muted">{cfg.label}</span>
              <span className="font-display font-bold tabular-nums">{draft[key]} {cfg.unit}</span>
            </span>
            <input
              type="range" min={cfg.min} max={cfg.max} step={cfg.step} value={draft[key]}
              onChange={(e) => setDraft((d) => ({ ...d, [key]: Number(e.target.value) }))}
              aria-label={`${cfg.label} (${cfg.unit})`}
            />
          </label>
        ))}
        <div className="flex gap-2">
          <button
            type="button" disabled={predLoading || !dirty} onClick={() => applyWhatIf({ ...draft })}
            className="inline-flex items-center gap-2 rounded-xl bg-lagoon text-canvas px-4 py-2 text-sm font-bold disabled:opacity-40 hover:opacity-90"
          >
            <Icon name="bolt" size={16} /> Run prediction
          </button>
          {whatIf && (
            <button type="button" onClick={() => applyWhatIf(null)} className="rounded-xl px-3 py-2 text-sm font-semibold bg-raised hover:bg-line/60">
              Reset
            </button>
          )}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted max-w-3xl">
        Overrides apply from the as-of week onward, so the model sees these conditions in its 1 to 4 week lags. Prediction runs only when you press the button.
      </p>
    </motion.div>
  );
}
