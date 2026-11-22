import { useId, useState } from 'react';
import Icon from './Icon';

export default function HelpTip({ title = 'How to read this', children, align = 'right' }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button" aria-label={title} aria-describedby={open ? id : undefined} aria-expanded={open}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        className="grid place-items-center size-6 rounded-full text-muted hover:text-ink hover:bg-raised"
      >
        <Icon name="help" size={16} />
      </button>
      {open && (
        <span
          id={id} role="tooltip"
          className={`absolute top-7 z-30 w-64 rounded-xl glass p-3 text-xs leading-relaxed text-ink ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          <strong className="block font-display text-sm mb-1">{title}</strong>
          {children}
        </span>
      )}
    </span>
  );
}
