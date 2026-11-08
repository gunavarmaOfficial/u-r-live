import { useEffect, useState } from 'react';
import { api } from '../services/api';

export interface SystemMetrics {
  status: string;
  queueLength: number;
  activeMatches: number;
  turnConfigured: boolean;
  loaded: boolean;
}

const INITIAL: SystemMetrics = {
  status: 'unknown',
  queueLength: 0,
  activeMatches: 0,
  turnConfigured: false,
  loaded: false,
};

/**
 * Polls the public health endpoint. Pauses while the tab is hidden and
 * keeps the last known values so the UI never invents traffic numbers.
 */
export function useSystemHealth(intervalMs = 20000): SystemMetrics {
  const [metrics, setMetrics] = useState<SystemMetrics>(INITIAL);

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const load = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const data = await api.getSystemHealth();
        if (mounted) {
          setMetrics({
            status: data.status,
            queueLength: data.queueLength,
            activeMatches: data.activeMatches,
            turnConfigured: data.turnConfigured,
            loaded: true,
          });
        }
      } catch {
        if (mounted) setMetrics((prev) => ({ ...prev, status: 'offline', loaded: true }));
      }
    };

    const start = () => {
      if (timer) clearInterval(timer);
      timer = setInterval(load, intervalMs);
    };

    const onVisibility = () => {
      if (document.hidden) {
        if (timer) clearInterval(timer);
        timer = null;
      } else {
        void load();
        start();
      }
    };

    void load();
    start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs]);

  return metrics;
}
