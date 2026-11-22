import { useCallback, useEffect, useState } from 'react';

export function useTheme() {
  const [theme, setTheme] = useState(() => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'));
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try { localStorage.setItem('dw-theme', theme); } catch { /* ignore */ }
  }, [theme]);
  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return { theme, toggle };
}

/** Chart colours that need a concrete value (SVG attributes cannot read Tailwind). */
export function chartColors(theme) {
  return theme === 'dark'
    ? { grid: '#1e4050', axis: '#8caab2', text: '#e2f2f4', lagoon: '#38cdd6', coral: '#ff7a64', surface: '#0b212a', blue: '#5aa9ff' }
    : { grid: '#cedde1', axis: '#4f6870', text: '#0c262e', lagoon: '#0c7680', coral: '#e2543e', surface: '#ffffff', blue: '#2b7de0' };
}
