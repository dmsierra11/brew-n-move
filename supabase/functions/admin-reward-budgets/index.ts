import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { PublicKey } from 'npm:@solana/web3.js@1.98.4';

import { hexFromBytea, json, keypairBytes, requireAdmin } from '../_shared/admin.ts';
import {
  decodeBudget,
  decodeReceipt,
  decodeTokenAmount,
  displaySettlement,
  explorerAccount,
  hexToBytes,
  isOnChainPubkey,
  parseBudgetChainId,
  parseCommissionBps,
  receiptOwnerMatches,
  rpcForSnapshotNetwork,
} from '../_shared/settlement.ts';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type BudgetRow = {
  authority_wallet: string;
  budget_chain_id: string;
  budget_pda: string | null;
  commission_bps: number;
  id: string;
  init_status: string;
  mint: string;
  name: string;
  network: string;
  platform_token_account: string;
  program_id: string;
  provider_partner_id: string;
  provider_token_account: string;
  sponsor_display_name: string;
  vault_pda: string | null;
  verifier_wallet: string;
  withdrawal_token_account: string;
};

type SettlementRow = {
  budget_id: string;
  chain_identifier: string;
  commission_amount: number | string | null;
  confirmed_at: string | null;
  discount_amount: number | string | null;
  fixture_id: string | null;
  id: string;
  last_error: string | null;
  provider_reimbursement: number | string | null;
  redemption_id: string | null;
  retry_count: number;
  signature: string | null;
  status: string;
};

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function funderPublicKey() {
  const bytes = keypairBytes(Deno.env.get('REWARD_VAULT_ADMIN_FUNDER_KEYPAIR'));
  if (!bytes) {
    return null;
  }
  try {
    return new PublicKey(Uint8Array.from(bytes.slice(32))).toBase58();
  } catch {
    return null;
  }
}

