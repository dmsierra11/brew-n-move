// Receipt and settlement instruction encoding for the reward vault.
// Confirmation does not happen here. The database compares these fields
// with the immutable redemption snapshot before it marks a settlement confirmed.

export const SETTLE_DISCRIMINATOR = Uint8Array.from([21, 217, 64, 236, 36, 148, 2, 161]);
export const RECEIPT_DISCRIMINATOR = Uint8Array.from([52, 249, 252, 121, 4, 232, 187, 4]);
export const BUDGET_DISCRIMINATOR = Uint8Array.from([35, 151, 58, 65, 187, 148, 119, 218]);
export const INITIALIZE_DISCRIMINATOR = Uint8Array.from([191, 198, 77, 48, 92, 21, 71, 211]);
export const FUND_DISCRIMINATOR = Uint8Array.from([9, 131, 220, 174, 176, 125, 206, 162]);
export const PAUSE_DISCRIMINATOR = Uint8Array.from([175, 153, 193, 244, 124, 200, 59, 20]);
export const RESUME_DISCRIMINATOR = Uint8Array.from([80, 244, 140, 162, 115, 210, 182, 11]);
export const WITHDRAW_DISCRIMINATOR = Uint8Array.from([74, 165, 203, 217, 210, 117, 140, 198]);

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export type ReceiptFields = {
  budget: string;
  redemptionIdHex: string;
  originalPrice: bigint;
  discount: bigint;
  commission: bigint;
  providerReimbursement: bigint;
};

export function encodeBase58(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) {
    zeros += 1;
  }

  const digits = [0];
  for (let i = zeros; i < bytes.length; i += 1) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j += 1) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  let out = '1'.repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    out += BASE58[digits[i]];
  }
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('\\x') || hex.startsWith('\\X') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(clean)) {
    throw new Error('invalid hex');
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) {
    throw new Error('redemption id must be 16 bytes');
  }
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function encodeSettleData(
  budgetId: Uint8Array,
  redemptionId: Uint8Array,
  originalPrice: bigint,
  discount: bigint,
): Uint8Array {
  if (budgetId.length < 1 || budgetId.length > 32) {
    throw new Error('budget id must be 1 to 32 bytes');
  }
  if (redemptionId.length !== 16) {
    throw new Error('redemption id must be 16 bytes');
  }

  const data = new Uint8Array(8 + 4 + budgetId.length + 16 + 8 + 8);
  data.set(SETTLE_DISCRIMINATOR, 0);
  const view = new DataView(data.buffer);
  view.setUint32(8, budgetId.length, true);
  data.set(budgetId, 12);
  const redemptionAt = 12 + budgetId.length;
  data.set(redemptionId, redemptionAt);
  view.setBigUint64(redemptionAt + 16, originalPrice, true);
  view.setBigUint64(redemptionAt + 24, discount, true);
  return data;
}

export function rpcForSnapshotNetwork(
  network: string,
  env: { get(name: string): string | undefined } = typeof Deno === 'undefined' ? { get: () => undefined } : Deno.env,
): string | null {
  if (network === 'devnet') {
    return env.get('SOLANA_DEVNET_RPC') ?? 'https://api.devnet.solana.com';
  }
  return null;
}

export function receiptOwnerMatches(owner: string, programId: string): boolean {
  return owner.length > 0 && owner === programId;
}

