import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const { dayWindow, localDateInTimeZone, windowsOverlap } = await import(
  '../src/features/earning/localDay.ts'
);

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
    removeItem: (storageKey) => {
      store.delete(storageKey);
    },
    setItem: (storageKey, value) => {
      store.set(storageKey, value);
    },
  };
}

function clientFor() {
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: true,
      storage: memoryStorage(),
      storageKey: 'brew-n-move-auth',
    },
  });
}

async function openAccount(email) {
  const authClient = clientFor();
  const signedUp = await authClient.auth.signUp({
    email,
    options: {
      data: {
        privacy_version: privacy.version,
        terms_version: terms.version,
      },
    },
    password,
  });
  if (signedUp.data.session && signedUp.data.user) {
    return { authClient, session: signedUp.data.session, user: signedUp.data.user };
  }

  const signedIn = await authClient.auth.signInWithPassword({ email, password });
  return {
    authClient,
    session: signedIn.data.session,
    user: signedIn.data.user,
  };
}

async function onboard(account, name) {
  return account.authClient.from('members').insert({
    display_name: name,
    first_name: name,
    id: account.user.id,
    privacy_version: privacy.version,
    region: 'IE',
    terms_version: terms.version,
    timezone: 'Europe/Dublin',
  }).select('privacy_version').single();
}

