import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs `fetcher(signal)` whenever `deps` change. Aborts the previous request,
 * exposes { data, loading, error, cached, mock, retry }.
 */
export function useResource(fetcher, deps, { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, loading: enabled, error: null, cached: false, mock: false });
  const [nonce, setNonce] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!enabled) { setState((s) => ({ ...s, loading: false })); return undefined; }
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcherRef.current(ctrl.signal, nonce > 0)
      .then((res) => setState({ data: res.data, loading: false, error: null, cached: res.cached, mock: res.mock }))
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setState((s) => ({ ...s, loading: false, error: err }));
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, enabled]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, retry };
}
