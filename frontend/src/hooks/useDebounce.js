import { useEffect, useState } from 'react';
import { DEBOUNCE_MS } from '../config';

export function useDebouncedValue(value, delay = DEBOUNCE_MS) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