export function decodeReceipt(data: Uint8Array): ReceiptFields | null {
  if (data.length < 97) {
    return null;
  }
  for (let i = 0; i < RECEIPT_DISCRIMINATOR.length; i += 1) {
    if (data[i] !== RECEIPT_DISCRIMINATOR[i]) {
      return null;
    }
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const budget = encodeBase58(data.subarray(8, 40));
  const redemptionIdHex = [...data.subarray(40, 56)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  return {
    budget,
    redemptionIdHex,
    originalPrice: view.getBigUint64(56, true),
    discount: view.getBigUint64(64, true),
    commission: view.getBigUint64(72, true),
    providerReimbursement: view.getBigUint64(80, true),
  };
}

export function settlementFailure(message: string): 'insufficient_vault' | 'other' {
  const text = message.toLowerCase();
  if (
    text.includes('insufficient vault balance')
    || text.includes('custom program error: 0x1781')
    || text.includes('custom program error: 6017')
  ) {
    return 'insufficient_vault';
  }
  return 'other';
}

export type BudgetFields = {
  authority: string;
  commissionBps: number;
  mint: string;
  paused: boolean;
  platformRecipient: string;
  providerRecipient: string;
  settlementCount: bigint;
  totalDeposited: bigint;
  totalPlatformCommissions: bigint;
  totalProviderReimbursements: bigint;
  totalSettled: bigint;
  verifier: string;
  withdrawalDestination: string;
};

export type SettlementDisplay = {
  explorerUrl: string | null;
  note: string | null;
  status: 'pending' | 'processing' | 'confirmed' | 'failed' | 'needs_reconciliation';
};

export function decodeBase58(value: string): Uint8Array | null {
  if (!value) {
    return null;
  }

  let zeros = 0;
  while (zeros < value.length && value[zeros] === '1') {
    zeros += 1;
  }

  const bytes = [0];
  for (let i = zeros; i < value.length; i += 1) {
    const index = BASE58.indexOf(value[i]);
    if (index < 0) {
      return null;
    }
    let carry = index;
    for (let j = 0; j < bytes.length; j += 1) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  const out = new Uint8Array(zeros + bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    out[out.length - 1 - i] = bytes[i];
  }
  return out;
}

export function isOnChainPubkey(value: string): boolean {
  const bytes = decodeBase58(value);
  return bytes !== null && bytes.length === 32;
}

export function decodeBudget(data: Uint8Array): BudgetFields | null {
  if (data.length < 278) {
    return null;
  }
  for (let i = 0; i < BUDGET_DISCRIMINATOR.length; i += 1) {
    if (data[i] !== BUDGET_DISCRIMINATOR[i]) {
      return null;
    }
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return {
    authority: encodeBase58(data.subarray(8, 40)),
    commissionBps: view.getUint16(200, true),
    mint: encodeBase58(data.subarray(72, 104)),
    paused: data[202] === 1,
    platformRecipient: encodeBase58(data.subarray(136, 168)),
    providerRecipient: encodeBase58(data.subarray(104, 136)),
    settlementCount: view.getBigUint64(235, true),
    totalDeposited: view.getBigUint64(203, true),
    totalPlatformCommissions: view.getBigUint64(227, true),
    totalProviderReimbursements: view.getBigUint64(219, true),
    totalSettled: view.getBigUint64(211, true),
    verifier: encodeBase58(data.subarray(40, 72)),
    withdrawalDestination: encodeBase58(data.subarray(168, 200)),
  };
}

export function decodeTokenAmount(data: Uint8Array): bigint | null {
  if (data.length < 72) {
    return null;
  }
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getBigUint64(64, true);
}

export function explorerTransaction(signature: string, network: string): string | null {
  if (network !== 'devnet' || !signature) {
    return null;
  }
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export function explorerAccount(pubkey: string, network: string): string | null {
  if (network !== 'devnet' || !isOnChainPubkey(pubkey)) {
    return null;
  }
  return `https://explorer.solana.com/address/${pubkey}?cluster=devnet`;
}

export function displaySettlement(input: {
  dbStatus: string;
  network: string;
  receiptMatched: boolean;
  signature: string | null;
}): SettlementDisplay {
  if (input.receiptMatched && input.signature && input.dbStatus === 'confirmed') {
    return {
      explorerUrl: explorerTransaction(input.signature, input.network),
      note: null,
      status: 'confirmed',
    };
  }

  const status = input.dbStatus === 'confirmed' ? 'pending' : input.dbStatus;
  const allowed = ['pending', 'processing', 'failed', 'needs_reconciliation'] as const;
  return {
    explorerUrl: null,
    note: input.dbStatus === 'confirmed' ? 'awaiting_verified_chain_receipt' : null,
    status: allowed.includes(status as typeof allowed[number]) ? status as SettlementDisplay['status'] : 'pending',
  };
}

export function parseCommissionBps(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const percent = trimmed.endsWith('%');
  const number = percent ? trimmed.slice(0, -1).trim() : trimmed;
  if (!/^\d+(\.\d{1,2})?$/.test(number)) {
    return null;
  }

  const bps = percent ? Math.round(Number(number) * 100) : Number(number);
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) {
    return null;
  }
  return bps;
}

export function parseEuroToMinorUnits(value: string): bigint | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }
  const [whole, fraction = ''] = trimmed.split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents <= 0n) {
    return null;
  }
  return cents * 10_000n;
}

export function formatMinorEuro(amount: bigint | number | string): string {
  const cents = BigInt(amount) / 10_000n;
  const euros = cents / 100n;
  const remainder = cents % 100n;
  return `${euros.toString()}.${remainder.toString().padStart(2, '0')}`;
}

export function parseBudgetChainId(value: string): Uint8Array | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (/^[0-9a-f]+$/i.test(trimmed) && trimmed.length % 2 === 0) {
    const bytes = new Uint8Array(trimmed.length / 2);
    if (bytes.length < 1 || bytes.length > 32) {
      return null;
    }
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Number.parseInt(trimmed.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }
  const bytes = new TextEncoder().encode(trimmed);
  return bytes.length >= 1 && bytes.length <= 32 ? bytes : null;
}

function requireBudgetId(budgetId: Uint8Array) {
  if (budgetId.length < 1 || budgetId.length > 32) {
    throw new Error('budget id must be 1 to 32 bytes');
  }
}

function encodeBudgetIdPrefix(discriminator: Uint8Array, budgetId: Uint8Array, extra: number) {
  requireBudgetId(budgetId);
  const data = new Uint8Array(8 + 4 + budgetId.length + extra);
  data.set(discriminator, 0);
  new DataView(data.buffer).setUint32(8, budgetId.length, true);
  data.set(budgetId, 12);
  return data;
}

export function encodeInitializeData(
  budgetId: Uint8Array,
  commissionBps: number,
  verifier: Uint8Array,
): Uint8Array {
  if (verifier.length !== 32) {
    throw new Error('verifier must be 32 bytes');
  }
  const data = encodeBudgetIdPrefix(INITIALIZE_DISCRIMINATOR, budgetId, 34);
  const view = new DataView(data.buffer);
  const at = 12 + budgetId.length;
  view.setUint16(at, commissionBps, true);
  data.set(verifier, at + 2);
  return data;
}

export function encodeFundData(budgetId: Uint8Array, amount: bigint): Uint8Array {
  const data = encodeBudgetIdPrefix(FUND_DISCRIMINATOR, budgetId, 8);
  new DataView(data.buffer).setBigUint64(12 + budgetId.length, amount, true);
  return data;
}

export function encodePauseData(budgetId: Uint8Array): Uint8Array {
  return encodeBudgetIdPrefix(PAUSE_DISCRIMINATOR, budgetId, 0);
}

export function encodeResumeData(budgetId: Uint8Array): Uint8Array {
  return encodeBudgetIdPrefix(RESUME_DISCRIMINATOR, budgetId, 0);
}

export function encodeWithdrawData(budgetId: Uint8Array, amount: bigint): Uint8Array {
  const data = encodeBudgetIdPrefix(WITHDRAW_DISCRIMINATOR, budgetId, 8);
  new DataView(data.buffer).setBigUint64(12 + budgetId.length, amount, true);
  return data;
}
