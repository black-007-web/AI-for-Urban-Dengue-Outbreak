import { useSyncExternalStore } from 'react';
import { getStatus, subscribeStatus } from '../services/api';
import { getStatsSnapshot, subscribeStats } from '../services/cache';

export const useApiStatus = () => useSyncExternalStore(subscribeStatus, getStatus);
export const useCacheStats = () => useSyncExternalStore(subscribeStats, getStatsSnapshot);
