import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import {
  getHealthAccess,
  openHealthSettings,
  readTodayStepCount,
  requestHealthAccess,
} from './native';
import type { HealthAccessStatus } from './types';

type HealthContextValue = {
  connect: () => Promise<void>;
  loading: boolean;
  manage: () => Promise<void>;
  refresh: () => Promise<void>;
  status: HealthAccessStatus;
  steps: number;
};

const HealthContext = createContext<HealthContextValue | null>(null);

export function HealthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<HealthAccessStatus>('undetermined');
  const [steps, setSteps] = useState(0);

  const refresh = useCallback(async () => {
    const access = await getHealthAccess();
    setStatus(access.status);
    if (access.status === 'granted') {
      try {
        setSteps(await readTodayStepCount());
      } catch {
        setSteps(0);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void refresh();
      }
    });

    return () => subscription.remove();
  }, [refresh]);

  const connect = useCallback(async () => {
    const access = await requestHealthAccess();
    setStatus(access.status);
    if (access.status === 'granted') {
      try {
        setSteps(await readTodayStepCount());
      } catch {
        setSteps(0);
      }
    }
  }, []);

  const manage = useCallback(async () => {
    await openHealthSettings();
  }, []);

  const value = useMemo(
    () => ({ connect, loading, manage, refresh, status, steps }),
    [connect, loading, manage, refresh, status, steps],
  );

  return <HealthContext.Provider value={value}>{children}</HealthContext.Provider>;
}

export function useHealth() {
  const value = useContext(HealthContext);
  if (!value) {
    throw new Error('useHealth must be used within HealthProvider');
  }

  return value;
}
