-- Staff Edge Functions write budget configuration. They do not change
-- redemption_economics. Confirmation still requires a matched on-chain receipt.

grant insert, update on private.reward_budgets to service_role;
grant insert, update on private.offer_budgets to service_role;
