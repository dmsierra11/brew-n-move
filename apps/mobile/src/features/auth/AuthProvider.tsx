import { Session } from '@supabase/supabase-js';
import { router, usePathname } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { AUTH_STORAGE_KEY, supabase } from './supabase';
import { authStorage } from './authStorage';
import type { Database } from './database';
import { isRecoverableAuthFailure, isRevokedAuthFailure } from './sessionFailure';

type MemberRow = Database['public']['Tables']['members']['Row'];

export type MemberProfile = {
  displayName: string;
  emailVerifiedAt: string | null;
  firstName: string;
  id: string;
  privacyAcknowledgedAt: string;
  privacyVersion: string;
  region: string;
  termsAcceptedAt: string;
  termsVersion: string;
  timezone: string;
};

export type AccountIntent =
  | { type: 'activity' }
  | { type: 'join' }
  | { type: 'redeem'; offerId: string }
  | { type: 'validate' }
  | null;

type SessionStatus = 'guest' | 'loading' | 'signedIn';
type ProfileStatus = 'error' | 'loading' | 'missing' | 'ready';

type AuthContextValue = {
  beginAccountAction: (intent: Exclude<AccountIntent, null>) => void;
  completeIntent: () => void;
  email: string;
  intent: AccountIntent;
  member: MemberProfile | null;
  profileStatus: ProfileStatus;
  refreshMember: () => Promise<ProfileStatus>;
  retryProfile: () => Promise<void>;
  sessionStatus: SessionStatus;
  signOut: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<string | null>;
  userId: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mapMember(row: MemberRow): MemberProfile {
  return {
    displayName: row.display_name,
    emailVerifiedAt: row.email_verified_at,
    firstName: row.first_name,
    id: row.id,
    privacyAcknowledgedAt: row.privacy_acknowledged_at,
    privacyVersion: row.privacy_version,
    region: row.region,
    termsAcceptedAt: row.terms_accepted_at,
    termsVersion: row.terms_version,
    timezone: row.timezone,
  };
}

async function readStoredSession() {
  const raw = await authStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.access_token || !parsed.refresh_token || !parsed.user?.id) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function routeForIntent(intent: AccountIntent) {
  if (intent?.type === 'redeem') {
    return { pathname: '/offer' as const, params: { id: intent.offerId } };
  }

  if (intent?.type === 'validate') {
    return '/' as const;
  }

  if (intent?.type === 'join') {
    return '/communities' as const;
  }

  if (intent?.type === 'activity') {
    return '/validations' as const;
  }

  return '/profile' as const;
}

function isGuestAccountPath(pathname: string) {
  return pathname === '/sign-in' || pathname === '/sign-up' || pathname === '/legal-document';
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('loading');
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>('loading');
  const [intent, setIntent] = useState<AccountIntent>(null);
  const openedAccountFlow = useRef(false);

  const loadMember = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('members')
      .select(
        'id, first_name, display_name, terms_version, privacy_version, terms_accepted_at, privacy_acknowledged_at, timezone, region, email_verified_at, created_at, updated_at',
      )
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      return { member: null, status: 'error' as const };
    }

    if (!data) {
      return { member: null, status: 'missing' as const };
    }

    return { member: mapMember(data), status: 'ready' as const };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (cancelled) {
        return;
      }

      if (data.session) {
        setSession(data.session);
        setSessionStatus('signedIn');
        return;
      }

      if (error && isRecoverableAuthFailure(error)) {
        const stored = await readStoredSession();
        if (cancelled) {
          return;
        }

        if (stored) {
          setSession(stored);
          setSessionStatus('signedIn');
          setProfileStatus('error');
          return;
        }
      }

      if (error && isRevokedAuthFailure(error)) {
        await supabase.auth.signOut({ scope: 'local' });
      }

      if (!cancelled) {
        setSession(null);
        setMember(null);
        setSessionStatus('guest');
      }
    };

    void restore();

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (cancelled) {
        return;
      }

      if (!nextSession) {
        setSession(null);
        setMember(null);
        setSessionStatus('guest');
        if (event === 'SIGNED_OUT') {
          openedAccountFlow.current = false;
          setIntent(null);
        }
        return;
      }

      setSession(nextSession);
      setSessionStatus('signedIn');
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (sessionStatus !== 'signedIn' || !session?.user.id) {
      return;
    }

    let cancelled = false;
    setProfileStatus('loading');
    void loadMember(session.user.id).then((result) => {
      if (cancelled) {
        return;
      }

      setMember(result.member);
      setProfileStatus(result.status);
    });

    return () => {
      cancelled = true;
    };
  }, [loadMember, session?.user.id, sessionStatus]);

  useEffect(() => {
    if (sessionStatus === 'signedIn' && profileStatus === 'missing') {
      if (pathname === '/onboarding' || pathname === '/sign-in' || pathname === '/sign-up' || pathname === '/legal-document') {
        return;
      }

      router.push('/onboarding');
      return;
    }

    if (!intent || sessionStatus !== 'guest') {
      return;
    }

    if (isGuestAccountPath(pathname)) {
      openedAccountFlow.current = true;
      return;
    }

    if (openedAccountFlow.current) {
      openedAccountFlow.current = false;
      setIntent(null);
      return;
    }

    router.push('/sign-in');
  }, [intent, pathname, profileStatus, sessionStatus]);

  const beginAccountAction = useCallback((next: Exclude<AccountIntent, null>) => {
    openedAccountFlow.current = false;
    setIntent(next);
  }, []);

  const completeIntent = useCallback(() => {
    const destination = routeForIntent(intent);
    openedAccountFlow.current = false;
    setIntent(null);
    router.dismissTo(destination);
  }, [intent]);

  const refreshMember = useCallback(async () => {
    if (!session?.user.id) {
      setMember(null);
      setProfileStatus('missing');
      return 'missing' as const;
    }

    const result = await loadMember(session.user.id);
    setMember(result.member);
    setProfileStatus(result.status);
    return result.status;
  }, [loadMember, session?.user.id]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || sessionStatus !== 'signedIn') {
        return;
      }

      void refreshMember();
    });

    return () => {
      subscription.remove();
    };
  }, [refreshMember, sessionStatus]);

  const retryProfile = useCallback(async () => {
    setProfileStatus('loading');
    const { data, error } = await supabase.auth.refreshSession();
    if (error && isRevokedAuthFailure(error)) {
      await supabase.auth.signOut({ scope: 'local' });
      setSession(null);
      setMember(null);
      openedAccountFlow.current = false;
      setIntent(null);
      setSessionStatus('guest');
      return;
    }

    if (error && isRecoverableAuthFailure(error)) {
      const stored = await readStoredSession();
      if (stored) {
        setSession(stored);
        setSessionStatus('signedIn');
      }
      setMember(null);
      setProfileStatus('error');
      return;
    }

    const active = data.session ?? session;
    if (!active) {
      setSession(null);
      setMember(null);
      setSessionStatus('guest');
      return;
    }

    setSession(active);
    setSessionStatus('signedIn');
    const result = await loadMember(active.user.id);
    setMember(result.member);
    setProfileStatus(result.status);
  }, [loadMember, session]);

  const signOut = useCallback(async () => {
    openedAccountFlow.current = false;
    setIntent(null);
    setMember(null);
    await supabase.auth.signOut();
    setSession(null);
    setSessionStatus('guest');
  }, []);

  const updateDisplayName = useCallback(
    async (displayName: string) => {
      if (!session?.user.id) {
        return 'Sign in again before changing your display name.';
      }

      const { data, error } = await supabase
        .from('members')
        .update({ display_name: displayName })
        .eq('id', session.user.id)
        .select('display_name')
        .maybeSingle();

      if (error || !data) {
        return 'Display name could not be saved.';
      }

      setMember((current) => (current ? { ...current, displayName: data.display_name } : current));
      return null;
    },
    [session?.user.id],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      beginAccountAction,
      completeIntent,
      email: session?.user.email ?? '',
      intent,
      member,
      profileStatus,
      refreshMember,
      retryProfile,
      sessionStatus,
      signOut,
      updateDisplayName,
      userId: session?.user.id ?? null,
    }),
    [
      beginAccountAction,
      completeIntent,
      intent,
      member,
      profileStatus,
      refreshMember,
      retryProfile,
      session?.user.email,
      session?.user.id,
      sessionStatus,
      signOut,
      updateDisplayName,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider.');
  }

  return value;
}
