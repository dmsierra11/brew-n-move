import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const pgEnv = { ...process.env, LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8' };

const demoOffer = 'd3333333-3333-4333-8333-333333333333';
const memberId = 'e1111111-1111-4111-8111-111111111111';
const budgetId = 'f1111111-1111-4111-8111-111111111111';
const providerAccount = 'ProviderTokenAccount111111111111111111111';
const replacedProvider = 'ReplacementProvider1111111111111111111111';
const budgetPda = 'BudgetPda111111111111111111111111111111111';
const programId = 'DHtXZcQnMM5t3L3hAy2JkksbTgC2GenXAHQyexZDA8vL';

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('no port'));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

async function database() {
  const dir = await mkdtemp(join(tmpdir(), 'brew-settlement-'));
  const port = await freePort();
  await exec('initdb', ['-D', dir, '--username=postgres', '--auth=trust', '--no-instructions'], { env: pgEnv });
  await exec('pg_ctl', ['-D', dir, '-l', join(dir, 'server.log'), '-o', `-p ${port} -k ${dir}`, 'start'], { env: pgEnv });

  const psql = async (statement) => {
    const { stdout } = await exec('psql', [
      '-h', dir,
      '-p', String(port),
      '-U', 'postgres',
      '-d', 'postgres',
      '-v', 'ON_ERROR_STOP=1',
      '-t', '-A',
      '-c', statement,
    ], { env: pgEnv });
    return stdout.trim();
  };

  await psql(`
    create schema if not exists auth;
    create schema if not exists extensions;
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin nologin; end if;
    end
    $$;
    create table auth.users (
      id uuid primary key,
      email text,
      email_confirmed_at timestamptz
    );
    create or replace function auth.uid() returns uuid
    language sql stable as $$ select null::uuid $$;
  `);

  const files = (await readdir('supabase/migrations')).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = await readFile(join('supabase/migrations', file), 'utf8');
    await psql(sql);
  }

  return {
    async query(statement) {
      const trimmed = statement.trim();
      if (!/^select\b/i.test(trimmed)) {
        await psql(trimmed);
        return [];
      }
      const text = await psql(`select row_to_json(t)::text from (${trimmed}) t`);
      if (!text) {
        return [];
      }
      return text.split('\n').filter(Boolean).map((line) => JSON.parse(line));
    },
    async stop() {
      await exec('pg_ctl', ['-D', dir, 'stop', '-m', 'fast'], { env: pgEnv });
    },
  };
}

async function one(db, statement) {
  const rows = await db.query(statement);
  assert.equal(rows.length, 1, statement);
  return rows[0];
}

