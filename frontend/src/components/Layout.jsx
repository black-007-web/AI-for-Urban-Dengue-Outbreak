import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { NAV } from '../config';
import { useApiStatus } from '../hooks/useApiStatus';
import { useTheme } from '../hooks/useTheme';
import Icon from './Icon';

export function Aurora() {
  return <div className="aurora" aria-hidden="true"><i /><i /><i /></div>;
}

function ApiBadge() {
  const status = useApiStatus();
  if (!status.ready) return <span className="text-xs text-muted">Connecting…</span>;
  if (status.mock) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
        style={{ background: '#e0a71026', color: '#c98f00', boxShadow: 'inset 0 0 0 1px #e0a71088' }}
        title={status.reason === 'forced' ? 'VITE_USE_MOCK=true: demo data only' : 'Backend unreachable: showing generated demo data, not live predictions'}
      >
        <Icon name="alert" size={14} /> Demo data ({status.reason === 'forced' ? 'mock mode' : 'backend offline'})
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold" style={{ background: '#22a55b26', color: '#22a55b' }}>
      <span className="size-2 rounded-full bg-current animate-pulse" /> Live · {status.health?.model_version || 'backend connected'}
    </span>
  );
}

export function Header() {
  const { theme, toggle } = useTheme();
  return (
    <header className="flex items-center justify-between gap-3 px-1 pb-4">
      <div className="flex items-center gap-3 lg:hidden">
        <div className="grid place-items-center size-9 rounded-xl bg-lagoon text-canvas"><Icon name="droplet" fill="currentColor" /></div>
        <span className="font-display font-extrabold text-xl">DengueWatch</span>
      </div>
      <p className="hidden lg:block text-sm text-muted">Ward-level dengue early warning for Dhaka and Chattogram. Act 2 to 4 weeks before the peak.</p>
      <div className="flex items-center gap-3">
        <ApiBadge />
        <button
          type="button" onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          className="grid place-items-center size-9 rounded-xl bg-raised border border-line hover:bg-line/50"
        >
          <motion.span key={theme} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} transition={{ duration: 0.25 }}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
          </motion.span>
        </button>
      </div>
    </header>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 p-5 sticky top-0 h-screen">
      <div className="flex items-center gap-3 mb-8">
        <div className="grid place-items-center size-10 rounded-xl bg-lagoon text-canvas"><Icon name="droplet" fill="currentColor" /></div>
        <div>
          <div className="font-display font-extrabold text-xl leading-none">DengueWatch</div>
          <div className="text-xs text-muted mt-1">Early-warning console</div>
        </div>
      </div>
      <nav aria-label="Main" className="flex flex-col gap-1">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className="relative rounded-xl px-3 py-2.5 text-sm font-semibold">
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-xl bg-lagoon/15 border border-lagoon/40" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                <span className={`relative flex items-center gap-3 ${isActive ? 'text-lagoon' : 'text-muted hover:text-ink'}`}>
                  <Icon name={n.icon} size={18} /> {n.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <p className="mt-auto text-xs text-muted leading-relaxed">
        Aedes eggs hatch within days of heavy rain. Cases follow 2 to 4 weeks later, so the window to act is now.
      </p>
    </aside>
  );
}

export function MobileNav() {
  return (
    <nav aria-label="Main" className="lg:hidden flex gap-1 overflow-x-auto pb-3">
      {NAV.map((n) => (
        <NavLink
          key={n.to} to={n.to} end={n.to === '/'}
          className={({ isActive }) => `inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold border ${isActive ? 'bg-lagoon/15 border-lagoon/40 text-lagoon' : 'border-line text-muted'}`}
        >
          <Icon name={n.icon} size={16} /> {n.label}
        </NavLink>
      ))}
    </nav>
  );
}