async function rpcAccounts(rpcUrl: string, pubkeys: string[]) {
  const unique = [...new Set(pubkeys.filter((key) => isOnChainPubkey(key)))];
  if (unique.length === 0) {
    return new Map<string, { data: Uint8Array; owner: string } | null>();
  }

  const response = await fetch(rpcUrl, {
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'getMultipleAccounts',
      params: [unique, { commitment: 'confirmed', encoding: 'base64' }],
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('rpc_unavailable');
  }
  const payload = await response.json() as {
    result?: { value?: Array<{ data?: [string, string]; owner?: string } | null> };
  };
  const values = payload.result?.value ?? [];
  const accounts = new Map<string, { data: Uint8Array; owner: string } | null>();
  unique.forEach((key, index) => {
    const account = values[index];
    if (!account?.data?.[0] || !account.owner) {
      accounts.set(key, null);
      return;
    }
    accounts.set(key, {
      data: Uint8Array.from(atob(account.data[0]), (char) => char.charCodeAt(0)),
      owner: account.owner,
    });
  });
  return accounts;
}

function receiptPda(programId: string, budgetPda: string, chainHex: string) {
  if (!isOnChainPubkey(programId) || !isOnChainPubkey(budgetPda)) {
    return null;
  }
  try {
    const redemptionId = hexToBytes(chainHex);
    if (redemptionId.length !== 16) {
      return null;
    }
    const [receipt] = PublicKey.findProgramAddressSync(
      [new TextEncoder().encode('receipt'), new PublicKey(budgetPda).toBytes(), redemptionId],
      new PublicKey(programId),
    );
    return receipt.toBase58();
  } catch {
    return null;
  }
}

function amountsMatch(
  decoded: { commission: bigint; discount: bigint; originalPrice: bigint; providerReimbursement: bigint },
  snapshot: {
    commission_amount?: number | string | null;
    discount_amount?: number | string | null;
    original_amount?: number | string | null;
    provider_reimbursement?: number | string | null;
  },
) {
  return (
    snapshot.original_amount != null
    && snapshot.discount_amount != null
    && snapshot.commission_amount != null
    && snapshot.provider_reimbursement != null
    && decoded.originalPrice === BigInt(snapshot.original_amount)
    && decoded.discount === BigInt(snapshot.discount_amount)
    && decoded.commission === BigInt(snapshot.commission_amount)
    && decoded.providerReimbursement === BigInt(snapshot.provider_reimbursement)
  );
}

async function presentBudget(
  budget: BudgetRow,
  settlements: SettlementRow[],
  partners: Map<string, string>,
  economics: Map<string, Record<string, unknown>>,
  fixtures: Map<string, string>,
) {
  const rpcUrl = rpcForSnapshotNetwork(budget.network);
  let chainAvailable = false;
  let initialized = false;
  let paused: boolean | null = null;
  let vaultBalance: string | null = null;
  let budgetExplorer: string | null = null;
  const receiptMatches = new Map<string, boolean>();

  if (rpcUrl && isOnChainPubkey(budget.program_id)) {
    try {
      const keys = [
        budget.budget_pda,
        budget.vault_pda,
        ...settlements.map((row) => receiptPda(budget.program_id, rowBudgetPda(row, economics, budget), hexFromBytea(row.chain_identifier))),
      ].filter((key): key is string => typeof key === 'string');
      const accounts = await rpcAccounts(rpcUrl, keys);
      chainAvailable = true;
      const budgetAccount = budget.budget_pda ? accounts.get(budget.budget_pda) : null;
      if (budgetAccount && receiptOwnerMatches(budgetAccount.owner, budget.program_id)) {
        const decoded = decodeBudget(budgetAccount.data);
        if (decoded) {
          initialized = true;
          paused = decoded.paused;
          budgetExplorer = explorerAccount(budget.budget_pda ?? '', budget.network);
        }
      }
      const vaultAccount = budget.vault_pda ? accounts.get(budget.vault_pda) : null;
      if (vaultAccount) {
        const amount = decodeTokenAmount(vaultAccount.data);
        vaultBalance = amount?.toString() ?? null;
      }
      for (const row of settlements) {
        const snapshot = economics.get(row.redemption_id ?? '') ?? {};
        const budgetPda = rowBudgetPda(row, economics, budget);
        const pda = receiptPda(String(snapshot.program_id ?? budget.program_id), budgetPda, hexFromBytea(row.chain_identifier));
        const account = pda ? accounts.get(pda) : null;
        const decoded = account ? decodeReceipt(account.data) : null;
        receiptMatches.set(row.id, Boolean(
          account
          && decoded
          && receiptOwnerMatches(account.owner, String(snapshot.program_id ?? budget.program_id))
          && decoded.budget === budgetPda
          && decoded.redemptionIdHex === hexFromBytea(row.chain_identifier)
          && (row.redemption_id ? amountsMatch(decoded, {
            commission_amount: snapshot.commission_amount as number | string | null,
            discount_amount: snapshot.discount_amount as number | string | null,
            original_amount: snapshot.original_amount as number | string | null,
            provider_reimbursement: snapshot.provider_reimbursement as number | string | null,
          }) : (
            decoded.discount === BigInt(row.discount_amount ?? 0)
            && decoded.commission === BigInt(row.commission_amount ?? 0)
            && decoded.providerReimbursement === BigInt(row.provider_reimbursement ?? 0)
          )),
        ));
      }
    } catch {
      chainAvailable = false;
    }
  }

  const presented = settlements.map((row) => {
    const display = displaySettlement({
      dbStatus: row.status,
      network: budget.network,
      receiptMatched: receiptMatches.get(row.id) === true,
      signature: row.signature,
    });
    return {
      amounts: {
        commission: row.commission_amount,
        discount: row.discount_amount,
        providerReimbursement: row.provider_reimbursement,
      },
      displayStatus: display.status,
      explorerUrl: display.explorerUrl,
      fixtureId: row.fixture_id,
      fixtureLabel: row.fixture_id ? fixtures.get(row.fixture_id) ?? 'Labeled fixture' : null,
      id: row.id,
      lastError: row.last_error,
      note: display.note,
      redemptionId: row.redemption_id,
      retryCount: row.retry_count,
      signature: display.status === 'confirmed' ? row.signature : null,
    };
  });

  return {
    authorityWallet: budget.authority_wallet,
    budgetChainId: hexFromBytea(budget.budget_chain_id),
    budgetPda: budget.budget_pda,
    chain: {
      available: chainAvailable,
      explorerUrl: budgetExplorer,
      initialized,
      paused,
      vaultBalance,
    },
    commissionBps: budget.commission_bps,
    id: budget.id,
    initStatus: initialized ? 'confirmed' : budget.init_status,
    mint: budget.mint,
    name: budget.name,
    network: budget.network,
    outstandingUnsecured: presented.some((row) => row.displayStatus !== 'confirmed'),
    pendingSettlements: presented.filter((row) => row.displayStatus !== 'confirmed').length,
    platformTokenAccount: budget.platform_token_account,
    programId: budget.program_id,
    providerPartnerId: budget.provider_partner_id,
    providerPartnerName: partners.get(budget.provider_partner_id) ?? budget.provider_partner_id,
    providerTokenAccount: budget.provider_token_account,
    settlements: presented,
    sponsorDisplayName: budget.sponsor_display_name,
    vaultPda: budget.vault_pda,
    verifierWallet: budget.verifier_wallet,
    withdrawalTokenAccount: budget.withdrawal_token_account,
  };
}

function rowBudgetPda(
  row: SettlementRow,
  economics: Map<string, Record<string, unknown>>,
  budget: BudgetRow,
) {
  const snapshot = economics.get(row.redemption_id ?? '') ?? {};
  const value = snapshot.budget_pda ?? budget.budget_pda;
  return typeof value === 'string' ? value : '';
}

function createPayload(body: unknown) {
  if (!body || typeof body !== 'object') {
    return null;
  }
  const record = body as Record<string, unknown>;
  const commissionBps = parseCommissionBps(text(record.commission));
  const budgetChainId = parseBudgetChainId(text(record.budgetChainId));
  const offerId = text(record.offerId);
  if (!commissionBps || !budgetChainId) {
    return null;
  }
  const fields = {
    authorityWallet: text(record.authorityWallet),
    budgetChainId,
    commissionBps,
    mint: text(record.mint),
    name: text(record.name),
    network: text(record.network) || 'devnet',
    offerId: offerId && uuidPattern.test(offerId) ? offerId : null,
    platformTokenAccount: text(record.platformTokenAccount),
    programId: text(record.programId),
    providerPartnerId: text(record.providerPartnerId),
    providerTokenAccount: text(record.providerTokenAccount),
    sponsorDisplayName: text(record.sponsorDisplayName),
    verifierWallet: text(record.verifierWallet),
    withdrawalTokenAccount: text(record.withdrawalTokenAccount),
  };
  if (
    !fields.name
    || !fields.sponsorDisplayName
    || !uuidPattern.test(fields.providerPartnerId)
    || !fields.authorityWallet
    || !fields.verifierWallet
    || !fields.providerTokenAccount
    || !fields.platformTokenAccount
    || !fields.withdrawalTokenAccount
    || !fields.mint
    || !fields.programId
    || fields.providerTokenAccount === fields.platformTokenAccount
  ) {
    return null;
  }
  return fields;
}

Deno.serve(async (req) => {
  const auth = await requireAdmin(req);
  if ('preflight' in auth && auth.preflight) {
    return auth.preflight;
  }
  if ('error' in auth && auth.error) {
    return auth.error;
  }
  const { admin } = auth;

  if (req.method === 'POST') {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ ok: false, reason: 'invalid_payload' }, 400);
    }
    const payload = createPayload(body);
    if (!payload) {
      return json({ ok: false, reason: 'invalid_payload' }, 400);
    }

    const { data, error } = await admin.rpc('admin_insert_reward_budget', {
      p_authority_wallet: payload.authorityWallet,
      p_budget_chain_id_hex: [...payload.budgetChainId].map((byte) => byte.toString(16).padStart(2, '0')).join(''),
      p_commission_bps: payload.commissionBps,
      p_mint: payload.mint,
      p_name: payload.name,
      p_network: payload.network,
      p_platform_token_account: payload.platformTokenAccount,
      p_program_id: payload.programId,
      p_provider_partner_id: payload.providerPartnerId,
      p_provider_token_account: payload.providerTokenAccount,
      p_sponsor_display_name: payload.sponsorDisplayName,
      p_verifier_wallet: payload.verifierWallet,
      p_withdrawal_token_account: payload.withdrawalTokenAccount,
    });
    const createdId = typeof data === 'string' ? data : null;
    if (error || !createdId) {
      return json({ ok: false, reason: error?.message.includes('reward_budgets_recipients_distinct') ? 'recipient_alias' : 'unavailable' }, 400);
    }

    if (payload.offerId) {
      const linked = await admin.rpc('admin_insert_offer_budget', {
        p_budget_id: createdId,
        p_offer_id: payload.offerId,
      });
      if (linked.error) {
        return json({ id: createdId, ok: false, reason: 'offer_already_linked' }, 409);
      }
    }

    return json({ id: createdId, ok: true });
  }

  if (req.method !== 'GET') {
    return json({ ok: false, reason: 'invalid_payload' }, 405);
  }

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (id && !uuidPattern.test(id)) {
    return json({ ok: false, reason: 'invalid_payload' }, 400);
  }

  const { data: budgetRows, error: budgetError } = await admin.rpc('admin_list_reward_budgets', { p_id: id });
  if (budgetError || budgetRows == null) {
    return json({ ok: false, reason: 'unavailable' }, 500);
  }
  const listed = Array.isArray(budgetRows) ? budgetRows : [budgetRows];

  const { data: settlementRows } = await admin.rpc('admin_list_settlements');
  const { data: partnerRows } = await admin.from('partners').select('id, name');
  const { data: offerRows } = await admin.from('offers').select('id, title, location_id');
  const { data: locationRows } = await admin.from('locations').select('id, partner_id, name');
  const { data: fixtureRows } = await admin.rpc('admin_list_settlement_fixtures');
  const settlements = (Array.isArray(settlementRows) ? settlementRows : settlementRows ? [settlementRows] : []) as SettlementRow[];
  const redemptionIds = settlements.map((row) => row.redemption_id).filter((value): value is string => typeof value === 'string');
  const { data: economicsRows } = redemptionIds.length > 0
    ? await admin.rpc('admin_list_redemption_economics', { p_redemption_ids: redemptionIds })
    : { data: [] };
  const economicsList = Array.isArray(economicsRows) ? economicsRows : economicsRows ? [economicsRows] : [];
  const fixtureList = Array.isArray(fixtureRows) ? fixtureRows : fixtureRows ? [fixtureRows] : [];

  const partners = new Map((partnerRows ?? []).map((row) => [row.id as string, row.name as string]));
  const locations = new Map((locationRows ?? []).map((row) => [row.id as string, row]));
  const fixtures = new Map(fixtureList.map((row) => [row.id as string, row.label as string]));
  const economics = new Map(economicsList.map((row) => [row.redemption_id as string, row as Record<string, unknown>]));

  const presented = [];
  for (const budget of listed as BudgetRow[]) {
    presented.push(await presentBudget(
      budget,
      settlements.filter((row) => row.budget_id === budget.id),
      partners,
      economics,
      fixtures,
    ));
  }

  const offers = (offerRows ?? []).map((offer) => {
    const location = locations.get(offer.location_id as string);
    return {
      id: offer.id,
      partnerName: location ? partners.get(location.partner_id as string) ?? '' : '',
      title: offer.title,
    };
  });

  if (id) {
    if (presented.length === 0) {
      return json({ ok: false, reason: 'not_found' }, 404);
    }
    const { data: cover } = await admin.rpc('admin_campaign_cover', { p_budget_id: id });
    const { data: campaigns } = await admin.rpc('admin_list_budget_offers', { p_budget_id: id });
    return json({
      adminFunderPublicKey: funderPublicKey(),
      budget: presented[0],
      campaigns: Array.isArray(campaigns) ? campaigns : campaigns ? [campaigns] : [],
      cover: cover ?? null,
      offers,
      ok: true,
      partners: partnerRows ?? [],
    });
  }

  return json({
    adminFunderPublicKey: funderPublicKey(),
    budgets: presented.map((budget) => ({
      chain: budget.chain,
      id: budget.id,
      initStatus: budget.initStatus,
      name: budget.name,
      outstandingUnsecured: budget.outstandingUnsecured,
      pendingSettlements: budget.pendingSettlements,
      providerPartnerName: budget.providerPartnerName,
      sponsorDisplayName: budget.sponsorDisplayName,
    })),
    offers,
    ok: true,
    partners: partnerRows ?? [],
  });
});
