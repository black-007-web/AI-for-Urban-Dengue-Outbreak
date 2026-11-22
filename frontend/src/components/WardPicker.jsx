import { useId, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useDebouncedValue } from '../hooks/useDebounce';
import Icon from './Icon';

export default function WardPicker() {
  const { wards, wardId, setWardId, wardsById } = useApp();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const dq = useDebouncedValue(q);
  const listId = useId();
  const closeTimer = useRef();

  const options = useMemo(() => {
    const needle = dq.trim().toLowerCase();
    const list = wards.filter((w) => w.ward_name.toLowerCase().includes(needle) || w.ward_id.toLowerCase().includes(needle));
    return [{ ward_id: 'all', ward_name: 'All wards' }, ...list];
  }, [wards, dq]);

  const choose = (id) => { setWardId(id); setOpen(false); setQ(''); };
  const current = wardId === 'all' ? 'All wards' : wardsById[wardId]?.ward_name || wardId;

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, options.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && open && options[active]) { e.preventDefault(); choose(options[active].ward_id); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="relative">
      <label className="text-xs text-muted block mb-1" htmlFor={`${listId}-in`}>Ward</label>
      <div className="relative">
        <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <input
          id={`${listId}-in`} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
          autoComplete="off" value={open ? q : current} placeholder="Search wards"
          onFocus={() => { clearTimeout(closeTimer.current); setOpen(true); setQ(''); setActive(0); }}
          onBlur={() => { closeTimer.current = setTimeout(() => setOpen(false), 120); }}
          onChange={(e) => { setQ(e.target.value); setActive(0); }} onKeyDown={onKey}
          className="w-full min-w-[11rem] rounded-xl bg-raised border border-line pl-9 pr-3 py-2 text-sm"
        />
      </div>
      {open && (
        <ul id={listId} role="listbox" className="absolute z-40 mt-1 max-h-64 w-full min-w-[13rem] overflow-auto rounded-xl glass p-1">
          {options.map((o, i) => (
            <li
              key={o.ward_id} role="option" aria-selected={o.ward_id === wardId}
              onMouseDown={(e) => { e.preventDefault(); choose(o.ward_id); }} onMouseEnter={() => setActive(i)}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm ${i === active ? 'bg-lagoon/20' : ''} ${o.ward_id === wardId ? 'font-bold' : ''}`}
            >
              {o.ward_name}
            </li>
          ))}
          {options.length === 1 && <li className="px-3 py-2 text-sm text-muted">No ward matches “{dq}”.</li>}
        </ul>
      )}
    </div>
  );
}
