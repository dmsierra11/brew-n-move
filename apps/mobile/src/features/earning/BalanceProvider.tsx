import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../auth/supabase';

type BalanceContextValue = {
  applyBalance: (balance: number) => void;
  balance: number | null;
  reloadBalance: () => Promise<number | null>;
};

const BalanceContext = createContext<BalanceContextValue | null>(null);

export function BalanceProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { sessionStatus, userId } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const reloadBalance = useCallback(async () => {
    if (!userId) {
      setBalance(0);
      setLoadedFor(null);
      return 0;
    }

    const { data, error } = await supabase
      .from('member_balances')
      .select('balance')
      .eq('member_id', userId)
      .maybeSingle();

    if (error) {
      return null;
    }

    const next = data?.balance ?? 0;
    setBalance(next);
    setLoadedFor(userId);
    return next;
  }, [userId]);

  useEffect(() => {
    if (sessionStatus !== 'signedIn' || !userId) {
      setBalance(0);
      setLoadedFor(null);
      return;
    }

    setBalance(null);
    setLoadedFor(null);
    let cancelled = false;
    void reloadBalance().then((next) => {
      if (cancelled || next == null) {
        return;
      }

      setBalance(next);
    });

    return () => {
      cancelled = true;
    };
  }, [reloadBalance, sessionStatus, userId]);

  const applyBalance = useCallback((next: number) => {
    setBalance(next);
    setLoadedFor(userId);
  }, [userId]);

  const visibleBalance = sessionStatus === 'guest'
    ? 0
    : loadedFor === userId
      ? balance
      : null;

  const value = useMemo(
    () => ({
      applyBalance,
      balance: visibleBalance,
      reloadBalance,
    }),
    [applyBalance, reloadBalance, visibleBalance],
  );

  return <BalanceContext.Provider value={value}>{children}</BalanceContext.Provider>;
}

export function useBalance() {
  const value = useContext(BalanceContext);
  if (!value) {
    throw new Error('useBalance must be used within BalanceProvider.');
  }

  return value;
}
