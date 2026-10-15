//! Promotional reward budget vault.
//!
//! A funder deposits demo tokens. The configured verifier settles one redemption
//! at a time. The program pays the provider and the platform from the vault and
//! records a receipt. It does not reserve funds for redemptions that are still
//! waiting to settle: the authority can withdraw whatever remains in the vault.

use anchor_lang::prelude::*;
use anchor_spl::associated_token::get_associated_token_address;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("DHtXZcQnMM5t3L3hAy2JkksbTgC2GenXAHQyexZDA8vL");

pub const MAX_BUDGET_ID_LEN: usize = 32;
pub const COMMISSION_DENOMINATOR: u64 = 10_000;
pub const TOKEN_DECIMALS: u8 = 6;

#[program]
pub mod reward_vault {
    use super::*;

    pub fn initialize_budget(
        ctx: Context<InitializeBudget>,
        budget_id: Vec<u8>,
        commission_bps: u16,
        verifier: Pubkey,
    ) -> Result<()> {
        require!(
            (1..=MAX_BUDGET_ID_LEN).contains(&budget_id.len()),
            RewardVaultError::InvalidBudgetId
        );
        require!(
            commission_bps <= COMMISSION_DENOMINATOR as u16,
            RewardVaultError::InvalidCommission
        );
        require!(verifier != Pubkey::default(), RewardVaultError::InvalidVerifier);

        let vault_key = ctx.accounts.vault.key();
        let provider = ctx.accounts.provider_recipient.key();
        let platform = ctx.accounts.platform_recipient.key();
        let withdrawal = ctx.accounts.withdrawal_destination.key();
        require!(vault_key != provider, RewardVaultError::VaultAlias);
        require!(vault_key != platform, RewardVaultError::VaultAlias);
        require!(vault_key != withdrawal, RewardVaultError::VaultAlias);
        require!(provider != platform, RewardVaultError::RecipientAlias);

        let expected_withdrawal = get_associated_token_address(
            &ctx.accounts.authority.key(),
            &ctx.accounts.mint.key(),
        );
        require_keys_eq!(
            withdrawal,
            expected_withdrawal,
            RewardVaultError::WithdrawalDestinationMismatch
        );

        let mut stored_id = [0u8; MAX_BUDGET_ID_LEN];
        stored_id[..budget_id.len()].copy_from_slice(&budget_id);

        let budget = &mut ctx.accounts.budget;
        budget.authority = ctx.accounts.authority.key();
        budget.verifier = verifier;
        budget.mint = ctx.accounts.mint.key();
        budget.provider_recipient = provider;
        budget.platform_recipient = platform;
        budget.withdrawal_destination = withdrawal;
        budget.commission_bps = commission_bps;
        budget.status = BudgetStatus::Active;
        budget.total_deposited = 0;
        budget.total_settled = 0;
        budget.total_provider_reimbursements = 0;
        budget.total_platform_commissions = 0;
        budget.settlement_count = 0;
        budget.budget_id = stored_id;
        budget.budget_id_len = budget_id.len() as u8;
        budget.bump = ctx.bumps.budget;
        budget.vault_bump = ctx.bumps.vault;
        Ok(())
    }

    pub fn fund_budget(ctx: Context<FundBudget>, budget_id: Vec<u8>, amount: u64) -> Result<()> {
        require_budget_id(&ctx.accounts.budget, &budget_id)?;
        require!(amount > 0, RewardVaultError::AmountNotPositive);
        require!(
            ctx.accounts.source.key() != ctx.accounts.vault.key(),
            RewardVaultError::SourceAlias
        );

        token::transfer(
            CpiContext::new(
                Token::id(),
                Transfer {
                    from: ctx.accounts.source.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.depositor.to_account_info(),
                },
            ),
            amount,
        )?;

        let budget = &mut ctx.accounts.budget;
        budget.total_deposited = budget
            .total_deposited
            .checked_add(amount)
            .ok_or(RewardVaultError::Overflow)?;

        emit!(BudgetFunded {
            budget: budget.key(),
            depositor: ctx.accounts.depositor.key(),
            amount,
        });
        Ok(())
    }

