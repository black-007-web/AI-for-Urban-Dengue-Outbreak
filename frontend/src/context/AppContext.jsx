import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_AS_OF } from '../config';
import { getCities, getWardGeojson, getWards, predict } from '../services/api';
import { useApiStatus } from '../hooks/useApiStatus';
import { useResource } from '../hooks/useResource';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export function AppProvider({ children }) {
  const status = useApiStatus();
  const [city, setCityState] = useState(null);
  const [wardId, setWardId] = useState('all');
  const [asOf, setAsOf] = useState(DEFAULT_AS_OF);
  const [horizon, setHorizon] = useState(3);
  const [whatIf, setWhatIf] = useState(null);

  const cities = useResource((signal) => getCities({ signal }), [status.ready, status.mock], { enabled: status.ready });
  useEffect(() => {
    if (!city && cities.data?.length) setCityState(cities.data[0].id);
  }, [cities.data, city]);

  const setCity = useCallback((id) => { setCityState(id); setWardId('all'); }, []);

  const wardsRes = useResource((signal) => getWards(city, { signal }), [city, status.mock], { enabled: !!city });
  const geoRes = useResource((signal) => getWardGeojson(city, { signal }), [city, status.mock], { enabled: !!city });
  const predRes = useResource(
    (signal, force) => predict({
      city, as_of_date: asOf, horizon_weeks: horizon, ...(whatIf ? { weather_override: whatIf } : {}),
    }, { signal, force }),
    [city, asOf, horizon, whatIf, status.mock],
    { enabled: !!city },
  );

  const wards = useMemo(() => wardsRes.data || [], [wardsRes.data]);
  const wardsById = useMemo(() => Object.fromEntries(wards.map((w) => [w.ward_id, w])), [wards]);

  const predictions = useMemo(() => {
    const list = (predRes.data?.predictions || []).filter((p) => !wards.length || wardsById[p.ward_id]);
    return [...list].sort((a, b) => b.risk_score - a.risk_score).map((p, i) => ({ ...p, rank: i + 1, ward: wardsById[p.ward_id] }));
  }, [predRes.data, wards.length, wardsById]);

  const selected = useMemo(
    () => (wardId !== 'all' ? predictions.find((p) => p.ward_id === wardId) : null) || predictions[0] || null,
    [predictions, wardId],
  );

  const value = useMemo(() => ({
    status, cities: cities.data || [], city, setCity, wardId, setWardId, asOf, setAsOf, horizon, setHorizon,
    whatIf, applyWhatIf: setWhatIf, wards, wardsById, geojson: geoRes.data,
    predictions, selected, meta: predRes.data, predLoading: predRes.loading, predError: predRes.error,
    predCached: predRes.cached, predMock: predRes.mock, retry: predRes.retry,
    wardsError: wardsRes.error, retryWards: wardsRes.retry,
  }), [status, cities.data, city, setCity, wardId, asOf, horizon, whatIf, wards, wardsById, geoRes.data,
    predictions, selected, predRes.data, predRes.loading, predRes.error, predRes.cached, predRes.mock, predRes.retry,
    wardsRes.error, wardsRes.retry]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
