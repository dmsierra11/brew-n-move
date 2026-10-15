import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';

import { getBudget, getCampaigns, runBudgetAction } from '../lib/api';
import { formatMinorEuro } from '../lib/money';
import { CampaignForm, type CampaignOffer, type Cover } from './CampaignForm';

type Settlement = {
  amounts: { commission: string | number | null; discount: string | number | null; providerReimbursement: string | number | null };
  displayStatus: string;
  explorerUrl: string | null;
  fixtureLabel: string | null;
  id: string;
  lastError: string | null;
  note: string | null;
  redemptionId: string | null;
  retryCount: number;
  signature: string | null;
};

type Budget = {
  authorityWallet: string;
  budgetChainId: string;
  budgetPda: string | null;
  chain: {
    available: boolean;
    explorerUrl: string | null;
    initialized: boolean;
    paused: boolean | null;
    vaultBalance: string | null;
  };
  commissionBps: number;
  id: string;
  mint: string;
  name: string;
  network: string;
  outstandingUnsecured: boolean;
  platformTokenAccount: string;
  programId: string;
  providerPartnerName: string;
  providerTokenAccount: string;
  settlements: Settlement[];
  sponsorDisplayName: string;
  vaultPda: string | null;
  verifierWallet: string;
  withdrawalTokenAccount: string;
};

type Props = {
  session: Session;
};

function commissionLabel(bps: number) {
  return `${(bps / 100).toFixed(0)}%`;
}

function settlementStatus(status: string) {
  if (status === 'confirmed') {
    return 'Confirmed';
  }
  if (status === 'failed') {
    return 'Failed';
  }
  if (status === 'needs_reconciliation') {
    return 'Needs review';
  }
  return 'Waiting';
}

