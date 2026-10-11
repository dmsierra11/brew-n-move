import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../auth/supabase';
import { loadCurrentDocuments } from '../auth/documents';
import {
  confirmedPersistedAward,
  type ValidationSnapshot,
} from '../earning/validation';
import { useBalance } from '../earning/BalanceProvider';
import {
  dayWindow,
  deviceLocalDate,
  deviceTimeZone,
  windowsOverlap,
} from '../earning/localDay';
import { submitValidation } from '../earning/submitValidation';
import { readTodayStepCount } from '../health/native';
import { healthSourcePlatform } from '../health/platform';
import { useHealth } from '../health/HealthProvider';

export type ValidationPhase =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'awarded'; delta: number }
  | { kind: 'no_additional' }
  | { kind: 'day_closed' }
  | { kind: 'day_overlap' }
  | { kind: 'rejected' }
  | { kind: 'unconfirmed' };

type StoredValidation = {
  awardedPoints: number;
  end: number;
  localDate: string;
  start: number;
  timezone: string;
};

function sameWindow(stored: StoredValidation, localDate: string, timeZone: string) {
  return stored.localDate === localDate && stored.timezone === timeZone;
}

function awardedForWindow(records: StoredValidation[], localDate: string, timeZone: string) {
  return records
    .filter((record) => sameWindow(record, localDate, timeZone))
    .reduce((sum, record) => sum + record.awardedPoints, 0);
}

function openSuccess(params: { delta: number; steps: number }) {
  router.push({
    pathname: '/validation-success',
    params: {
      delta: String(params.delta),
      steps: String(params.steps),
    },
  });
}

export function useTodayValidation() {
  const { beginAccountAction, member, profileStatus, sessionStatus, userId } = useAuth();
  const { applyBalance, reloadBalance } = useBalance();
  const { refresh } = useHealth();
  const [phase, setPhase] = useState<ValidationPhase>({ kind: 'idle' });
  const [records, setRecords] = useState<StoredValidation[] | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const loadRecords = useCallback(async () => {
    if (!userId) {
      setRecords([]);
      return [];
    }

    const { data, error } = await supabase
      .from('step_validations')
      .select('awarded_points, local_date, timezone, window_start, window_end')
      .eq('member_id', userId);

    if (error || !data) {
      return null;
    }

    const next = data.map((row) => ({
      awardedPoints: row.awarded_points,
      end: new Date(row.window_end).getTime(),
      localDate: row.local_date,
      start: new Date(row.window_start).getTime(),
      timezone: row.timezone,
    }));
    setRecords(next);
    return next;
  }, [userId]);

  useEffect(() => {
    setPhase({ kind: 'idle' });
    setRecords(userId ? null : []);
    void loadRecords();
  }, [loadRecords, userId]);

  const localDate = deviceLocalDate();
  const timeZone = deviceTimeZone();
  const currentWindow = dayWindow(localDate, timeZone);
  const overlapsAnother = records?.some((record) =>
    !sameWindow(record, localDate, timeZone) && windowsOverlap(currentWindow, record),
  ) ?? false;

  const snapshot = useCallback(async (): Promise<ValidationSnapshot | null> => {
    const [nextBalance, nextRecords] = await Promise.all([reloadBalance(), loadRecords()]);
    if (nextRecords == null || nextBalance == null) {
      return null;
    }

    return { awardedToday: awardedForWindow(nextRecords, localDate, timeZone), balance: nextBalance };
  }, [loadRecords, localDate, reloadBalance, timeZone]);

  const validate = useCallback(async () => {
    if (phase.kind === 'submitting') {
      return;
    }

    if (sessionStatus !== 'signedIn' || profileStatus !== 'ready' || !member || !userId) {
      if (profileStatus === 'error') {
        setPhase({ kind: 'rejected' });
        setResetKey((current) => current + 1);
        return;
      }

      beginAccountAction({ type: 'validate' });
      setResetKey((current) => current + 1);
      return;
    }

    const documents = await loadCurrentDocuments();
    if (documents.error || !documents.documents) {
      setPhase({ kind: 'rejected' });
      setResetKey((current) => current + 1);
      return;
    }

    if (member.privacyVersion !== documents.documents.privacy.version) {
      setResetKey((current) => current + 1);
      router.push({ pathname: '/legal-document', params: { acknowledge: '1', kind: 'privacy' } });
      return;
    }

    setPhase({ kind: 'submitting' });
    await refresh();
    let stepTotal = 0;
    try {
      stepTotal = await readTodayStepCount();
    } catch {
      setPhase({ kind: 'rejected' });
      setResetKey((current) => current + 1);
      return;
    }

    const before = await snapshot();
    const result = await submitValidation({
      localDate,
      sourcePlatform: healthSourcePlatform,
      stepTotal,
      timezone: timeZone,
    });

    if (!result.confirmed) {
      const after = await snapshot();
      const persisted = before ? confirmedPersistedAward(before, after) : null;
      if (persisted != null) {
        if (after?.balance != null) {
          applyBalance(after.balance);
        }
        openSuccess({ delta: persisted, steps: stepTotal });
        setPhase({ kind: 'idle' });
      } else {
        setPhase({ kind: 'unconfirmed' });
      }
      setResetKey((current) => current + 1);
      return;
    }

    if (result.balance != null) {
      applyBalance(result.balance);
    }
    await loadRecords();

    if (result.reason === 'awarded') {
      openSuccess({ delta: result.awardedDelta, steps: stepTotal });
      setPhase({ kind: 'idle' });
    } else if (result.reason === 'no_additional') {
      setPhase({ kind: 'idle' });
    } else if (result.reason === 'day_closed') {
      setPhase({ kind: 'day_closed' });
    } else if (result.reason === 'day_overlap') {
      setPhase({ kind: 'day_overlap' });
    } else if (result.reason === 'privacy_required') {
      setPhase({ kind: 'idle' });
      router.push({ pathname: '/legal-document', params: { acknowledge: '1', kind: 'privacy' } });
    } else if (result.reason === 'not_onboarded' || result.reason === 'not_signed_in') {
      setPhase({ kind: 'idle' });
      beginAccountAction({ type: 'validate' });
    } else {
      setPhase({ kind: 'rejected' });
    }

    setResetKey((current) => current + 1);
  }, [
    applyBalance,
    beginAccountAction,
    loadRecords,
    localDate,
    member,
    phase.kind,
    profileStatus,
    refresh,
    sessionStatus,
    snapshot,
    timeZone,
    userId,
  ]);

  const awardedToday = records == null
    ? null
    : awardedForWindow(records, localDate, timeZone);

  return {
    awardedToday,
    overlapsAnother,
    phase,
    resetKey,
    validate,
  };
}
