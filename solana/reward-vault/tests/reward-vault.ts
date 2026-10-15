import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  freezeAccount,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { RewardVault } from "../target/types/reward_vault";

const DEMO = {
  original: new anchor.BN(4_000_000),
  discount: new anchor.BN(800_000),
  bps: 500,
  commission: new anchor.BN(160_000),
  provider: new anchor.BN(640_000),
  fund: new anchor.BN(100_000_000),
  vaultAfter: new anchor.BN(99_200_000),
};

describe("reward vault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.rewardVault as Program<RewardVault>;
  const connection = provider.connection;
  const payer = provider.wallet;

  let mint: PublicKey;
  let wrongMint: PublicKey;

  before(async () => {
    mint = await createMint(connection, payer.payer, payer.publicKey, payer.publicKey, 6);
    wrongMint = await createMint(connection, payer.payer, payer.publicKey, payer.publicKey, 6);
  });

  it("initializes a budget and rejects a duplicate", async () => {
    const opened = await openBudget({ bps: DEMO.bps });
    const stored = await program.account.budget.fetch(opened.budget);
    assert.equal(stored.commissionBps, DEMO.bps);
    assert.deepEqual(stored.status, { active: {} });
    assert.equal(stored.providerRecipient.toBase58(), opened.provider.toBase58());
    await expectError(opened.initialize(), "already in use");
  });

  it("allows the provider recipient and withdrawal destination to be the same account", async () => {
    const opened = await openBudget({ bps: DEMO.bps, selfFunded: true });
    const stored = await program.account.budget.fetch(opened.budget);
    assert.equal(stored.providerRecipient.toBase58(), stored.withdrawalDestination.toBase58());
    assert.notEqual(stored.providerRecipient.toBase58(), opened.vault.toBase58());
  });

  it("rejects a vault alias as provider, platform, or withdrawal destination", async () => {
    const authority = await fundedWallet();
    const budgetId = id("vault-alias");
    const [budget] = pda(["budget", authority.publicKey.toBuffer(), budgetId]);
    const [vault] = pda(["vault", budget.toBuffer()]);
    const platform = await tokenAccount(mint, Keypair.generate());
    const withdrawal = await ata(mint, authority);

    const providerAlias = program.methods
      .initializeBudget(Buffer.from(budgetId), DEMO.bps, Keypair.generate().publicKey)
      .accounts({
        budget,
        vault,
        mint,
        providerRecipient: vault,
        platformRecipient: platform,
        withdrawalDestination: withdrawal,
        authority: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority]);
    await expectError(providerAlias.rpc(), "AccountNotInitialized");

    const platformId = id("vault-platform");
    const [platformBudget] = pda(["budget", authority.publicKey.toBuffer(), platformId]);
    const [platformVault] = pda(["vault", platformBudget.toBuffer()]);
    const realProvider = await tokenAccount(mint, Keypair.generate());
    const platformAlias = program.methods
      .initializeBudget(Buffer.from(platformId), DEMO.bps, Keypair.generate().publicKey)
      .accounts({
        budget: platformBudget,
        vault: platformVault,
        mint,
        providerRecipient: realProvider,
        platformRecipient: platformVault,
        withdrawalDestination: withdrawal,
        authority: authority.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([authority]);
    await expectError(platformAlias.rpc(), "AccountNotInitialized");
  });

  it("rejects identical provider and platform recipients", async () => {
    const opened = await prepareBudget({ bps: DEMO.bps, sameRecipients: true });
    await expectError(opened.initialize(), "RecipientAlias");
  });

  it("rejects a provider account on the wrong mint", async () => {
    const opened = await prepareBudget({ bps: DEMO.bps, providerMint: wrongMint });
    await expectError(opened.initialize(), "Constraint");
  });

  it("records an authority deposit and an independent sponsor deposit", async () => {
    const opened = await openBudget({ bps: DEMO.bps });
    const sponsor = await fundedWallet();
    const sponsorSource = await tokenAccount(mint, sponsor);
    await mintTo(connection, payer.payer, mint, sponsorSource, payer.publicKey, 25_000_000);

    const authoritySource = await ata(mint, opened.authority);
    await mintTo(connection, payer.payer, mint, authoritySource, payer.publicKey, 10_000_000);
    await opened.fund(opened.authority, authoritySource, new anchor.BN(10_000_000));
    const sponsorTx = await opened.fund(sponsor, sponsorSource, new anchor.BN(25_000_000));

    const stored = await program.account.budget.fetch(opened.budget);
    assert.equal(stored.totalDeposited.toString(), "35000000");
    assert.equal(await balance(opened.vault), 35_000_000);
    let tx = null;
    for (let attempt = 0; attempt < 20 && !tx; attempt += 1) {
      tx = await connection.getTransaction(sponsorTx, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (!tx) await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const logs = tx?.meta?.logMessages ?? [];
    const eventLine = logs.find((log) => log.startsWith("Program data: "));
    const funded = new anchor.BorshCoder(program.idl).events.decode(
      eventLine?.slice("Program data: ".length) ?? "",
    );
    assert.equal(funded?.name, "budgetFunded");
    assert.equal(funded?.data.depositor.toBase58(), sponsor.publicKey.toBase58());
    assert.equal(funded?.data.amount.toString(), "25000000");
  });

  it("settles the six-decimal example and rejects a duplicate redemption", async () => {
    const opened = await openBudget({ bps: DEMO.bps, fundAmount: DEMO.fund });
    const redemptionId = randomId();
    await opened.settle(redemptionId, DEMO.original, DEMO.discount);

    const receipt = await program.account.settlementReceipt.fetch(opened.receipt(redemptionId));
    assert.equal(receipt.budget.toBase58(), opened.budget.toBase58());
    assert.deepEqual([...receipt.redemptionId], [...redemptionId]);
    assert.equal(receipt.originalPrice.toString(), DEMO.original.toString());
    assert.equal(receipt.discount.toString(), DEMO.discount.toString());
    assert.equal(receipt.commission.toString(), DEMO.commission.toString());
    assert.equal(receipt.providerReimbursement.toString(), DEMO.provider.toString());

    const stored = await program.account.budget.fetch(opened.budget);
    assert.equal(stored.totalSettled.toString(), DEMO.discount.toString());
    assert.equal(stored.totalProviderReimbursements.toString(), DEMO.provider.toString());
    assert.equal(stored.totalPlatformCommissions.toString(), DEMO.commission.toString());
    assert.equal(stored.settlementCount.toString(), "1");
    assert.equal(await balance(opened.vault), Number(DEMO.vaultAfter.toString()));
    assert.equal(await balance(opened.provider), Number(DEMO.provider.toString()));
    assert.equal(await balance(opened.platform), Number(DEMO.commission.toString()));

    await expectError(
      opened.settle(redemptionId, DEMO.original, DEMO.discount),
      "already in use",
    );
  });

  it("rejects an unauthorized verifier and substituted recipients", async () => {
    const opened = await openBudget({ bps: DEMO.bps, fundAmount: DEMO.fund });
    const stranger = await fundedWallet();
    await expectError(
      opened.settle(randomId(), DEMO.original, DEMO.discount, { verifier: stranger }),
      "ConstraintHasOne",
    );

    const otherProvider = await tokenAccount(mint, Keypair.generate());
    await expectError(
      opened.settle(randomId(), DEMO.original, DEMO.discount, { provider: otherProvider }),
      "ProviderMismatch",
    );
    const otherPlatform = await tokenAccount(mint, Keypair.generate());
    await expectError(
      opened.settle(randomId(), DEMO.original, DEMO.discount, { platform: otherPlatform }),
      "PlatformMismatch",
    );
    assert.equal(await balance(opened.vault), Number(DEMO.fund.toString()));
  });

  it("rejects a substituted vault account", async () => {
    const opened = await openBudget({ bps: DEMO.bps, fundAmount: new anchor.BN(1_000_000) });
    const source = await ata(mint, opened.authority);
    await mintTo(connection, payer.payer, mint, source, payer.publicKey, 1_000);
    const decoy = await tokenAccount(mint, Keypair.generate());
    await expectError(opened.fund(opened.authority, source, new anchor.BN(1), decoy), "ConstraintSeeds");
  });

  it("rejects settlement when the vault cannot cover the discount", async () => {
    const opened = await openBudget({ bps: DEMO.bps, fundAmount: new anchor.BN(100) });
    await expectError(opened.settle(randomId(), DEMO.original, DEMO.discount), "InsufficientVault");
    assert.equal(await balance(opened.provider), 0);
    assert.equal(await balance(opened.platform), 0);
  });

  it("pauses settlement, then resumes and settles", async () => {
    const opened = await openBudget({ bps: DEMO.bps, fundAmount: DEMO.fund });
    await opened.pause();
    await expectError(opened.settle(randomId(), DEMO.original, DEMO.discount), "BudgetPaused");
    assert.equal(await balance(opened.vault), Number(DEMO.fund.toString()));

    await opened.resume();
    const stored = await program.account.budget.fetch(opened.budget);
    assert.deepEqual(stored.status, { active: {} });

    const redemptionId = randomId();
    await opened.settle(redemptionId, DEMO.original, DEMO.discount);
    const receipt = await program.account.settlementReceipt.fetch(opened.receipt(redemptionId));
    assert.equal(receipt.commission.toString(), DEMO.commission.toString());
    assert.equal(receipt.providerReimbursement.toString(), DEMO.provider.toString());
    assert.equal(await balance(opened.vault), Number(DEMO.vaultAfter.toString()));
  });

  it("rejects a discount above the original price and a commission above the discount", async () => {
    const opened = await openBudget({ bps: DEMO.bps, fundAmount: DEMO.fund });
    await expectError(
      opened.settle(randomId(), new anchor.BN(1_000), new anchor.BN(1_001)),
      "DiscountExceedsOriginal",
    );

    const wide = await openBudget({ bps: 10_000, fundAmount: DEMO.fund });
    await expectError(
      wide.settle(randomId(), new anchor.BN(4), new anchor.BN(1)),
      "CommissionExceedsDiscount",
    );
    assert.equal(await balance(wide.provider), 0);
  });

  it("lets the authority withdraw unused tokens and rejects another signer", async () => {
    const opened = await openBudget({ bps: DEMO.bps, fundAmount: new anchor.BN(5_000_000) });
    const stranger = await fundedWallet();
    await expectError(opened.withdraw(stranger, new anchor.BN(1_000)), "ConstraintSeeds");

    await opened.withdraw(opened.authority, new anchor.BN(1_500_000));
    assert.equal(await balance(opened.vault), 3_500_000);
    assert.equal(await balance(opened.withdrawal), 1_500_000);
  });

  it("rolls back an overflowing settlement without paying either recipient", async () => {
    const opened = await openBudget({ bps: 10_000, fundAmount: new anchor.BN(1_000) });
    const max = new anchor.BN("18446744073709551615");
    await expectError(opened.settle(randomId(), max, new anchor.BN(1)), "Overflow");
    assert.equal(await balance(opened.vault), 1_000);
    assert.equal(await balance(opened.provider), 0);
    assert.equal(await balance(opened.platform), 0);
  });

  it("rolls back both payouts when the second transfer fails", async () => {
    const opened = await openBudget({ bps: DEMO.bps, fundAmount: DEMO.fund });
    await freezeAccount(
      connection,
      payer.payer,
      opened.platform,
      mint,
      payer.publicKey,
    );
    await expectError(opened.settle(randomId(), DEMO.original, DEMO.discount), "frozen");
    assert.equal(await balance(opened.vault), Number(DEMO.fund.toString()));
    assert.equal(await balance(opened.provider), 0);
    assert.equal(await balance(opened.platform), 0);
    const stored = await program.account.budget.fetch(opened.budget);
    assert.equal(stored.settlementCount.toString(), "0");
  });

  function pda(seeds: Buffer[]) {
    return PublicKey.findProgramAddressSync(seeds, program.programId);
  }

  function id(label: string) {
    return Buffer.from(label);
  }

  function randomId() {
    return Buffer.from(anchor.web3.Keypair.generate().publicKey.toBytes().subarray(0, 16));
  }

  async function fundedWallet() {
    const wallet = Keypair.generate();
    const signature = await connection.requestAirdrop(wallet.publicKey, 2_000_000_000);
    const latest = await connection.getLatestBlockhash();
    await connection.confirmTransaction(
      { signature, ...latest },
      "confirmed",
    );
    return wallet;
  }

  async function tokenAccount(mintKey: PublicKey, owner: Keypair) {
    const account = await getOrCreateAssociatedTokenAccount(
      connection,
      payer.payer,
      mintKey,
      owner.publicKey,
    );
    return account.address;
  }

  async function ata(mintKey: PublicKey, owner: Keypair) {
    return tokenAccount(mintKey, owner);
  }

  async function balance(account: PublicKey) {
    return Number((await getAccount(connection, account)).amount);
  }

  async function expectError(promise: Promise<unknown>, pattern: string) {
    try {
      await promise;
      assert.fail(`expected an error matching ${pattern}`);
    } catch (error) {
      const text = errorText(error);
      assert.match(text, new RegExp(pattern, "i"));
    }
  }

  function errorText(error: unknown) {
    if (error instanceof anchor.AnchorError) {
      return `${error.error.errorCode.code} ${error.error.errorMessage}`;
    }
    const logs = (error as { logs?: string[] }).logs?.join(" ") ?? "";
    const message = error instanceof Error ? error.message : String(error);
    return `${message} ${logs}`;
  }

  async function prepareBudget(options: {
    bps: number;
    selfFunded?: boolean;
    sameRecipients?: boolean;
    providerMint?: PublicKey;
    fundAmount?: anchor.BN;
  }) {
    const authority = await fundedWallet();
    const verifier = await fundedWallet();
    const budgetId = randomId();
    const [budget] = pda(["budget", authority.publicKey.toBuffer(), budgetId]);
    const [vault] = pda(["vault", budget.toBuffer()]);
    const withdrawal = await ata(mint, authority);
    const provider = options.selfFunded || options.sameRecipients
      ? withdrawal
      : await tokenAccount(options.providerMint ?? mint, Keypair.generate());
    const platform = options.sameRecipients
      ? provider
      : await tokenAccount(mint, Keypair.generate());

    const accounts = {
      budget,
      vault,
      mint,
      providerRecipient: provider,
      platformRecipient: platform,
      withdrawalDestination: withdrawal,
      authority: authority.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    };

    return {
      authority,
      verifier,
      budgetId,
      budget,
      vault,
      provider,
      platform,
      withdrawal,
      receipt(redemptionId: Buffer) {
        return pda(["receipt", budget.toBuffer(), redemptionId])[0];
      },
      initialize() {
        return program.methods
          .initializeBudget(budgetId, options.bps, verifier.publicKey)
          .accounts(accounts)
          .signers([authority])
          .rpc();
      },
      async fund(depositor: Keypair, source: PublicKey, amount: anchor.BN, vaultAccount = vault) {
        return program.methods
          .fundBudget(budgetId, amount)
          .accounts({
            budget,
            authority: authority.publicKey,
            vault: vaultAccount,
            source,
            mint,
            depositor: depositor.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([depositor])
          .rpc();
      },
      settle(
        redemptionId: Buffer,
        original: anchor.BN,
        discount: anchor.BN,
        overrides: { verifier?: Keypair; provider?: PublicKey; platform?: PublicKey } = {},
      ) {
        const who = overrides.verifier ?? verifier;
        return program.methods
          .settleRedemption(budgetId, [...redemptionId], original, discount)
          .accounts({
            budget,
            authority: authority.publicKey,
            verifier: who.publicKey,
            vault,
            providerRecipient: overrides.provider ?? provider,
            platformRecipient: overrides.platform ?? platform,
            receipt: pda(["receipt", budget.toBuffer(), redemptionId])[0],
            mint,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([who])
          .rpc();
      },
      pause() {
        return program.methods
          .pauseBudget(budgetId)
          .accounts({ budget, authority: authority.publicKey })
          .signers([authority])
          .rpc();
      },
      resume() {
        return program.methods
          .resumeBudget(budgetId)
          .accounts({ budget, authority: authority.publicKey })
          .signers([authority])
          .rpc();
      },
      withdraw(who: Keypair, amount: anchor.BN) {
        return program.methods
          .withdrawUnusedBudget(budgetId, amount)
          .accounts({
            budget,
            authority: who.publicKey,
            vault,
            withdrawalDestination: withdrawal,
            mint,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([who])
          .rpc();
      },
    };
  }

  async function openBudget(options: {
    bps: number;
    selfFunded?: boolean;
    fundAmount?: anchor.BN;
  }) {
    const opened = await prepareBudget(options);
    await opened.initialize();
    if (options.fundAmount) {
      const sponsor = await fundedWallet();
      const source = await tokenAccount(mint, sponsor);
      await mintTo(
        connection,
        payer.payer,
        mint,
        source,
        payer.publicKey,
        BigInt(options.fundAmount.toString()),
      );
      await opened.fund(sponsor, source, options.fundAmount);
    }
    return opened;
  }
});
