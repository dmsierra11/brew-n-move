import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as anchor from "@anchor-lang/core";
import anchorCore from "@anchor-lang/core";
const { BN } = anchorCore;
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotent,
  createMint,
  getAccount,
  getAssociatedTokenAddressSync,
  mintTo,
} from "@solana/spl-token";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const keysDir = join(root, "keys");
const programId = new PublicKey("DHtXZcQnMM5t3L3hAy2JkksbTgC2GenXAHQyexZDA8vL");
const rpc = process.env.SOLANA_DEVNET_RPC ?? "https://api.devnet.solana.com";
const explorer = "https://explorer.solana.com";
const FUND = 100_000_000n;
const ORIGINAL = 4_000_000n;
const DISCOUNT = 800_000n;
const COMMISSION = 160_000n;
const PROVIDER = 640_000n;
const BUDGET_ID = Buffer.from("p0-demo-budget");

mkdirSync(keysDir, { recursive: true });

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function loadOrCreate(name) {
  const path = join(keysDir, `${name}.json`);
  if (!existsSync(path)) {
    run("solana-keygen", ["new", "--no-bip39-passphrase", "-o", path, "-f"], {
      stdio: ["ignore", "ignore", "ignore"],
    });
  }
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(path, "utf8"))));
}

const ROLE_MINIMUM_SOL = {
  deployer: 0.2,
  sponsor: 0.05,
  verifier: 0.05,
};
const DEPLOYER_FIRST_DEPLOY_SOL = 4;

async function requireFunded(connection, pubkey, label, minimumSol = ROLE_MINIMUM_SOL[label]) {
  if (minimumSol == null) {
    throw new Error(`Unknown funding role ${label}`);
  }
  const balance = await connection.getBalance(pubkey, "confirmed");
  if (balance >= minimumSol * LAMPORTS_PER_SOL) {
    return;
  }
  throw new Error(
    `${label} ${pubkey.toBase58()} has ${balance / LAMPORTS_PER_SOL} SOL; needs ${minimumSol} SOL. Transfer Devnet SOL to this pubkey. Do not airdrop.`,
  );
}

function explorerLink(kind, value) {
  return `${explorer}/${kind}/${value}?cluster=devnet`;
}

async function tokenBalance(connection, account) {
  return (await getAccount(connection, account, "confirmed")).amount;
}