    pub fn settle_redemption(
        ctx: Context<SettleRedemption>,
        budget_id: Vec<u8>,
        redemption_id: [u8; 16],
        original_price: u64,
        discount: u64,
    ) -> Result<()> {
        require_budget_id(&ctx.accounts.budget, &budget_id)?;
        require!(
            ctx.accounts.budget.status == BudgetStatus::Active,
            RewardVaultError::BudgetPaused
        );
        require_keys_eq!(
            ctx.accounts.provider_recipient.key(),
            ctx.accounts.budget.provider_recipient,
            RewardVaultError::ProviderMismatch
        );
        require_keys_eq!(
            ctx.accounts.platform_recipient.key(),
            ctx.accounts.budget.platform_recipient,
            RewardVaultError::PlatformMismatch
        );

        let (commission, provider_amount) = settlement_amounts(
            original_price,
            discount,
            ctx.accounts.budget.commission_bps,
        )?;
        require!(
            ctx.accounts.vault.amount >= discount,
            RewardVaultError::InsufficientVault
        );

        transfer_from_vault(
            &ctx.accounts.vault,
            &ctx.accounts.provider_recipient,
            &ctx.accounts.budget,
            provider_amount,
        )?;
        transfer_from_vault(
            &ctx.accounts.vault,
            &ctx.accounts.platform_recipient,
            &ctx.accounts.budget,
            commission,
        )?;

        let budget = &mut ctx.accounts.budget;
        budget.total_settled = budget
            .total_settled
            .checked_add(discount)
            .ok_or(RewardVaultError::Overflow)?;
        budget.total_provider_reimbursements = budget
            .total_provider_reimbursements
            .checked_add(provider_amount)
            .ok_or(RewardVaultError::Overflow)?;
        budget.total_platform_commissions = budget
            .total_platform_commissions
            .checked_add(commission)
            .ok_or(RewardVaultError::Overflow)?;
        budget.settlement_count = budget
            .settlement_count
            .checked_add(1)
            .ok_or(RewardVaultError::Overflow)?;

        let receipt = &mut ctx.accounts.receipt;
        receipt.budget = budget.key();
        receipt.redemption_id = redemption_id;
        receipt.original_price = original_price;
        receipt.discount = discount;
        receipt.commission = commission;
        receipt.provider_reimbursement = provider_amount;
        receipt.settled_at = Clock::get()?.unix_timestamp;
        receipt.bump = ctx.bumps.receipt;

        emit!(RedemptionSettled {
            budget: budget.key(),
            redemption_id,
            original_price,
            discount,
            commission,
            provider_reimbursement: provider_amount,
        });
        Ok(())
    }

    pub fn pause_budget(ctx: Context<AuthorityBudget>, budget_id: Vec<u8>) -> Result<()> {
        require_budget_id(&ctx.accounts.budget, &budget_id)?;
        require!(
            ctx.accounts.budget.status == BudgetStatus::Active,
            RewardVaultError::BudgetNotActive
        );
        ctx.accounts.budget.status = BudgetStatus::Paused;
        Ok(())
    }

    pub fn resume_budget(ctx: Context<AuthorityBudget>, budget_id: Vec<u8>) -> Result<()> {
        require_budget_id(&ctx.accounts.budget, &budget_id)?;
        require!(
            ctx.accounts.budget.status == BudgetStatus::Paused,
            RewardVaultError::BudgetNotPaused
        );
        ctx.accounts.budget.status = BudgetStatus::Active;
        Ok(())
    }

    pub fn withdraw_unused_budget(
        ctx: Context<WithdrawUnused>,
        budget_id: Vec<u8>,
        amount: u64,
    ) -> Result<()> {
        require_budget_id(&ctx.accounts.budget, &budget_id)?;
        require!(amount > 0, RewardVaultError::AmountNotPositive);
        require_keys_eq!(
            ctx.accounts.withdrawal_destination.key(),
            ctx.accounts.budget.withdrawal_destination,
            RewardVaultError::WithdrawalDestinationMismatch
        );
        require!(
            ctx.accounts.vault.amount >= amount,
            RewardVaultError::InsufficientVault
        );

        transfer_from_vault(
            &ctx.accounts.vault,
            &ctx.accounts.withdrawal_destination,
            &ctx.accounts.budget,
            amount,
        )?;
        Ok(())
    }
}

pub fn settlement_amounts(
    original_price: u64,
    discount: u64,
    commission_bps: u16,
) -> Result<(u64, u64)> {
    require!(original_price > 0, RewardVaultError::OriginalNotPositive);
    require!(discount > 0, RewardVaultError::DiscountNotPositive);
    require!(
        discount <= original_price,
        RewardVaultError::DiscountExceedsOriginal
    );
    let discounted = original_price
        .checked_sub(discount)
        .ok_or(RewardVaultError::Overflow)?;
    let commission = discounted
        .checked_mul(commission_bps as u64)
        .ok_or(RewardVaultError::Overflow)?
        .checked_div(COMMISSION_DENOMINATOR)
        .ok_or(RewardVaultError::Overflow)?;
    require!(
        commission <= discount,
        RewardVaultError::CommissionExceedsDiscount
    );
    let provider_amount = discount
        .checked_sub(commission)
        .ok_or(RewardVaultError::Overflow)?;
    Ok((commission, provider_amount))
}

