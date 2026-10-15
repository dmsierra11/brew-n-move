import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
  BUDGET_DISCRIMINATOR,
  RECEIPT_DISCRIMINATOR,
  SETTLE_DISCRIMINATOR,
  decodeReceipt,
  displaySettlement,
  encodeBase58,
  encodeSettleData,
  formatMinorEuro,
  parseCommissionBps,
  parseEuroToMinorUnits,
  receiptOwnerMatches,
  rpcForSnapshotNetwork,
  settlementFailure,
  uuidToBytes,
} from '../functions/_shared/settlement.ts';

test('discriminators match the Anchor hashes', () => {
  const instruction = createHash('sha256').update('global:settle_redemption').digest().subarray(0, 8);
  const account = createHash('sha256').update('account:SettlementReceipt').digest().subarray(0, 8);
  assert.deepEqual(instruction, Buffer.from(SETTLE_DISCRIMINATOR));
  assert.deepEqual(account, Buffer.from(RECEIPT_DISCRIMINATOR));
});

test('decodes a receipt without treating submission as confirmation', () => {
  const data = new Uint8Array(97);
  data.set(RECEIPT_DISCRIMINATOR, 0);
  const redemption = uuidToBytes('d3333333-3333-4333-8333-333333333333');
  data.set(redemption, 40);
  const view = new DataView(data.buffer);
  view.setBigUint64(56, 4_000_000n, true);
  view.setBigUint64(64, 800_000n, true);
  view.setBigUint64(72, 160_000n, true);
  view.setBigUint64(80, 640_000n, true);

  const receipt = decodeReceipt(data);
  assert.ok(receipt);
  assert.equal(receipt.budget, encodeBase58(new Uint8Array(32)));
  assert.equal(receipt.redemptionIdHex, 'd3333333333343338333333333333333');
  assert.equal(receipt.originalPrice, 4_000_000n);
  assert.equal(receipt.discount, 800_000n);
  assert.equal(receipt.commission, 160_000n);
  assert.equal(receipt.providerReimbursement, 640_000n);
  assert.equal(decodeReceipt(data.subarray(0, 20)), null);
});

test('encodes the settlement instruction from the frozen amounts', () => {
  const budgetId = Uint8Array.from([1, 2, 3]);
  const redemption = uuidToBytes('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  const data = encodeSettleData(budgetId, redemption, 4_000_000n, 800_000n);
  assert.deepEqual(data.subarray(0, 8), SETTLE_DISCRIMINATOR);
  assert.equal(new DataView(data.buffer).getUint32(8, true), 3);
  assert.deepEqual(data.subarray(12, 15), budgetId);
  assert.deepEqual(data.subarray(15, 31), redemption);
  assert.equal(settlementFailure('Insufficient vault balance'), 'insufficient_vault');
  assert.equal(settlementFailure('custom program error: 0x1781'), 'insufficient_vault');
  assert.equal(settlementFailure('blockhash expired'), 'other');
});

test('receipt lookup uses the snapshot network and owning program', () => {
  const program = 'DHtXZcQnMM5t3L3hAy2JkksbTgC2GenXAHQyexZDA8vL';
  assert.equal(rpcForSnapshotNetwork('devnet'), 'https://api.devnet.solana.com');
  assert.equal(
    rpcForSnapshotNetwork('devnet', { get: (name) => (name === 'SOLANA_DEVNET_RPC' ? 'https://example-devnet.rpc' : undefined) }),
    'https://example-devnet.rpc',
  );
  assert.equal(rpcForSnapshotNetwork('mainnet'), null);
  assert.equal(rpcForSnapshotNetwork('localnet'), null);
  assert.equal(receiptOwnerMatches(program, program), true);
  assert.equal(receiptOwnerMatches('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', program), false);
  assert.equal(receiptOwnerMatches('', program), false);
});

test('confirmed status and Explorer links require a verified receipt', () => {
  const pending = displaySettlement({
    dbStatus: 'confirmed',
    network: 'devnet',
    receiptMatched: false,
    signature: null,
  });
  assert.equal(pending.status, 'pending');
  assert.equal(pending.explorerUrl, null);
  assert.equal(pending.note, 'awaiting_verified_chain_receipt');

  const confirmed = displaySettlement({
    dbStatus: 'confirmed',
    network: 'devnet',
    receiptMatched: true,
    signature: '5'.repeat(88),
  });
  assert.equal(confirmed.status, 'confirmed');
  assert.ok(confirmed.explorerUrl?.includes('explorer.solana.com/tx/'));
  assert.equal(createHash('sha256').update('account:Budget').digest().subarray(0, 8).equals(Buffer.from(BUDGET_DISCRIMINATOR)), true);
  assert.equal(parseCommissionBps('5%'), 500);
  assert.equal(parseEuroToMinorUnits('4.00'), 4_000_000n);
  assert.equal(formatMinorEuro(800_000n), '0.80');
});