async function main() {
  const deployer = loadOrCreate("deployer");
  const sponsor = loadOrCreate("sponsor");
  const verifier = loadOrCreate("verifier");
  const providerOwner = loadOrCreate("provider");
  const platformOwner = loadOrCreate("platform");
  const distinct = new Set([
    deployer.publicKey.toBase58(),
    sponsor.publicKey.toBase58(),
    verifier.publicKey.toBase58(),
    providerOwner.publicKey.toBase58(),
    platformOwner.publicKey.toBase58(),
  ]);
  if (distinct.size !== 5) {
    throw new Error("Sponsor, provider, verifier, platform, and deployer must be distinct keypairs.");
  }

  process.env.ANCHOR_PROVIDER_URL = rpc;
  process.env.ANCHOR_WALLET = join(keysDir, "deployer.json");
  const connection = new Connection(rpc, "confirmed");
  const wallet = new anchor.Wallet(deployer);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  const idl = JSON.parse(readFileSync(join(root, "target/idl/reward_vault.json"), "utf8"));
  const program = new anchor.Program(idl, provider);

  const existingProgram = await connection.getAccountInfo(programId, "confirmed");
  await requireFunded(
    connection,
    deployer.publicKey,
    "deployer",
    existingProgram ? ROLE_MINIMUM_SOL.deployer : DEPLOYER_FIRST_DEPLOY_SOL,
  );
  await requireFunded(connection, sponsor.publicKey, "sponsor");
  await requireFunded(connection, verifier.publicKey, "verifier");

  if (!existingProgram) {
    const deployed = run("solana", [
      "program",
      "deploy",
      "--url",
      rpc,
      "--keypair",
      join(keysDir, "deployer.json"),
      "--program-id",
      join(keysDir, "program.json"),
      join(root, "target/deploy/reward_vault.so"),
    ]);
    if (!deployed.includes(programId.toBase58())) {
      throw new Error(`Deploy did not report program id ${programId.toBase58()}`);
    }
  }

  const [budget] = PublicKey.findProgramAddressSync(
    [Buffer.from("budget"), deployer.publicKey.toBuffer(), BUDGET_ID],
    programId,
  );
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), budget.toBuffer()],
    programId,
  );
  const existingBudget = await connection.getAccountInfo(budget, "confirmed");
  let mint;
  let providerAta;
  let platformAta;
  let withdrawal;
  if (existingBudget) {
    const stored = await program.account.budget.fetch(budget);
    mint = stored.mint;
    providerAta = stored.providerRecipient;
    platformAta = stored.platformRecipient;
    withdrawal = stored.withdrawalDestination;
  } else {
    mint = await createMint(connection, deployer, deployer.publicKey, null, 6);
    providerAta = await createAssociatedTokenAccountIdempotent(
      connection,
      deployer,
      mint,
      providerOwner.publicKey,
    );
    platformAta = await createAssociatedTokenAccountIdempotent(
      connection,
      deployer,
      mint,
      platformOwner.publicKey,
    );
    withdrawal = getAssociatedTokenAddressSync(mint, deployer.publicKey);
    await createAssociatedTokenAccountIdempotent(connection, deployer, mint, deployer.publicKey);
  }
  const sponsorAta = await createAssociatedTokenAccountIdempotent(
    connection,
    sponsor,
    mint,
    sponsor.publicKey,
  );
  const sponsorBalance = (await getAccount(connection, sponsorAta, "confirmed")).amount;
  if (sponsorBalance < FUND) {
    await mintTo(connection, deployer, mint, sponsorAta, deployer, FUND - sponsorBalance);
  }

  const redemptionId = Uint8Array.from([
    0xd3, 0x33, 0x33, 0x33, 0x33, 0x33, 0x43, 0x33,
    0x83, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33, 0x33,
  ]);
  const [receipt] = PublicKey.findProgramAddressSync(
    [Buffer.from("receipt"), budget.toBuffer(), redemptionId],
    programId,
  );

  if (!existingBudget) {
    await program.methods
      .initializeBudget(Buffer.from(BUDGET_ID), 500, verifier.publicKey)
      .accounts({
        authority: deployer.publicKey,
        mint,
        platformRecipient: platformAta,
        providerRecipient: providerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        withdrawalDestination: withdrawal,
      })
      .rpc();
  }

  const fundingSignature = await program.methods
    .fundBudget(Buffer.from(BUDGET_ID), new BN(FUND.toString()))
    .accounts({
      authority: deployer.publicKey,
      depositor: sponsor.publicKey,
      mint,
      source: sponsorAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([sponsor])
    .rpc();

  const before = {
    platform: await tokenBalance(connection, platformAta),
    provider: await tokenBalance(connection, providerAta),
    vault: await tokenBalance(connection, vault),
  };

  const settlementSignature = await program.methods
    .settleRedemption(Buffer.from(BUDGET_ID), Buffer.from(redemptionId), new BN(ORIGINAL.toString()), new BN(DISCOUNT.toString()))
    .accounts({
      authority: deployer.publicKey,
      mint,
      platformRecipient: platformAta,
      providerRecipient: providerAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      verifier: verifier.publicKey,
    })
    .signers([verifier])
    .rpc();

  const after = {
    platform: await tokenBalance(connection, platformAta),
    provider: await tokenBalance(connection, providerAta),
    vault: await tokenBalance(connection, vault),
  };
  const stored = await program.account.settlementReceipt.fetch(receipt);
  const owner = await connection.getAccountInfo(receipt, "confirmed");

  if (before.vault !== FUND || after.vault !== FUND - DISCOUNT) {
    throw new Error(`Vault did not move ${FUND} to ${FUND - DISCOUNT}. Before ${before.vault}, after ${after.vault}.`);
  }
  if (after.provider - before.provider !== PROVIDER || after.platform - before.platform !== COMMISSION) {
    throw new Error(
      `Payouts were provider ${after.provider - before.provider} and platform ${after.platform - before.platform}.`,
    );
  }
  if (owner?.owner.toBase58() !== programId.toBase58()) {
    throw new Error("Receipt owner is not the reward vault program.");
  }

  const markdown = `# Devnet settlement

This is a confirmed Devnet execution. It is not a local validator run.

- Program: \`${programId.toBase58()}\` ([Explorer](${explorerLink("address", programId.toBase58())}))
- Network: Devnet
- Mint: \`${mint.toBase58()}\` ([Explorer](${explorerLink("address", mint.toBase58())}))
- Budget PDA: \`${budget.toBase58()}\` ([Explorer](${explorerLink("address", budget.toBase58())}))
- Vault: \`${vault.toBase58()}\` ([Explorer](${explorerLink("address", vault.toBase58())}))
- Authority: \`${deployer.publicKey.toBase58()}\`
- Verifier: \`${verifier.publicKey.toBase58()}\`
- Sponsor: \`${sponsor.publicKey.toBase58()}\`
- Provider token account: \`${providerAta.toBase58()}\`
- Platform token account: \`${platformAta.toBase58()}\`
- Withdrawal destination: \`${withdrawal.toBase58()}\`
- Budget id: \`${BUDGET_ID.toString("hex")}\`
- Funding signature: \`${fundingSignature}\` ([Explorer](${explorerLink("tx", fundingSignature)}))
- Settlement signature: \`${settlementSignature}\` ([Explorer](${explorerLink("tx", settlementSignature)}))
- Receipt: \`${receipt.toBase58()}\` owned by \`${owner.owner.toBase58()}\` ([Explorer](${explorerLink("address", receipt.toBase58())}))
- Receipt budget: \`${stored.budget.toBase58()}\`
- Receipt redemption id: \`${Buffer.from(stored.redemptionId).toString("hex")}\`
- Receipt original: \`${stored.originalPrice.toString()}\`
- Receipt discount: \`${stored.discount.toString()}\`
- Receipt commission: \`${stored.commission.toString()}\`
- Receipt provider reimbursement: \`${stored.providerReimbursement.toString()}\`
- Vault: ${before.vault} → ${after.vault}
- Provider: ${before.provider} → ${after.provider} (delta ${after.provider - before.provider})
- Platform: ${before.platform} → ${after.platform} (delta ${after.platform - before.platform})

The vault held enough tokens for this settlement. Outstanding reimbursements are not reserved on-chain.
`;
  writeFileSync(join(root, "devnet-settlement.md"), markdown);
  writeFileSync(join(root, "devnet-settlement.json"), `${JSON.stringify({
    authority: deployer.publicKey.toBase58(),
    budget: budget.toBase58(),
    budgetIdHex: BUDGET_ID.toString("hex"),
    fundingSignature,
    mint: mint.toBase58(),
    network: "devnet",
    platform: platformAta.toBase58(),
    programId: programId.toBase58(),
    provider: providerAta.toBase58(),
    receipt: receipt.toBase58(),
    settlementSignature,
    vault: vault.toBase58(),
    verifier: verifier.publicKey.toBase58(),
    withdrawal: withdrawal.toBase58(),
  }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