test('frozen snapshot survives budget edits and receipt confirmation matches every amount', async (t) => {
  const db = await database();
  t.after(() => db.stop());

  const terms = await one(db, `select version from public.legal_documents where kind = 'terms' and is_current`);
  const privacy = await one(db, `select version from public.legal_documents where kind = 'privacy' and is_current`);

  await db.query(`insert into auth.users (id, email) values ('${memberId}', 'ada@example.com') returning id`);
  await db.query(`
    insert into public.members (
      id, first_name, display_name, terms_version, privacy_version, timezone, region
    ) values (
      '${memberId}', 'Ada', 'Ada', '${terms.version}', '${privacy.version}', 'Europe/Dublin', 'IE'
    ) returning id
  `);
  await db.query(`insert into public.member_balances (member_id, balance) values ('${memberId}', 500) returning member_id`);

  const unlinked = await one(
    db,
    `select private.exchange_offer(
      '${memberId}', '${demoOffer}',
      '11111111-1111-4111-8111-111111111111', true
    ) as result`,
  );
  assert.equal(unlinked.result.reason, 'issued');
  const unlinkedCount = await one(db, `select count(*)::integer as count from private.redemption_economics`);
  assert.equal(unlinkedCount.count, 0);

  await db.query(`
    insert into private.reward_budgets (
      id, name, sponsor_display_name, provider_partner_id, budget_chain_id,
      authority_wallet, verifier_wallet, provider_token_account, platform_token_account,
      withdrawal_token_account, mint, commission_bps, program_id, network,
      budget_pda, vault_pda, init_status, recorded_deposited
    ) values (
      '${budgetId}', 'Demo Sports Brand budget', 'Demo Sports Brand',
      'd1111111-1111-4111-8111-111111111111', decode('01', 'hex'),
      'Authority11111111111111111111111111111111',
      'Verifier111111111111111111111111111111111',
      '${providerAccount}', 'PlatformTokenAccount111111111111111111111',
      'WithdrawalTokenAccount1111111111111111111',
      'Mint1111111111111111111111111111111111111',
      500, '${programId}', 'devnet', '${budgetPda}',
      'VaultPda1111111111111111111111111111111111', 'confirmed', 100000000
    ) returning id
  `);
  await db.query(`
    insert into private.offer_budgets (offer_id, budget_id, active)
    values ('${demoOffer}', '${budgetId}', true) returning offer_id
  `);

  const issued = await one(
    db,
    `select private.exchange_offer(
      '${memberId}', '${demoOffer}',
      '22222222-2222-4222-8222-222222222222', true
    ) as result`,
  );
  assert.equal(issued.result.reason, 'issued');
  const redemptionId = issued.result.redemption_id;
  const pendingBeforeTill = await one(
    db,
    `select count(*)::integer as count from private.settlements where redemption_id = '${redemptionId}'`,
  );
  assert.equal(pendingBeforeTill.count, 0);
  const redeemed = await one(
    db,
    `select private.confirm_till(
      '${memberId}', '${redemptionId}', 53.349805, -6.260310,
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    ) as result`,
  );
  assert.equal(redeemed.result.reason, 'redeemed');
  assert.equal(redeemed.result.redemption_id, redemptionId);
  const economics = await one(
    db,
    `select * from private.redemption_economics where redemption_id = '${redemptionId}'`,
  );
  assert.equal(economics.provider_token_account, providerAccount);
  assert.equal(economics.platform_token_account, 'PlatformTokenAccount111111111111111111111');
  assert.equal(economics.mint, 'Mint1111111111111111111111111111111111111');
  assert.equal(economics.program_id, programId);
  assert.equal(economics.network, 'devnet');
  assert.equal(economics.budget_pda, budgetPda);
  assert.equal(economics.economics_status, 'complete');
  assert.equal(Number(economics.original_amount), 4_000_000);
  assert.equal(Number(economics.discount_amount), 800_000);
  assert.equal(Number(economics.discounted_price), 3_200_000);
  assert.equal(Number(economics.commission_amount), 160_000);
  assert.equal(Number(economics.provider_reimbursement), 640_000);

  const settlement = await one(
    db,
    `select id, status, discount_amount, encode(chain_identifier, 'hex') as chain_hex
     from private.settlements where redemption_id = '${redemptionId}'`,
  );
  assert.equal(settlement.status, 'pending');
  assert.equal(Number(settlement.discount_amount), 800_000);
  assert.equal(settlement.chain_hex, redemptionId.replaceAll('-', ''));
  const points = await one(
    db,
    `select solana_status from private.point_redemptions where redemption_id = '${redemptionId}'`,
  );
  assert.equal(points.solana_status, 'blocked');
  const balance = await one(db, `select balance from public.member_balances where member_id = '${memberId}'`);
  assert.equal(balance.balance, 400);

  await db.query(`
    update private.reward_budgets
    set provider_token_account = '${replacedProvider}',
        commission_bps = 9000,
        program_id = 'ChangedProgram',
        network = 'mainnet'
    where id = '${budgetId}'
    returning id
  `);
  const frozen = await one(
    db,
    `select provider_token_account, commission_bps, program_id, network
     from private.redemption_economics where redemption_id = '${redemptionId}'`,
  );
  assert.equal(frozen.provider_token_account, providerAccount);
  assert.equal(frozen.commission_bps, 500);
  assert.equal(frozen.program_id, programId);
  assert.equal(frozen.network, 'devnet');

  const claimed = await one(db, `select private.claim_reward_settlement('${settlement.id}', null) as result`);
  assert.equal(claimed.result.reason, 'claimed');
  assert.equal(claimed.result.snapshot.provider_token_account, providerAccount);
  assert.equal(claimed.result.snapshot.program_id, programId);
  assert.equal(claimed.result.snapshot.network, 'devnet');
  assert.equal(claimed.result.snapshot.commission_amount, '160000');
  assert.equal(claimed.result.snapshot.original_amount, '4000000');
  assert.equal(claimed.result.snapshot.discount_amount, '800000');
  assert.equal(claimed.result.snapshot.provider_reimbursement, '640000');

  await assert.rejects(() => db.query(`
    update private.settlements set status = 'confirmed' where id = '${settlement.id}' returning id
  `));
  const stillProcessing = await one(db, `select status from private.settlements where id = '${settlement.id}'`);
  assert.equal(stillProcessing.status, 'processing');

  const mismatch = await one(
    db,
    `select private.match_reward_settlement_receipt(
      '${settlement.id}', '${budgetPda}', '${settlement.chain_hex}', 4000000, 800000, 1, 640000, '${programId}'
    ) as result`,
  );
  assert.equal(mismatch.result.reason, 'needs_reconciliation');
  assert.match(mismatch.result.last_error, /commission/);
  const mismatched = await one(db, `select status from private.settlements where id = '${settlement.id}'`);
  assert.equal(mismatched.status, 'needs_reconciliation');

  const wrongOwner = await one(
    db,
    `select private.match_reward_settlement_receipt(
      '${settlement.id}', '${budgetPda}', '${settlement.chain_hex}', 4000000, 800000, 160000, 640000,
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
    ) as result`,
  );
  assert.equal(wrongOwner.result.reason, 'needs_reconciliation');
  assert.match(wrongOwner.result.last_error, /receipt_owner/);
  const ownerRejected = await one(db, `select status from private.settlements where id = '${settlement.id}'`);
  assert.equal(ownerRejected.status, 'needs_reconciliation');

  const confirmed = await one(
    db,
    `select private.match_reward_settlement_receipt(
      '${settlement.id}', '${budgetPda}', '${settlement.chain_hex}', 4000000, 800000, 160000, 640000, '${programId}'
    ) as result`,
  );
  assert.equal(confirmed.result.reason, 'confirmed');
  const stored = await one(
    db,
    `select status, confirmed_at is not null as confirmed from private.settlements where id = '${settlement.id}'`,
  );
  assert.equal(stored.status, 'confirmed');
  assert.equal(stored.confirmed, true);

  const wrongBudget = await one(
    db,
    `select private.match_reward_settlement_receipt(
      '${settlement.id}', 'OtherBudget', '${settlement.chain_hex}', 4000000, 800000, 160000, 640000, '${programId}'
    ) as result`,
  );
  assert.equal(wrongBudget.result.reason, 'receipt_mismatch');
  assert.match(wrongBudget.result.last_error, /budget/);
  const staysConfirmed = await one(db, `select status from private.settlements where id = '${settlement.id}'`);
  assert.equal(staysConfirmed.status, 'confirmed');

  const replayExchange = await one(
    db,
    `select private.exchange_offer(
      '${memberId}', '${demoOffer}',
      '22222222-2222-4222-8222-222222222222', true
    ) as result`,
  );
  assert.equal(replayExchange.result.redemption_id, redemptionId);
  const secondTill = await one(
    db,
    `select private.confirm_till(
      '${memberId}', '${redemptionId}', 53.349805, -6.260310,
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    ) as result`,
  );
  assert.equal(secondTill.result.redemption_id, redemptionId);
  assert.equal(secondTill.result.till_confirmed_at, redeemed.result.till_confirmed_at);
  const settlementCount = await one(
    db,
    `select count(*)::integer as count from private.settlements where redemption_id = '${redemptionId}'`,
  );
  assert.equal(settlementCount.count, 1);
  await assert.rejects(() => db.query(`
    update private.redemption_economics
    set provider_token_account = '${replacedProvider}'
    where redemption_id = '${redemptionId}'
    returning redemption_id
  `));

  await db.query(`
    insert into public.offers (
      id, location_id, slug, title, description, value_label, points_cost, list_price_cents, pay_price_cents
    ) values (
      'd4444444-4444-4444-8444-444444444444',
      'd2222222-2222-4222-8222-222222222222',
      'demo-zero-discount',
      'No discount',
      'Demo offer with no discount.',
      'No discount (demo)',
      50, 400, 400
    ) returning id
  `);
  await db.query(`
    insert into private.offer_budgets (offer_id, budget_id, active)
    values ('d4444444-4444-4444-8444-444444444444', '${budgetId}', true) returning offer_id
  `);
  const zeroIssued = await one(
    db,
    `select private.exchange_offer(
      '${memberId}', 'd4444444-4444-4444-8444-444444444444',
      '33333333-3333-4333-8333-333333333333', true
    ) as result`,
  );
  assert.equal(zeroIssued.result.reason, 'issued');
  const zero = await one(
    db,
    `select private.confirm_till(
      '${memberId}', '${zeroIssued.result.redemption_id}', 53.349805, -6.260310,
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    ) as result`,
  );
  assert.equal(zero.result.reason, 'redeemed');
  const zeroEconomics = await one(
    db,
    `select economics_status, invalid_reasons, discount_amount, commission_amount, provider_reimbursement
     from private.redemption_economics where redemption_id = '${zero.result.redemption_id}'`,
  );
  assert.equal(zeroEconomics.economics_status, 'invalid');
  assert.ok(zeroEconomics.invalid_reasons.includes('discount_not_positive'));
  assert.equal(Number(zeroEconomics.discount_amount), 0);
  assert.equal(zeroEconomics.commission_amount, null);
  assert.equal(zeroEconomics.provider_reimbursement, null);
  const zeroSettlement = await one(
    db,
    `select status, discount_amount, last_error from private.settlements where redemption_id = '${zero.result.redemption_id}'`,
  );
  assert.equal(zeroSettlement.status, 'needs_reconciliation');
  assert.equal(zeroSettlement.discount_amount, null);
  assert.match(zeroSettlement.last_error, /discount_not_positive/);

  const missing = await one(db, `select private.derive_settlement_amounts(null, null, null) as result`);
  assert.equal(missing.result.economics_status, 'invalid');
  assert.equal(missing.result.original_amount, null);
  assert.equal(missing.result.commission_amount, null);
  assert.deepEqual(missing.result.invalid_reasons, [
    'missing_list_price',
    'missing_pay_price',
    'missing_commission_bps',
  ]);

  const wide = await one(db, `select private.derive_settlement_amounts(400, 320, 10000) as result`);
  assert.equal(wide.result.economics_status, 'invalid');
  assert.equal(wide.result.commission_amount, 3_200_000);
  assert.equal(wide.result.provider_reimbursement, null);
  assert.deepEqual(wide.result.invalid_reasons, ['commission_exceeds_discount']);

  await db.query(`
    update private.reward_budgets set commission_bps = 500 where id = '${budgetId}' returning id
  `);
  const queued = await one(db, `select private.queue_demo_settlement_fixture('${budgetId}') as result`);
  assert.equal(queued.result.reason, 'queued');
  await db.query(`
    update private.reward_budgets
    set provider_token_account = 'AfterFixture111111111111111111111111'
    where id = '${budgetId}'
    returning id
  `);
  const fixture = await one(
    db,
    `select provider_token_account, program_id from private.settlement_fixtures where id = '${queued.result.fixture_id}'`,
  );
  assert.equal(fixture.provider_token_account, replacedProvider);
  assert.equal(fixture.program_id, 'ChangedProgram');

  await db.query(`
    update public.offers
    set list_price_cents = 500, pay_price_cents = 100, points_cost = 80
    where id = '${demoOffer}'
    returning id
  `);
  const stillFrozen = await one(
    db,
    `select original_amount, discount_amount, discounted_price from private.redemption_economics where redemption_id = '${redemptionId}'`,
  );
  assert.equal(Number(stillFrozen.original_amount), 4_000_000);
  assert.equal(Number(stillFrozen.discount_amount), 800_000);
  assert.equal(Number(stillFrozen.discounted_price), 3_200_000);

  const belowIssued = await one(
    db,
    `select private.admin_update_campaign_offer(
      '${demoOffer}', '20% off a coffee', 'Demo', '20% off', 400, 320, 50, 1, 'active'
    ) as result`,
  );
  assert.equal(belowIssued.result.reason, 'quantity_below_issued');

  await db.query(`
    update public.offers set list_price_cents = 400, pay_price_cents = 320, points_cost = 50 where id = '${demoOffer}' returning id
  `);
  const hugeQuantity = await one(
    db,
    `select private.admin_update_campaign_offer(
      '${demoOffer}', '20% off a coffee', 'Demo', '20% off', 400, 320, 50, 1000, 'active'
    ) as result`,
  );
  assert.equal(hugeQuantity.result.reason, 'underfunded');

  await db.query(`
    update public.member_balances set balance = 500 where member_id = '${memberId}' returning member_id
  `);
  await db.query(`
    update private.reward_budgets set recorded_deposited = 0 where id = '${budgetId}' returning id
  `);
  const exhausted = await one(
    db,
    `select private.exchange_offer(
      '${memberId}', '${demoOffer}',
      '44444444-4444-4444-8444-444444444444', true
    ) as result`,
  );
  assert.equal(exhausted.result.reason, 'budget_exhausted');

  const leftover = await one(
    db,
    `select count(*)::integer as count from public.offers
     where slug in ('brew-lab-flat-white', 'canal-coffee-pastry', 'oak-and-bean-lunch')`,
  );
  assert.equal(leftover.count, 0);
});
