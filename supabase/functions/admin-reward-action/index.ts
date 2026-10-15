import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { Buffer } from 'node:buffer';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from 'npm:@solana/web3.js@1.98.4';
import { getAssociatedTokenAddressSync } from 'npm:@solana/spl-token@0.4.13';

import { hexFromBytea, json, keypairBytes, requireAdmin } from '../_shared/admin.ts';
import {
  displaySettlement,
  encodeFundData,
  encodeInitializeData,
  encodePauseData,
  encodeResumeData,
  encodeWithdrawData,
  hexToBytes,
  isOnChainPubkey,
  parseEuroToMinorUnits,
  rpcForSnapshotNetwork,
} from '../_shared/settlement.ts';

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type BudgetRow = {
  authority_wallet: string;
  budget_chain_id: string;
  budget_pda: string | null;
  commission_bps: number;
  id: string;
  mint: string;
  network: string;
  platform_token_account: string;
  program_id: string;
  provider_token_account: string;
  vault_pda: string | null;
  verifier_wallet: string;
  withdrawal_token_account: string;
};

function keypairFromEnv(name: string) {
  const bytes = keypairBytes(Deno.env.get(name));
  if (!bytes) {
    return null;
  }
  try {
    return Keypair.fromSecretKey(Uint8Array.from(bytes));
  } catch {
    return null;
  }
}

function derivedAccounts(budget: BudgetRow) {
  if (!isOnChainPubkey(budget.program_id) || !isOnChainPubkey(budget.authority_wallet)) {
    throw new Error('invalid_settlement_identity');
  }
  const programId = new PublicKey(budget.program_id);
  const authority = new PublicKey(budget.authority_wallet);
  const budgetId = hexToBytes(hexFromBytea(budget.budget_chain_id));
  const [pda] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('budget'), authority.toBytes(), budgetId],
    programId,
  );
  const [vault] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('vault'), pda.toBytes()],
    programId,
  );
  return { authority, budgetId, pda, programId, vault };
}

async function sendInstruction(
  budget: BudgetRow,
  feePayer: Keypair,
  instruction: TransactionInstruction,
) {
  const rpcUrl = rpcForSnapshotNetwork(budget.network);
  if (!rpcUrl) {
    return { ok: false, reason: 'unexpected_network' };
  }
  const connection = new Connection(rpcUrl, 'confirmed');
  const transaction = new Transaction().add(instruction);
  transaction.feePayer = feePayer.publicKey;
  const latest = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = latest.blockhash;
  transaction.sign(feePayer);
  const signature = await connection.sendRawTransaction(transaction.serialize());
  const confirmation = await connection.confirmTransaction({
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
    signature,
  }, 'confirmed');
  if (confirmation.value.err) {
    return { ok: false, reason: 'signature_failed', signature };
  }
  return { ok: true, signature };
}

