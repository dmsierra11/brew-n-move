import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'npm:@supabase/supabase-js@2';
import { Buffer } from 'node:buffer';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from 'npm:@solana/web3.js@1.98.4';

import {
  decodeReceipt,
  encodeSettleData,
  receiptOwnerMatches,
  rpcForSnapshotNetwork,
  settlementFailure,
} from '../_shared/settlement.ts';

// Builds a settlement from the frozen snapshot only. A successful send does not
// mark the row confirmed. The database compares the receipt with that snapshot.

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Snapshot = {
  authority_wallet: string;
  budget_chain_id: string;
  budget_pda: string;
  chain_identifier: string;
  commission_amount: string;
  discount_amount: string;
  economics_status: string;
  mint: string;
  network: string;
  original_amount: string;
  platform_token_account: string;
  program_id: string;
  provider_reimbursement: string;
  provider_token_account: string;
  vault_pda: string;
};

type ClaimResult = {
  last_error?: string;
  ok?: boolean;
  reason?: string;
  settlement_id?: string;
  signature?: string | null;
  snapshot?: Snapshot;
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  });
}

function verifierFromEnv(): Keypair | null {
  const raw = Deno.env.get('REWARD_VAULT_VERIFIER_KEYPAIR');
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length < 64 || parsed.some((part) => typeof part !== 'number')) {
      return null;
    }
    return Keypair.fromSecretKey(Uint8Array.from(parsed));
  } catch {
    return null;
  }
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
    throw new Error('invalid hex');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function accountsFromSnapshot(snapshot: Snapshot) {
  const programId = new PublicKey(snapshot.program_id);
  const authority = new PublicKey(snapshot.authority_wallet);
  const budgetId = hexToBytes(snapshot.budget_chain_id);
  const redemptionId = hexToBytes(snapshot.chain_identifier);
  const [budget] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('budget'), authority.toBytes(), budgetId],
    programId,
  );
  const [vault] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('vault'), budget.toBytes()],
    programId,
  );
  const [receipt] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('receipt'), budget.toBytes(), redemptionId],
    programId,
  );

  return {
    authority,
    budget,
    budgetId,
    mint: new PublicKey(snapshot.mint),
    platform: new PublicKey(snapshot.platform_token_account),
    programId,
    provider: new PublicKey(snapshot.provider_token_account),
    receipt,
    redemptionId,
    vault,
  };
}