async function validate(account, body) {
  const { data } = await account.authClient.auth.getSession();
  const response = await fetch(`${url}/functions/v1/validate-steps`, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      apikey: key,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  const payload = await response.json();
  return { status: response.status, ...payload };
}

async function readBalance(account) {
  const { data, error } = await account.authClient
    .from('member_balances')
    .select('balance')
    .eq('member_id', account.user.id)
    .maybeSingle();
  return { balance: data?.balance ?? 0, error };
}

async function readToday(account, timeZone) {
  const { data, error } = await account.authClient
    .from('step_validations')
    .select('awarded_points, step_total, local_date, timezone')
    .eq('member_id', account.user.id)
    .eq('timezone', timeZone)
    .eq('local_date', localDateInTimeZone(new Date(), timeZone))
    .maybeSingle();
  return { error, row: data };
}

const password = 'correct-horse';
const stamp = Date.now();
const anon = clientFor();
const documents = await anon.from('legal_documents').select('kind, version, body, is_current');
const terms = documents.data?.find((document) => document.kind === 'terms' && document.is_current);
const privacy = documents.data?.find((document) => document.kind === 'privacy' && document.is_current);
const previousPrivacy = documents.data?.find((document) => document.kind === 'privacy' && document.version === '2026-10-05');

check('terms version is unchanged', terms?.version === '2026-10-05');
check(
  'accepted privacy text stays intact and is not current',
  previousPrivacy?.is_current === false
    && previousPrivacy.body.includes('stays on this phone until a later validation task'),
);
check(
  'revised privacy draft is current',
  privacy?.version === '2026-10-07'
    && privacy.body.includes('daily step total')
    && privacy.body.includes('does not independently verify'),
);

if (!terms || !privacy) {
  console.log(JSON.stringify(results, null, 2));
  process.exit(1);
}

const accountA = await openAccount(`brew.move.validate.${stamp}@gmail.com`);
const accountB = await openAccount(`brew.move.validate.b.${stamp}@gmail.com`);
const accountC = await openAccount(`brew.move.validate.c.${stamp}@gmail.com`);
check('validation accounts can sign in', Boolean(accountA.user && accountB.user && accountC.user));

if (!accountA.user || !accountB.user || !accountC.user) {
  process.exit(1);
}

const memberA = await onboard(accountA, 'Avery');
const memberB = await onboard(accountB, 'Blair');
await onboard(accountC, 'Casey');
check('members store the current privacy version', memberA.data?.privacy_version === '2026-10-07' && !memberB.error);

const blockedBalance = await accountA.authClient.from('member_balances').insert({
  balance: 999,
  member_id: accountA.user.id,
});
const blockedValidation = await accountA.authClient.from('step_validations').insert({
  awarded_points: 200,
  local_date: '2026-10-07',
  member_id: accountA.user.id,
  source_platform: 'apple_health',
  step_total: 20000,
  timezone: 'Europe/Lisbon',
  window_end: '2026-10-07T23:00:00Z',
  window_start: '2026-10-06T23:00:00Z',
});
const blockedRpc = await accountA.authClient.rpc('validate_steps', {
  p_local_date: '2026-10-07',
  p_member_id: accountA.user.id,
  p_source_platform: 'apple_health',
  p_step_total: 20000,
  p_timezone: 'Europe/Lisbon',
});
check('client cannot write a balance', Boolean(blockedBalance.error));
check('client cannot write a validation', Boolean(blockedValidation.error));
check('client cannot call validate_steps directly', Boolean(blockedRpc.error));

const privacyUpdate = await accountA.authClient.from('members').update({
  privacy_version: '2026-10-05',
}).eq('id', accountA.user.id);
check('client cannot change the accepted privacy version', Boolean(privacyUpdate.error));

const zone = 'Europe/Lisbon';
const today = localDateInTimeZone(new Date(), zone);
const yesterday = localDateInTimeZone(new Date(Date.now() - 36 * 60 * 60 * 1000), zone);
const payload = (stepTotal, localDate = today, timezone = zone) => ({
  localDate,
  sourcePlatform: 'apple_health',
  stepTotal,
  timezone,
});

const invalid = await Promise.all([
  validate(accountA, payload(-1)),
  validate(accountA, payload(1_000_001)),
  validate(accountA, payload(10.5)),
  validate(accountA, { ...payload(2500), sourcePlatform: 'watch' }),
  validate(accountA, { ...payload(2500), timezone: 'Not/AZone' }),
  validate(accountA, payload(2500, yesterday)),
]);
check(
  'invalid and closed days are rejected',
  invalid.every((result) => result.reason === 'invalid_payload' || result.reason === 'day_closed'),
  invalid.map((result) => result.reason).join(', '),
);

const ladder = [2499, 2500, 2501, 4999, 5000, 20000, 25000, 1000];
const ladderResults = [];
for (const steps of ladder) {
  ladderResults.push(await validate(accountA, payload(steps)));
}
const reasons = ladderResults.map((result) => `${result.reason}:${result.awardedDelta ?? 0}`);
check(
  'milestone boundaries award only the upward difference',
  reasons.join('|') === 'no_additional:0|awarded:25|no_additional:0|no_additional:0|awarded:25|awarded:150|no_additional:0|no_additional:0',
  reasons.join('|'),
);

const stored = await readToday(accountA, zone);
const balanceA = await readBalance(accountA);
check(
  'high-water total stays and balance is 200',
  stored.row?.step_total === 25000 && stored.row?.awarded_points === 200 && balanceA.balance === 200,
  `steps ${stored.row?.step_total} points ${stored.row?.awarded_points} balance ${balanceA.balance}`,
);

const repeat = await Promise.all([
  validate(accountA, payload(25000)),
  validate(accountA, payload(25000)),
]);
const balanceAfterRepeat = await readBalance(accountA);
check(
  'repeated claims add nothing',
  repeat.every((result) => result.reason === 'no_additional' && result.awardedDelta === 0)
    && balanceAfterRepeat.balance === 200,
);

const concurrentAccount = accountC;
const concurrent = await Promise.all([
  validate(concurrentAccount, payload(10000)),
  validate(concurrentAccount, payload(10000)),
]);
const concurrentBalance = await readBalance(concurrentAccount);
const awardedDeltas = concurrent.reduce((sum, result) => sum + (result.awardedDelta ?? 0), 0);
check(
  'concurrent same-day requests award once',
  awardedDeltas === 100
    && concurrentBalance.balance === 100
    && concurrent.filter((result) => result.reason === 'awarded').length === 1
    && concurrent.every((result) => result.reason === 'awarded' || result.reason === 'no_additional'),
  `${concurrent.map((result) => result.reason).join(', ')} balance ${concurrentBalance.balance}`,
);

const zones = ['Europe/Lisbon', 'Pacific/Auckland', 'America/New_York', 'Pacific/Kiritimati'];
const windows = zones.map((timezone) => {
  const localDate = localDateInTimeZone(new Date(), timezone);
  return { localDate, timezone, window: dayWindow(localDate, timezone) };
});
const pair = windows.find((left) => windows.some((right) =>
  left.timezone < right.timezone && windowsOverlap(left.window, right.window),
));
const other = pair
  ? windows.find((candidate) => candidate.timezone !== pair.timezone && windowsOverlap(pair.window, candidate.window))
  : null;

if (!pair || !other) {
  check('found overlapping timezones for the concurrency test', false, zones.join(', '));
} else {
  const overlapped = await Promise.all([
    validate(accountB, payload(10000, pair.localDate, pair.timezone)),
    validate(accountB, payload(10000, other.localDate, other.timezone)),
  ]);
  const overlapBalance = await readBalance(accountB);
  const overlapAward = overlapped.reduce((sum, result) => sum + (result.awardedDelta ?? 0), 0);
  check(
    'concurrent overlapping timezones award one window',
    overlapAward === 100 && overlapBalance.balance === 100
      && overlapped.some((result) => result.reason === 'day_overlap'),
    overlapped.map((result) => `${result.timezone ?? ''} ${result.reason}`).join(' | ')
      + ` balance ${overlapBalance.balance}`,
  );
}

const hidden = await accountB.authClient
  .from('member_balances')
  .select('balance')
  .eq('member_id', accountA.user.id);
const hiddenSteps = await accountB.authClient
  .from('step_validations')
  .select('step_total')
  .eq('member_id', accountA.user.id);
check(
  'another account cannot read the balance or validations',
  (hidden.data?.length ?? 0) === 0 && (hiddenSteps.data?.length ?? 0) === 0,
);

const switched = clientFor();
await switched.auth.signInWithPassword({
  email: `brew.move.validate.b.${stamp}@gmail.com`,
  password,
});
const switchedBalance = await switched.from('member_balances').select('balance').eq('member_id', accountB.user.id).maybeSingle();
check(
  'signing in as the other account reads only that balance',
  switchedBalance.data?.balance === 100,
  `balance ${switchedBalance.data?.balance}`,
);

const acknowledged = await fetch(`${url}/functions/v1/acknowledge-privacy`, {
  body: '{}',
  headers: {
    Authorization: `Bearer ${(await accountA.authClient.auth.getSession()).data.session.access_token}`,
    apikey: key,
    'Content-Type': 'application/json',
  },
  method: 'POST',
});
const acknowledgedBody = await acknowledged.json();
check(
  'current privacy acknowledgement does not change the award',
  acknowledgedBody.reason === 'already_current' && (await readBalance(accountA)).balance === 200,
);

if (results.some((result) => !result.passed)) {
  process.exit(1);
}