Deno.serve(async (req) => {
  const auth = await requireAdmin(req);
  if ('preflight' in auth && auth.preflight) {
    return auth.preflight;
  }
  if ('error' in auth && auth.error) {
    return auth.error;
  }
  const { admin, authHeader, supabaseUrl } = auth;

  if (req.method !== 'POST') {
    return json({ ok: false, reason: 'invalid_payload' }, 405);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: 'invalid_payload' }, 400);
  }
  const record = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const action = typeof record.action === 'string' ? record.action : '';
  const budgetId = typeof record.budgetId === 'string' ? record.budgetId : '';
  const settlementId = typeof record.settlementId === 'string' ? record.settlementId : '';
  if (budgetId && !uuidPattern.test(budgetId)) {
    return json({ ok: false, reason: 'invalid_payload' }, 400);
  }
  if (settlementId && !uuidPattern.test(settlementId)) {
    return json({ ok: false, reason: 'invalid_payload' }, 400);
  }

  if (action === 'retry') {
    if (!settlementId) {
      return json({ ok: false, reason: 'invalid_payload' }, 400);
    }
    const response = await fetch(`${supabaseUrl}/functions/v1/settle-reward`, {
      body: JSON.stringify({ settlementId }),
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
    const payload = await response.json() as Record<string, unknown>;
    return json({ ...payload, ok: payload.ok === true }, response.ok ? 200 : response.status);
  }

  if (!budgetId) {
    return json({ ok: false, reason: 'invalid_payload' }, 400);
  }

  const { data: budgetRows, error } = await admin.rpc('admin_list_reward_budgets', { p_id: budgetId });
  const budget = Array.isArray(budgetRows) ? budgetRows[0] : budgetRows;
  if (error || !budget) {
    return json({ ok: false, reason: 'not_found' }, 404);
  }
  const row = budget as BudgetRow;

  if (action === 'queue-fixture') {
    const queued = await admin.rpc('queue_demo_settlement_fixture', { p_budget_id: budgetId });
    return json(queued.data ?? { ok: false, reason: 'unavailable' }, queued.error ? 500 : 200);
  }

  if (action === 'create-campaign' || action === 'update-campaign') {
    const title = typeof record.title === 'string' ? record.title.trim() : '';
    const description = typeof record.description === 'string' ? record.description.trim() : '';
    const valueLabel = typeof record.valueLabel === 'string' ? record.valueLabel.trim() : '';
    const listPriceCents = Number(record.listPriceCents);
    const payPriceCents = Number(record.payPriceCents);
    const pointsCost = Number(record.pointsCost);
    const quantity = Number(record.quantity);
    const expiresAt = typeof record.expiresAt === 'string' && record.expiresAt ? record.expiresAt : null;
    const collectStart = typeof record.collectStart === 'string' && record.collectStart ? record.collectStart : null;
    const collectEnd = typeof record.collectEnd === 'string' && record.collectEnd ? record.collectEnd : null;
    if (!title || !description || !valueLabel || !Number.isInteger(listPriceCents) || !Number.isInteger(payPriceCents)
      || !Number.isInteger(pointsCost) || !Number.isInteger(quantity)) {
      return json({ ok: false, reason: 'invalid_payload' }, 400);
    }
    if (action === 'create-campaign') {
      const slug = `campaign-${crypto.randomUUID()}`;
      const inserted = await admin.rpc('admin_insert_campaign_offer', {
        p_budget_id: budgetId,
        p_description: description,
        p_list_price_cents: listPriceCents,
        p_location_id: 'd2222222-2222-4222-8222-222222222222',
        p_pay_price_cents: payPriceCents,
        p_points_cost: pointsCost,
        p_quantity: quantity,
        p_slug: slug,
        p_title: title,
        p_value_label: valueLabel,
      });
      const payload = inserted.data as { id?: string; ok?: boolean; reason?: string } | null;
      if (inserted.error || !payload?.ok || !payload.id) {
        return json({ ok: false, reason: payload?.reason ?? 'unavailable' }, 400);
      }
      if (expiresAt || collectStart || collectEnd) {
        await admin.from('offers').update({
          collect_end: collectEnd,
          collect_start: collectStart,
          expires_at: expiresAt,
        }).eq('id', payload.id);
      }
      return json({ id: payload.id, ok: true });
    }
    const offerId = typeof record.offerId === 'string' ? record.offerId : '';
    const status = record.status === 'active' || record.status === 'paused' ? record.status : '';
    if (!uuidPattern.test(offerId) || !status) {
      return json({ ok: false, reason: 'invalid_payload' }, 400);
    }
    const updated = await admin.rpc('admin_update_campaign_offer', {
      p_description: description,
      p_list_price_cents: listPriceCents,
      p_offer_id: offerId,
      p_pay_price_cents: payPriceCents,
      p_points_cost: pointsCost,
      p_quantity: quantity,
      p_status: status,
      p_title: title,
      p_value_label: valueLabel,
    });
    const payload = updated.data as { ok?: boolean; reason?: string } | null;
    if (updated.error || !payload?.ok) {
      const reason = payload?.reason ?? 'unavailable';
      return json({ ok: false, reason }, reason === 'underfunded' || reason === 'quantity_below_issued' ? 409 : 400);
    }
    await admin.from('offers').update({
      collect_end: collectEnd,
      collect_start: collectStart,
      expires_at: expiresAt,
    }).eq('id', offerId);
    return json({ ok: true });
  }

  let accounts: ReturnType<typeof derivedAccounts>;
  try {
    accounts = derivedAccounts(row);
    for (const value of [row.mint, row.provider_token_account, row.platform_token_account, row.withdrawal_token_account]) {
      if (!isOnChainPubkey(value)) {
        throw new Error('invalid_settlement_identity');
      }
    }
  } catch {
    return json({ ok: false, reason: 'invalid_settlement_identity' }, 400);
  }

  if (action === 'initialize') {
    const authority = keypairFromEnv('REWARD_VAULT_AUTHORITY_KEYPAIR');
    const verifier = decodeBase58Safe(row.verifier_wallet);
    if (!authority || !verifier) {
      return json({ ok: false, reason: 'authority_keypair_unavailable' }, 503);
    }
    if (authority.publicKey.toBase58() !== row.authority_wallet) {
      return json({ ok: false, reason: 'authority_mismatch' }, 400);
    }
    const sent = await sendInstruction(row, authority, new TransactionInstruction({
      data: Buffer.from(encodeInitializeData(accounts.budgetId, row.commission_bps, verifier)),
      keys: [
        { isSigner: false, isWritable: true, pubkey: accounts.pda },
        { isSigner: false, isWritable: true, pubkey: accounts.vault },
        { isSigner: false, isWritable: false, pubkey: new PublicKey(row.mint) },
        { isSigner: false, isWritable: false, pubkey: new PublicKey(row.provider_token_account) },
        { isSigner: false, isWritable: false, pubkey: new PublicKey(row.platform_token_account) },
        { isSigner: false, isWritable: false, pubkey: new PublicKey(row.withdrawal_token_account) },
        { isSigner: true, isWritable: true, pubkey: authority.publicKey },
        { isSigner: false, isWritable: false, pubkey: TOKEN_PROGRAM_ID },
        { isSigner: false, isWritable: false, pubkey: SystemProgram.programId },
      ],
      programId: accounts.programId,
    }));
    if (!sent.ok) {
      await admin.rpc('admin_update_reward_budget', { p_id: budgetId, p_init_status: 'failed' });
      return json(sent, 400);
    }
    const rpcUrl = rpcForSnapshotNetwork(row.network);
    const connection = new Connection(rpcUrl ?? '', 'confirmed');
    const info = await connection.getAccountInfo(accounts.pda, 'confirmed');
    if (!info || info.owner.toBase58() !== row.program_id) {
      await admin.rpc('admin_update_reward_budget', { p_id: budgetId, p_init_status: 'failed' });
      return json({ ok: false, reason: 'init_not_confirmed' }, 400);
    }
    await admin.rpc('admin_update_reward_budget', {
      p_budget_pda: accounts.pda.toBase58(),
      p_id: budgetId,
      p_init_status: 'confirmed',
      p_vault_pda: accounts.vault.toBase58(),
    });
    return json({ budgetPda: accounts.pda.toBase58(), ok: true, signature: sent.signature, vaultPda: accounts.vault.toBase58() });
  }

  if (action === 'fund' || action === 'withdraw') {
    const amount = typeof record.amount === 'string' ? parseEuroToMinorUnits(record.amount) : null;
    if (!amount) {
      return json({ ok: false, reason: 'invalid_payload' }, 400);
    }

    if (action === 'withdraw') {
      const { data: settlements } = await admin.rpc('admin_list_settlements', { p_budget_id: budgetId });
      const settlementList = Array.isArray(settlements) ? settlements : settlements ? [settlements] : [];
      const outstanding = settlementList.some((item) => displaySettlement({
        dbStatus: item.status as string,
        network: row.network,
        receiptMatched: false,
        signature: item.signature as string | null,
      }).status !== 'confirmed' || !item.signature);
      if (outstanding) {
        return json({
          ok: false,
          reason: 'outstanding_reimbursements_unsecured',
          warning: 'Outstanding reimbursements are not reserved on-chain. Withdrawal is refused until every settlement for this budget is chain-confirmed.',
        }, 409);
      }
      const authority = keypairFromEnv('REWARD_VAULT_AUTHORITY_KEYPAIR');
      if (!authority) {
        return json({ ok: false, reason: 'authority_keypair_unavailable' }, 503);
      }
      const sent = await sendInstruction(row, authority, new TransactionInstruction({
        data: Buffer.from(encodeWithdrawData(accounts.budgetId, amount)),
        keys: [
          { isSigner: false, isWritable: false, pubkey: accounts.pda },
          { isSigner: true, isWritable: true, pubkey: authority.publicKey },
          { isSigner: false, isWritable: true, pubkey: accounts.vault },
          { isSigner: false, isWritable: true, pubkey: new PublicKey(row.withdrawal_token_account) },
          { isSigner: false, isWritable: false, pubkey: new PublicKey(row.mint) },
          { isSigner: false, isWritable: false, pubkey: TOKEN_PROGRAM_ID },
        ],
        programId: accounts.programId,
      }));
      return json(sent, sent.ok ? 200 : 400);
    }

    const funder = keypairFromEnv('REWARD_VAULT_ADMIN_FUNDER_KEYPAIR');
    if (!funder) {
      return json({ ok: false, reason: 'admin_funder_unavailable' }, 503);
    }
    const source = getAssociatedTokenAddressSync(new PublicKey(row.mint), funder.publicKey);
    const sent = await sendInstruction(row, funder, new TransactionInstruction({
      data: Buffer.from(encodeFundData(accounts.budgetId, amount)),
      keys: [
        { isSigner: false, isWritable: true, pubkey: accounts.pda },
        { isSigner: false, isWritable: false, pubkey: accounts.authority },
        { isSigner: false, isWritable: true, pubkey: accounts.vault },
        { isSigner: false, isWritable: true, pubkey: source },
        { isSigner: false, isWritable: false, pubkey: new PublicKey(row.mint) },
        { isSigner: true, isWritable: false, pubkey: funder.publicKey },
        { isSigner: false, isWritable: false, pubkey: TOKEN_PROGRAM_ID },
      ],
      programId: accounts.programId,
    }));
    if (sent.ok) {
      const recorded = await admin.rpc('admin_add_deposited', { p_amount: Number(amount), p_id: budgetId });
      if (recorded.error) {
        return json({
          ...sent,
          funder: funder.publicKey.toBase58(),
          ok: false,
          reason: 'deposit_not_recorded',
          warning: 'Tokens reached the vault, but shared cover was not updated. Do not Fund again until this is repaired.',
        }, 500);
      }
    }
    return json({
      ...sent,
      funder: funder.publicKey.toBase58(),
      warning: 'Outstanding reimbursements are not reserved on-chain.',
    }, sent.ok ? 200 : 400);
  }

  if (action === 'pause' || action === 'resume') {
    const authority = keypairFromEnv('REWARD_VAULT_AUTHORITY_KEYPAIR');
    if (!authority) {
      return json({ ok: false, reason: 'authority_keypair_unavailable' }, 503);
    }
    const sent = await sendInstruction(row, authority, new TransactionInstruction({
      data: Buffer.from(action === 'pause' ? encodePauseData(accounts.budgetId) : encodeResumeData(accounts.budgetId)),
      keys: [
        { isSigner: false, isWritable: true, pubkey: accounts.pda },
        { isSigner: true, isWritable: false, pubkey: authority.publicKey },
      ],
      programId: accounts.programId,
    }));
    return json(sent, sent.ok ? 200 : 400);
  }

  return json({ ok: false, reason: 'invalid_payload' }, 400);
});

function decodeBase58Safe(value: string) {
  try {
    return new PublicKey(value).toBytes();
  } catch {
    return null;
  }
}
