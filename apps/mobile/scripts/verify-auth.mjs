import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const envFile = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const env = Object.fromEntries(
  envFile
    .split('\n')
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);

const url = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const results = [];

function check(name, passed, detail = '') {
  results.push({ name, passed, detail });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

function memoryStorage() {
  const store = new Map();
  return {
    getItem: (storageKey) => store.get(storageKey) ?? null,
    setItem: (storageKey, value) => {
      store.set(storageKey, value);
    },
    removeItem: (storageKey) => {
      store.delete(storageKey);
    },
  };
}

function clientFor(storage = memoryStorage()) {
  return createClient(url, key, {
    auth: {
      storage,
      storageKey: 'brew-n-move-auth',
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

const password = 'correct-horse';
const stamp = Date.now();
const emailA = `brew.move.a.${stamp}@gmail.com`;
const emailB = `brew.move.b.${stamp}@gmail.com`;

const anon = clientFor();
const documents = await anon.from('legal_documents').select('kind, version').eq('is_current', true);
const terms = documents.data?.find((document) => document.kind === 'terms');
const privacy = documents.data?.find((document) => document.kind === 'privacy');
check(
  'guest can read current legal documents',
  !documents.error && terms?.version === '2026-10-05' && privacy?.version === '2026-10-07',
  documents.error?.message ?? '',
);

const hiddenMembers = await anon.from('members').select('id');
check(
  'guest cannot read member rows',
  Boolean(hiddenMembers.error) || (hiddenMembers.data?.length ?? 0) === 0,
  hiddenMembers.error?.message ?? `rows ${hiddenMembers.data?.length ?? 0}`,
);

async function openAccount(email) {
  const authClient = clientFor();
  const signedUp = await authClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        privacy_version: privacy?.version,
        terms_version: terms?.version,
      },
    },
  });

  if (signedUp.data.session && signedUp.data.user) {
    return {
      authClient,
      error: null,
      immediate: true,
      session: signedUp.data.session,
      user: signedUp.data.user,
    };
  }

  const signedIn = await authClient.auth.signInWithPassword({ email, password });
  return {
    authClient,
    error: signedIn.data.user ? null : (signedUp.error ?? signedIn.error),
    immediate: false,
    session: signedIn.data.session,
    user: signedIn.data.user ?? signedUp.data.user,
  };
}

const accountA = await openAccount(emailA);
check(
  'sign-up starts a session',
  Boolean(accountA.session) && Boolean(accountA.user),
  accountA.error?.message ?? (accountA.immediate ? '' : 'signed in after sign-up'),
);

if (!accountA.session || !accountA.user || !terms || !privacy) {
  console.log(JSON.stringify(results, null, 2));
  process.exit(1);
}

const metadata = accountA.session.user.user_metadata;
check(
  'sign-up stores the document versions that were shown',
  metadata.terms_version === terms.version && metadata.privacy_version === privacy.version,
);

const insertA = await accountA.authClient.from('members').insert({
  id: accountA.user.id,
  first_name: 'Avery',
  display_name: 'Avery',
  terms_version: terms.version,
  privacy_version: privacy.version,
  timezone: 'Europe/Dublin',
  region: 'IE',
  terms_accepted_at: '2000-01-01T00:00:00Z',
  privacy_acknowledged_at: '2000-01-01T00:00:00Z',
}).select('terms_version, privacy_version, terms_accepted_at, display_name, email_verified_at').single();

check(
  'onboarding stores versions and database timestamps',
  !insertA.error
    && insertA.data?.terms_version === '2026-10-05'
    && insertA.data?.privacy_version === '2026-10-07'
    && !String(insertA.data?.terms_accepted_at).startsWith('2000')
    && insertA.data?.email_verified_at == null,
  insertA.error?.message ?? '',
);

const staleVersion = await accountA.authClient.from('members').insert({
  id: accountA.user.id,
  first_name: 'Avery',
  display_name: 'Avery',
  terms_version: '1999-01-01',
  privacy_version: privacy.version,
  timezone: 'Europe/Dublin',
  region: 'IE',
});
check('old document version is rejected', Boolean(staleVersion.error), staleVersion.error?.message ?? 'inserted');

const accountB = await openAccount(emailB);
check(
  'account B can authenticate',
  Boolean(accountB.session) && Boolean(accountB.user),
  accountB.error?.message ?? '',
);

if (!accountB.session || !accountB.user) {
  console.log(JSON.stringify(results, null, 2));
  process.exit(1);
}

const insertB = await accountB.authClient.from('members').insert({
  id: accountB.user.id,
  first_name: 'Blair',
  display_name: 'Blair',
  terms_version: terms.version,
  privacy_version: privacy.version,
  timezone: 'Europe/Dublin',
  region: 'IE',
}).select('id').single();
check('second member row is created', !insertB.error, insertB.error?.message ?? '');

const crossSelect = await accountA.authClient
  .from('members')
  .select('display_name, first_name')
  .eq('id', accountB.user.id);
check(
  'account A cannot read account B',
  !crossSelect.error && (crossSelect.data?.length ?? 0) === 0,
  crossSelect.error?.message ?? `rows ${crossSelect.data?.length ?? 0}`,
);

const crossInsert = await accountA.authClient.from('members').insert({
  id: accountB.user.id,
  first_name: 'Stolen',
  display_name: 'Stolen',
  terms_version: terms.version,
  privacy_version: privacy.version,
  timezone: 'Europe/Dublin',
  region: 'IE',
});
check('account A cannot insert account B', Boolean(crossInsert.error), crossInsert.error?.message ?? 'inserted');

const crossUpdate = await accountA.authClient
  .from('members')
  .update({ display_name: 'Stolen' })
  .eq('id', accountB.user.id)
  .select('display_name');
const rereadB = await accountB.authClient.from('members').select('display_name').single();
check(
  'account A cannot update account B',
  (crossUpdate.data?.length ?? 0) === 0 && rereadB.data?.display_name === 'Blair',
  crossUpdate.error?.message ?? rereadB.data?.display_name ?? '',
);

const protectedUpdate = await accountA.authClient
  .from('members')
  .update({ first_name: 'Changed' })
  .eq('id', accountA.user.id);
check(
  'member cannot change protected profile fields',
  Boolean(protectedUpdate.error),
  protectedUpdate.error?.message ?? 'updated',
);

const claimedVerified = await accountA.authClient
  .from('members')
  .update({ email_verified_at: '2000-01-01T00:00:00Z' })
  .eq('id', accountA.user.id)
  .select('email_verified_at');
const verifiedRead = await accountA.authClient.from('members').select('email_verified_at').single();
check(
  'member cannot set email_verified_at',
  Boolean(claimedVerified.error) && verifiedRead.data?.email_verified_at == null,
  claimedVerified.error?.message ?? verifiedRead.data?.email_verified_at ?? 'updated',
);

const issueRpc = await accountA.authClient.rpc('issue_email_verification_token', {
  p_member_id: accountA.user.id,
});
check(
  'member cannot issue verification tokens',
  Boolean(issueRpc.error),
  issueRpc.error?.message ?? 'issued',
);

const confirmRpc = await accountA.authClient.rpc('confirm_email_token', { p_token: '00' });
check(
  'member cannot confirm verification tokens',
  Boolean(confirmRpc.error),
  confirmRpc.error?.message ?? 'confirmed',
);

const requested = await accountA.authClient.functions.invoke('request-email-verification');
const requestStatus = requested.error?.context?.status ?? (requested.data ? 200 : 0);
check(
  'onboarded member can request email verification',
  requestStatus === 200 || requestStatus === 503,
  requested.error?.message ?? JSON.stringify(requested.data ?? {}),
);

const guestRequested = await anon.functions.invoke('request-email-verification');
const guestStatus = guestRequested.error?.context?.status ?? 0;
check(
  'guest cannot request email verification',
  guestStatus === 401,
  guestRequested.error?.message ?? 'allowed',
);

const confirmPage = await fetch(`${url}/functions/v1/confirm-email?token=not-a-token`, {
  headers: {
    Authorization: `Bearer ${key}`,
    apikey: key,
  },
});
check('confirm-email rejects an invalid token', confirmPage.status === 400, String(confirmPage.status));

const nameUpdate = await accountA.authClient
  .from('members')
  .update({ display_name: 'Ave' })
  .eq('id', accountA.user.id)
  .select('display_name')
  .single();
check('member can change display name', nameUpdate.data?.display_name === 'Ave', nameUpdate.error?.message ?? '');

const storage = memoryStorage();
const persistent = clientFor(storage);
const signedIn = await persistent.auth.signInWithPassword({ email: emailA, password });
check('sign-in restores the same member', signedIn.data.user?.id === accountA.user.id, signedIn.error?.message ?? '');

const restored = clientFor(storage);
const restoredSession = await restored.auth.getSession();
check(
  'a new client restores the stored session',
  restoredSession.data.session?.user.id === accountA.user.id,
  restoredSession.error?.message ?? '',
);

await persistent.auth.signOut();
const afterSignOut = await persistent.auth.getSession();
const restoredAfterSignOut = clientFor(storage);
const cleared = await restoredAfterSignOut.auth.getSession();
check(
  'sign-out clears the stored session',
  !afterSignOut.data.session && !cleared.data.session,
);

const ownAfterSwitch = await accountB.authClient.from('members').select('display_name, first_name').single();
const leakedA = await accountB.authClient.from('members').select('display_name').eq('id', accountA.user.id);
check(
  'account B does not see account A after A signs out',
  ownAfterSwitch.data?.display_name === 'Blair' && (leakedA.data?.length ?? 0) === 0,
);

const expiredStorage = memoryStorage();
const currentSession = accountA.session;
expiredStorage.setItem('brew-n-move-auth', JSON.stringify({
  ...currentSession,
  expires_at: 1,
  refresh_token: 'not-a-real-refresh-token',
}));
const revokedClient = clientFor(expiredStorage);
const revoked = await revokedClient.auth.refreshSession();
const revokedSession = await revokedClient.auth.getSession();
check(
  'invalid refresh clears the session',
  Boolean(revoked.error) && !revokedSession.data.session,
  revoked.error?.message ?? 'session remained',
);

const networkStorage = memoryStorage();
networkStorage.setItem('brew-n-move-auth', JSON.stringify({
  ...currentSession,
  expires_at: 1,
}));
const networkClient = createClient(url, key, {
  auth: {
    storage: networkStorage,
    storageKey: 'brew-n-move-auth',
    autoRefreshToken: false,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: async () => {
      throw new TypeError('Network request failed');
    },
  },
});
const networkRefresh = await networkClient.auth.refreshSession();
const storedAfterNetwork = networkStorage.getItem('brew-n-move-auth');
check(
  'temporary refresh failure keeps the stored session',
  Boolean(networkRefresh.error) && Boolean(storedAfterNetwork),
  networkRefresh.error?.message ?? 'storage cleared',
);

const failed = results.filter((result) => !result.passed);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length === 0 ? 0 : 1);