export function BudgetDetail({ session }: Props) {
  const { id = '' } = useParams();
  const [budget, setBudget] = useState<Budget | null>(null);
  const [funder, setFunder] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignOffer[]>([]);
  const [cover, setCover] = useState<Cover | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [amount, setAmount] = useState('10.00');
  const [confirmFund, setConfirmFund] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const payload = await getBudget(session, id);
      setBudget(payload.budget as Budget);
      setFunder(typeof payload.adminFunderPublicKey === 'string' ? payload.adminFunderPublicKey : null);
      const extra = payload.cover && payload.campaigns
        ? payload
        : await getCampaigns(session, id).catch(() => null);
      setCampaigns(((extra?.campaigns ?? payload.campaigns) ?? []) as CampaignOffer[]);
      setCover(((extra?.cover ?? payload.cover) ?? null) as Cover | null);
    } catch (caught) {
      setBudget(null);
      setError(caught instanceof Error ? caught.message : 'unavailable');
    }
  }, [id, session]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(body: Record<string, unknown>) {
    setError(null);
    setNotice(null);
    try {
      const result = await runBudgetAction(session, body);
      setNotice(typeof result.warning === 'string' ? result.warning : typeof result.reason === 'string' ? result.reason : 'Done');
      setConfirmFund(false);
      setConfirmWithdraw(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'unavailable');
    }
  }

  function submitFund(event: FormEvent) {
    event.preventDefault();
    if (!confirmFund) {
      setConfirmFund(true);
      return;
    }
    void run({ action: 'fund', amount, budgetId: id });
  }

  function submitWithdraw(event: FormEvent) {
    event.preventDefault();
    if (!confirmWithdraw) {
      setConfirmWithdraw(true);
      return;
    }
    void run({ action: 'withdraw', amount, budgetId: id });
  }

  if (!budget) {
    return (
      <main>
        <p><Link to="/reward-budgets">Reward Budgets</Link></p>
        {error ? (
          <p className="error">
            {error}
            {' '}
            <button onClick={() => void load()} type="button">Retry</button>
          </p>
        ) : <p>Loading…</p>}
      </main>
    );
  }

  return (
    <main>
      <p><Link to="/reward-budgets">Reward Budgets</Link></p>
      <h1>{budget.name}</h1>
      <p>{budget.sponsorDisplayName} · {budget.providerPartnerName} · {commissionLabel(budget.commissionBps)}</p>
      {error ? <p className="error">{error}</p> : null}
      {notice ? <p>{notice}</p> : null}

      <CampaignForm
        budgetId={budget.id}
        commissionBps={budget.commissionBps}
        cover={cover}
        offers={campaigns}
        onSaved={load}
        session={session}
      />

      <section>
        <div className="bar">
          <h2>Settlements</h2>
          <button onClick={() => void load()} type="button">Refresh</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Subject</th>
              <th>Status</th>
              <th>Discount</th>
              <th>Café</th>
              <th>Brew &amp; Move</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {budget.settlements.map((row) => (
              <tr key={row.id}>
                <td>{row.fixtureLabel ?? 'Voucher'}</td>
                <td>
                  <div>{settlementStatus(row.displayStatus)}</div>
                  {row.note ? <div className="muted">{row.note}</div> : null}
                  {row.lastError ? <div className="muted">{row.lastError}</div> : null}
                </td>
                <td>{formatMinorEuro(row.amounts.discount)}</td>
                <td>{formatMinorEuro(row.amounts.providerReimbursement)}</td>
                <td>{formatMinorEuro(row.amounts.commission)}</td>
                <td>
                  <div className="stack">
                    {row.explorerUrl ? (
                      <a href={row.explorerUrl} rel="noreferrer" target="_blank">View on Explorer</a>
                    ) : null}
                    {row.displayStatus === 'confirmed' ? null : (
                      <button onClick={() => void run({ action: 'retry', settlementId: row.id })} type="button">Retry</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {budget.settlements.length === 0 ? <p>No settlements.</p> : null}
      </section>

      <details className="vault">
        <summary>Vault details</summary>
        <p>
          {budget.chain.initialized
            ? budget.chain.paused
              ? 'Paused on-chain'
              : 'Initialized and active'
            : 'Not initialized on-chain'}
          {budget.chain.available ? '' : ' · Devnet unread'}
        </p>
        <p>Vault balance: {budget.chain.vaultBalance == null ? 'unavailable' : `${formatMinorEuro(budget.chain.vaultBalance)} (${budget.chain.vaultBalance})`}</p>
        {budget.chain.explorerUrl ? <p><a href={budget.chain.explorerUrl} rel="noreferrer" target="_blank">Budget on Explorer</a></p> : <p>No Explorer link until the budget account is verified on-chain.</p>}
        <dl>
          <div><dt>Program</dt><dd>{budget.programId}</dd></div>
          <div><dt>Authority</dt><dd>{budget.authorityWallet}</dd></div>
          <div><dt>Verifier</dt><dd>{budget.verifierWallet}</dd></div>
          <div><dt>Mint</dt><dd>{budget.mint}</dd></div>
          <div><dt>Provider</dt><dd>{budget.providerTokenAccount}</dd></div>
          <div><dt>Platform</dt><dd>{budget.platformTokenAccount}</dd></div>
          <div><dt>Withdrawal</dt><dd>{budget.withdrawalTokenAccount}</dd></div>
          <div><dt>Budget PDA</dt><dd>{budget.budgetPda ?? '—'}</dd></div>
          <div><dt>Vault PDA</dt><dd>{budget.vaultPda ?? '—'}</dd></div>
        </dl>
        <form onSubmit={submitFund}>
          <label>
            Amount (euro)
            <input onChange={(event) => setAmount(event.target.value)} value={amount} />
          </label>
          <p>
            Add cover to this vault. This does not create a campaign.
            Tokens come from the server-held admin funder
            {funder ? ` ${funder}` : ' (not configured on the server)'}.
            Outstanding reimbursements are not reserved on-chain.
          </p>
          <button type="submit">{confirmFund ? 'Confirm fund' : 'Fund'}</button>
        </form>
        <form onSubmit={submitWithdraw}>
          <p>Remove unused vault cover. This does not create a campaign. Withdrawal is refused while any settlement for this budget is not chain-confirmed.</p>
          <button disabled={budget.outstandingUnsecured} type="submit">
            {confirmWithdraw ? 'Confirm withdraw' : 'Withdraw unused'}
          </button>
        </form>
        <details className="advanced">
          <summary>Advanced</summary>
          <p>These control the on-chain vault. They are not how you create a campaign.</p>
          <div className="actions">
            <button onClick={() => void run({ action: 'initialize', budgetId: id })} type="button">Initialize</button>
            <button onClick={() => void run({ action: 'pause', budgetId: id })} type="button">Pause</button>
            <button onClick={() => void run({ action: 'resume', budgetId: id })} type="button">Resume</button>
            <button onClick={() => void run({ action: 'queue-fixture', budgetId: id })} type="button">Queue labeled fixture</button>
          </div>
        </details>
      </details>
    </main>
  );
}