fn require_budget_id(budget: &Budget, budget_id: &[u8]) -> Result<()> {
    require!(
        budget_id.len() == budget.budget_id_len as usize,
        RewardVaultError::InvalidBudgetId
    );
    require!(
        budget.budget_id[..budget_id.len()] == *budget_id,
        RewardVaultError::InvalidBudgetId
    );
    Ok(())
}

fn transfer_from_vault<'info>(
    vault: &Account<'info, TokenAccount>,
    destination: &Account<'info, TokenAccount>,
    budget: &Account<'info, Budget>,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    let bump = [budget.bump];
    let id_len = budget.budget_id_len as usize;
    let seeds: [&[u8]; 4] = [
        b"budget",
        budget.authority.as_ref(),
        &budget.budget_id[..id_len],
        &bump,
    ];
    token::transfer(
        CpiContext::new_with_signer(
            Token::id(),
            Transfer {
                from: vault.to_account_info(),
                to: destination.to_account_info(),
                authority: budget.to_account_info(),
            },
            &[&seeds],
        ),
        amount,
    )
}

#[derive(Accounts)]
#[instruction(budget_id: Vec<u8>)]
pub struct InitializeBudget<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Budget::INIT_SPACE,
        seeds = [b"budget", authority.key().as_ref(), budget_id.as_slice()],
        bump
    )]
    pub budget: Account<'info, Budget>,
    #[account(
        init,
        payer = authority,
        token::mint = mint,
        token::authority = budget,
        token::token_program = token_program,
        seeds = [b"vault", budget.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(constraint = mint.decimals == TOKEN_DECIMALS @ RewardVaultError::MintDecimals)]
    pub mint: Account<'info, Mint>,
    #[account(token::mint = mint, token::token_program = token_program)]
    pub provider_recipient: Account<'info, TokenAccount>,
    #[account(token::mint = mint, token::token_program = token_program)]
    pub platform_recipient: Account<'info, TokenAccount>,
    #[account(token::mint = mint, token::token_program = token_program)]
    pub withdrawal_destination: Account<'info, TokenAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(budget_id: Vec<u8>)]
pub struct FundBudget<'info> {
    #[account(
        mut,
        seeds = [b"budget", authority.key().as_ref(), budget_id.as_slice()],
        bump = budget.bump,
        has_one = authority,
        has_one = mint
    )]
    pub budget: Account<'info, Budget>,
    /// CHECK: PDA seed for the budget. `has_one` checks it against the stored authority.
    pub authority: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [b"vault", budget.key().as_ref()],
        bump = budget.vault_bump,
        constraint = vault.mint == budget.mint @ RewardVaultError::MintMismatch,
        constraint = vault.owner == budget.key() @ RewardVaultError::VaultAuthorityMismatch
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = depositor,
        token::token_program = token_program
    )]
    pub source: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
    pub depositor: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(budget_id: Vec<u8>, redemption_id: [u8; 16])]
pub struct SettleRedemption<'info> {
    #[account(
        mut,
        seeds = [b"budget", authority.key().as_ref(), budget_id.as_slice()],
        bump = budget.bump,
        has_one = authority,
        has_one = mint,
        has_one = verifier
    )]
    pub budget: Account<'info, Budget>,
    /// CHECK: PDA seed for the budget. `has_one` checks it against the stored authority.
    pub authority: UncheckedAccount<'info>,
    #[account(mut)]
    pub verifier: Signer<'info>,
    #[account(
        mut,
        seeds = [b"vault", budget.key().as_ref()],
        bump = budget.vault_bump,
        constraint = vault.mint == budget.mint @ RewardVaultError::MintMismatch,
        constraint = vault.owner == budget.key() @ RewardVaultError::VaultAuthorityMismatch
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = mint,
        token::token_program = token_program,
        constraint = provider_recipient.key() != vault.key() @ RewardVaultError::VaultAlias,
        constraint = provider_recipient.key() != platform_recipient.key() @ RewardVaultError::RecipientAlias
    )]
    pub provider_recipient: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = mint,
        token::token_program = token_program,
        constraint = platform_recipient.key() != vault.key() @ RewardVaultError::VaultAlias
    )]
    pub platform_recipient: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = verifier,
        space = 8 + SettlementReceipt::INIT_SPACE,
        seeds = [b"receipt", budget.key().as_ref(), redemption_id.as_ref()],
        bump
    )]
    pub receipt: Account<'info, SettlementReceipt>,
    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(budget_id: Vec<u8>)]
