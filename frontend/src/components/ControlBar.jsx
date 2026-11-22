import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { DEFAULT_AS_OF, HORIZONS } from '../config';
import { useApp } from '../context/AppContext';
import Icon from './Icon';
import Segmented from './Segmented';
import WardPicker from './WardPicker';
import WhatIfPanel from './WhatIfPanel';

/** variant "full": dashboard controls. variant "compact": city + ward + date only. */
export default function ControlBar({ variant = 'full' }) {
  const { status, cities, city, setCity, asOf, setAsOf, horizon, setHorizon, whatIf, predLoading } = useApp();
  const [showWhatIf, setShowWhatIf] = useState(false);

  return (
    <div className="sticky top-2 z-30 glass rounded-2xl p-4">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <div>
          <label htmlFor="city" className="text-xs text-muted block mb-1">City</label>
          <select id="city" value={city || ''} onChange={(e) => setCity(e.target.value)} className="rounded-xl bg-raised border border-line px-3 py-2 text-sm font-semibold">
            {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <WardPicker />
        <div>
          <label htmlFor="asof" className="text-xs text-muted block mb-1">As-of date</label>
          <div className="flex gap-1.5">
            <input id="asof" type="date" min={status.health?.earliest_supported_as_of_date || undefined} max={status.health?.dataset_end_date || undefined} value={asOf} onChange={(e) => e.target.value && setAsOf(e.target.value)} className="rounded-xl bg-raised border border-line px-3 py-2 text-sm" />
            <button
            type="button" title="Reset to the historical monsoon demonstration date" onClick={() => setAsOf(DEFAULT_AS_OF)}
              className="rounded-xl px-2.5 bg-raised border border-line text-xs font-semibold hover:bg-line/50"
            >
              Reset
            </button>
          </div>
        </div>
        {variant === 'full' && (
          <>
            <div>
              <span className="text-xs text-muted block mb-1">Forecast horizon</span>
              <Segmented label="Forecast horizon in weeks" value={horizon} onChange={setHorizon} options={HORIZONS.map((h) => ({ value: h, label: `${h} wks` }))} />
            </div>
            {status.mock && <button
              type="button" aria-expanded={showWhatIf} onClick={() => setShowWhatIf((s) => !s)}
              className={`ml-auto inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold border ${whatIf ? 'border-lagoon text-lagoon bg-lagoon/10' : 'border-line bg-raised'}`}
            >
              <Icon name="sliders" size={16} /> What-if weather{whatIf ? ' (active)' : ''}
              <Icon name="chevron" size={14} className={`transition-transform ${showWhatIf ? 'rotate-180' : ''}`} />
            </button>}
          </>
        )}
        {predLoading && variant === 'full' && <span className="text-xs text-muted animate-pulse" role="status">Updating…</span>}
      </div>
      <AnimatePresence initial={false}>{variant === 'full' && status.mock && showWhatIf && <WhatIfPanel key="wi" />}</AnimatePresence>
    </div>
  );
}
