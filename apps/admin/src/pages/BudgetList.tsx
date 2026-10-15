import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';

import { listBudgets } from '../lib/api';
import { supabase } from '../lib/supabase';

type BudgetSummary = {
  chain: { available: boolean; initialized: boolean; paused: boolean | null };
  id: string;
  initStatus: string;
  name: string;
  outstandingUnsecured: boolean;
  pendingSettlements: number;
  providerPartnerName: string;
  sponsorDisplayName: string;
};

type Props = {
  onSession: (session: Session | null) => void;
  session: Session;
};

export function BudgetList({ onSession, session }: Props) {
  const [budgets, setBudgets] = useState<BudgetSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    return listBudgets(session)
      .then((payload) => {
        setBudgets((payload.budgets ?? []) as BudgetSummary[]);
      })
      .catch((caught: Error) => {
        setBudgets(null);
        setError(caught.message);
      });
  };

  useEffect(() => {
    void load();
  }, [session]);

  async function signOut() {
    await supabase.auth.signOut();
    onSession(null);
  }

  return (
    <main>
      <header className="bar">
        <h1>Reward Budgets</h1>
        <div className="actions">
          <Link to="/reward-budgets/new">New budget</Link>
          <button onClick={() => void signOut()} type="button">Sign out</button>
        </div>
      </header>
      {error ? (
        <p className="error">
          {error}
          {' '}
          <button onClick={() => void load()} type="button">Retry</button>
        </p>
      ) : null}
      {budgets ? (
        <>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Sponsor</th>
                <th>Provider</th>
                <th>Chain</th>
                <th>Settlements</th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((budget) => (
                <tr key={budget.id}>
                  <td><Link to={`/reward-budgets/${budget.id}`}>{budget.name}</Link></td>
                  <td>{budget.sponsorDisplayName}</td>
                  <td>{budget.providerPartnerName}</td>
                  <td>
                    {budget.chain.initialized
                      ? budget.chain.paused
                        ? 'Paused'
                        : 'Initialized'
                      : 'Not initialized'}
                    {budget.chain.available ? '' : ' · chain unread'}
                  </td>
                  <td>
                    {budget.pendingSettlements > 0
                      ? `${budget.pendingSettlements} pending`
                      : 'None pending'}
                    {budget.outstandingUnsecured ? ' · reimbursements unsecured' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {budgets.length === 0 ? <p>No budgets yet.</p> : null}
        </>
      ) : error ? null : <p>Loading…</p>}
    </main>
  );
}