pub struct AuthorityBudget<'info> {
    #[account(
        mut,
        seeds = [b"budget", authority.key().as_ref(), budget_id.as_slice()],
        bump = budget.bump,
        has_one = authority
    )]
    pub budget: Account<'info, Budget>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(budget_id: Vec<u8>)]
pub struct WithdrawUnused<'info> {
    #[account(
        seeds = [b"budget", authority.key().as_ref(), budget_id.as_slice()],
        bump = budget.bump,
        has_one = authority,
        has_one = mint
    )]
    pub budget: Account<'info, Budget>,
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"vault", budget.key().as_ref()],
        bump = budget.vault_bump,
        constraint = vault.mint == budget.mint @ RewardVaultError::MintMismatch,
        constraint = vault.owner == budget.key() @ RewardVaultError::VaultAuthorityMismatch
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = mint,
        token::token_program = token_program,
        constraint = withdrawal_destination.key() != vault.key() @ RewardVaultError::VaultAlias
    )]
    pub withdrawal_destination: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

#[account]
#[derive(InitSpace)]
pub struct Budget {
    pub authority: Pubkey,
    pub verifier: Pubkey,
    pub mint: Pubkey,
    pub provider_recipient: Pubkey,
    pub platform_recipient: Pubkey,
    pub withdrawal_destination: Pubkey,
    pub commission_bps: u16,
    pub status: BudgetStatus,
    pub total_deposited: u64,
    pub total_settled: u64,
    pub total_provider_reimbursements: u64,
    pub total_platform_commissions: u64,
    pub settlement_count: u64,
    pub budget_id: [u8; MAX_BUDGET_ID_LEN],
    pub budget_id_len: u8,
    pub bump: u8,
    pub vault_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct SettlementReceipt {
    pub budget: Pubkey,
    pub redemption_id: [u8; 16],
    pub original_price: u64,
    pub discount: u64,
    pub commission: u64,
    pub provider_reimbursement: u64,
    pub settled_at: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum BudgetStatus {
    Active,
    Paused,
}

#[event]
pub struct BudgetFunded {
    pub budget: Pubkey,
    pub depositor: Pubkey,
    pub amount: u64,
}

#[event]
pub struct RedemptionSettled {
    pub budget: Pubkey,
    pub redemption_id: [u8; 16],
    pub original_price: u64,
    pub discount: u64,
    pub commission: u64,
    pub provider_reimbursement: u64,
}

#[error_code]
pub enum RewardVaultError {
    #[msg("Budget id must be 1 to 32 bytes")]
    InvalidBudgetId,
    #[msg("Commission basis points must be between 0 and 10000")]
    InvalidCommission,
    #[msg("Verifier must be set")]
    InvalidVerifier,
    #[msg("Vault cannot be a payout or withdrawal destination")]
    VaultAlias,
    #[msg("Provider and platform recipients must be different token accounts")]
    RecipientAlias,
    #[msg("Funding source cannot be the vault")]
    SourceAlias,
    #[msg("Withdrawal destination must be the authority associated token account")]
    WithdrawalDestinationMismatch,
    #[msg("Mint must use six decimals")]
    MintDecimals,
    #[msg("Token account mint does not match the budget")]
    MintMismatch,
    #[msg("Vault authority does not match the budget")]
    VaultAuthorityMismatch,
    #[msg("Amount must be positive")]
    AmountNotPositive,
    #[msg("Original price must be positive")]
    OriginalNotPositive,
    #[msg("Discount must be positive")]
    DiscountNotPositive,
    #[msg("Discount exceeds original price")]
    DiscountExceedsOriginal,
    #[msg("Commission exceeds discount")]
    CommissionExceedsDiscount,
    #[msg("Budget is paused")]
    BudgetPaused,
    #[msg("Budget is already active")]
    BudgetNotActive,
    #[msg("Budget is not paused")]
    BudgetNotPaused,
    #[msg("Insufficient vault balance")]
    InsufficientVault,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Provider recipient does not match the budget")]
    ProviderMismatch,
    #[msg("Platform recipient does not match the budget")]
    PlatformMismatch,
}