async function settleClaimed(
  admin: ReturnType<typeof createClient>,
  claim: ClaimResult,
) {
  const settlementId = claim.settlement_id;
  const snapshot = claim.snapshot;
  if (!settlementId || !snapshot) {
    return { ok: false, reason: 'idle' };
  }

  const rpcUrl = rpcForSnapshotNetwork(snapshot.network);
  if (!rpcUrl) {
    const { data } = await admin.rpc('reconcile_reward_settlement', {
      p_error: 'unexpected_network',
      p_settlement_id: settlementId,
    });
    return data ?? { ok: false, reason: 'unexpected_network' };
  }

  if (
    snapshot.economics_status !== 'complete'
    || snapshot.original_amount == null
    || snapshot.discount_amount == null
    || snapshot.commission_amount == null
    || snapshot.provider_reimbursement == null
  ) {
    const { data } = await admin.rpc('reconcile_reward_settlement', {
      p_error: 'null_amounts',
      p_settlement_id: settlementId,
    });
    return data ?? { ok: false, reason: 'null_amounts' };
  }

  let accounts: ReturnType<typeof accountsFromSnapshot>;
  try {
    accounts = accountsFromSnapshot(snapshot);
  } catch {
    const { data } = await admin.rpc('reconcile_reward_settlement', {
      p_error: 'invalid_settlement_identity',
      p_settlement_id: settlementId,
    });
    return data ?? { ok: false, reason: 'invalid_settlement_identity' };
  }

  if (accounts.budget.toBase58() !== snapshot.budget_pda || accounts.vault.toBase58() !== snapshot.vault_pda) {
    const { data } = await admin.rpc('reconcile_reward_settlement', {
      p_error: 'budget_pda_mismatch',
      p_settlement_id: settlementId,
    });
    return data ?? { ok: false, reason: 'budget_pda_mismatch' };
  }

  const connection = new Connection(rpcUrl, 'confirmed');
  const receiptInfo = await connection.getAccountInfo(accounts.receipt, 'confirmed');
  if (receiptInfo) {
    return matchOwnedReceipt(admin, settlementId, snapshot, receiptInfo);
  }

  if (claim.signature) {
    const status = await connection.getSignatureStatuses([claim.signature]);
    const value = status.value[0];
    if (!value) {
      return { ok: true, reason: 'processing', settlement_id: settlementId };
    }
    if (value.err) {
      const message = JSON.stringify(value.err);
      if (settlementFailure(message) === 'insufficient_vault') {
        const { data } = await admin.rpc('fail_reward_settlement', {
          p_error: 'insufficient_vault',
          p_settlement_id: settlementId,
        });
        return data ?? { ok: true, reason: 'failed' };
      }
      const { data } = await admin.rpc('reconcile_reward_settlement', {
        p_error: 'signature_failed',
        p_settlement_id: settlementId,
      });
      return data ?? { ok: true, reason: 'needs_reconciliation' };
    }
    const { data } = await admin.rpc('reconcile_reward_settlement', {
      p_error: 'missing_receipt',
      p_settlement_id: settlementId,
    });
    return data ?? { ok: true, reason: 'needs_reconciliation' };
  }

  const verifier = verifierFromEnv();
  if (!verifier) {
    return { ok: false, reason: 'verifier_keypair_unavailable', settlement_id: settlementId };
  }

  const instruction = new TransactionInstruction({
    data: Buffer.from(encodeSettleData(
      accounts.budgetId,
      accounts.redemptionId,
      BigInt(snapshot.original_amount),
      BigInt(snapshot.discount_amount),
    )),
    keys: [
      { isSigner: false, isWritable: true, pubkey: accounts.budget },
      { isSigner: false, isWritable: false, pubkey: accounts.authority },
      { isSigner: true, isWritable: true, pubkey: verifier.publicKey },
      { isSigner: false, isWritable: true, pubkey: accounts.vault },
      { isSigner: false, isWritable: true, pubkey: accounts.provider },
      { isSigner: false, isWritable: true, pubkey: accounts.platform },
      { isSigner: false, isWritable: true, pubkey: accounts.receipt },
      { isSigner: false, isWritable: false, pubkey: accounts.mint },
      { isSigner: false, isWritable: false, pubkey: TOKEN_PROGRAM_ID },
      { isSigner: false, isWritable: false, pubkey: SystemProgram.programId },
    ],
    programId: accounts.programId,
  });

  const transaction = new Transaction().add(instruction);
  transaction.feePayer = verifier.publicKey;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.sign(verifier);

  let signature: string;
  try {
    signature = await connection.sendRawTransaction(transaction.serialize(), { skipPreflight: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'send_failed';
    if (settlementFailure(message) === 'insufficient_vault') {
      const { data } = await admin.rpc('fail_reward_settlement', {
        p_error: 'insufficient_vault',
        p_settlement_id: settlementId,
      });
      return data ?? { ok: true, reason: 'failed' };
    }
    return { ok: false, reason: 'send_failed', settlement_id: settlementId };
  }

  const recorded = await admin.rpc('record_reward_settlement_signature', {
    p_settlement_id: settlementId,
    p_signature: signature,
  });
  if (recorded.data?.reason === 'needs_reconciliation') {
    return recorded.data;
  }

  try {
    const confirmation = await connection.confirmTransaction(
      { blockhash, lastValidBlockHeight, signature },
      'confirmed',
    );
    if (confirmation.value.err) {
      const message = JSON.stringify(confirmation.value.err);
      if (settlementFailure(message) === 'insufficient_vault') {
        const { data } = await admin.rpc('fail_reward_settlement', {
          p_error: 'insufficient_vault',
          p_settlement_id: settlementId,
        });
        return data ?? { ok: true, reason: 'failed' };
      }
      const { data } = await admin.rpc('reconcile_reward_settlement', {
        p_error: 'signature_failed',
        p_settlement_id: settlementId,
      });
      return data ?? { ok: true, reason: 'needs_reconciliation' };
    }
  } catch {
    return { ok: true, reason: 'processing', settlement_id: settlementId };
  }

  const confirmedReceipt = await connection.getAccountInfo(accounts.receipt, 'confirmed');
  if (!confirmedReceipt) {
    return { ok: true, reason: 'processing', settlement_id: settlementId };
  }
  return matchOwnedReceipt(admin, settlementId, snapshot, confirmedReceipt);
}

async function matchOwnedReceipt(
  admin: ReturnType<typeof createClient>,
  settlementId: string,
  snapshot: Snapshot,
  receiptInfo: { data: Uint8Array; owner: { toBase58(): string } },
) {
  const owner = receiptInfo.owner.toBase58();
  if (!receiptOwnerMatches(owner, snapshot.program_id)) {
    const { data } = await admin.rpc('reconcile_reward_settlement', {
      p_error: 'receipt_owner_mismatch',
      p_settlement_id: settlementId,
    });
    return data ?? { ok: false, reason: 'receipt_owner_mismatch' };
  }

  const decoded = decodeReceipt(receiptInfo.data);
  if (!decoded) {
    const { data } = await admin.rpc('reconcile_reward_settlement', {
      p_error: 'undecodable_receipt',
      p_settlement_id: settlementId,
    });
    return data ?? { ok: false, reason: 'undecodable_receipt' };
  }

  const { data } = await admin.rpc('match_reward_settlement_receipt', {
    p_budget_pda: decoded.budget,
    p_commission_amount: decoded.commission.toString(),
    p_discount_amount: decoded.discount.toString(),
    p_original_amount: decoded.originalPrice.toString(),
    p_provider_reimbursement: decoded.providerReimbursement.toString(),
    p_receipt_owner: owner,
    p_redemption_id_hex: decoded.redemptionIdHex,
    p_settlement_id: settlementId,
  });
  return data ?? { ok: false, reason: 'unavailable' };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ ok: false, reason: 'invalid_payload' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authHeader = req.headers.get('Authorization') ?? '';
  const bearer = authHeader.replace(/^Bearer\s+/i, '');
  let allowed = bearer.length > 0 && bearer === serviceKey;

  if (!allowed && bearer) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data, error } = await userClient.auth.getUser(bearer);
    allowed = !error && data.user?.app_metadata?.role === 'admin';
  }

  if (!allowed) {
    return json({ ok: false, reason: 'not_authorized' }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: 'invalid_payload' }, 400);
  }

  const record = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const settlementId = typeof record.settlementId === 'string' ? record.settlementId : null;
  const redemptionId = typeof record.redemptionId === 'string' ? record.redemptionId : null;
  if (settlementId && !uuidPattern.test(settlementId)) {
    return json({ ok: false, reason: 'invalid_payload' }, 400);
  }
  if (redemptionId && !uuidPattern.test(redemptionId)) {
    return json({ ok: false, reason: 'invalid_payload' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data, error } = await admin.rpc('claim_reward_settlement', {
    p_redemption_id: redemptionId,
    p_settlement_id: settlementId,
  });
  if (error || !data) {
    return json({ ok: false, reason: 'unavailable' }, 500);
  }

  const claim = data as ClaimResult;
  if (claim.reason !== 'claimed') {
    return json({
      lastError: claim.last_error ?? null,
      ok: claim.ok ?? true,
      reason: claim.reason ?? 'idle',
      settlementId: claim.settlement_id ?? null,
    });
  }

  try {
    const result = await settleClaimed(admin, claim) as { ok?: boolean; reason?: string };
    return json({
      ok: result.ok ?? false,
      reason: result.reason ?? 'unavailable',
      settlementId: claim.settlement_id ?? null,
    });
  } catch {
    return json({ ok: false, reason: 'unavailable', settlementId: claim.settlement_id ?? null }, 500);
  }
});
