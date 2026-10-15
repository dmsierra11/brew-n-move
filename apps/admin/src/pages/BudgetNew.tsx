import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';

import { createBudget, listBudgets } from '../lib/api';

type Option = { id: string; name?: string; partnerName?: string; title?: string };

type Props = {
  session: Session;
};

export function BudgetNew({ session }: Props) {
  const navigate = useNavigate();
  const [partners, setPartners] = useState<Option[]>([]);
  const [offers, setOffers] = useState<Option[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    authorityWallet: 'i7d7ASxYiz8bUaeQMoVrLXYA17GnviQoehznW2ADb1b',
    budgetChainId: '',
    commission: '5%',
    mint: '',
    name: '',
    network: 'devnet',
    offerId: '',
    platformTokenAccount: '',
    programId: 'DHtXZcQnMM5t3L3hAy2JkksbTgC2GenXAHQyexZDA8vL',
    providerPartnerId: '',
    providerTokenAccount: '',
    sponsorDisplayName: '',
    verifierWallet: 'CDyck2egjjBpdJ5ZcvYsHinjjxf3dhSgdNFLhW5TRtdU',
    withdrawalTokenAccount: '',
  });

  useEffect(() => {
    listBudgets(session)
      .then((payload) => {
        setPartners((payload.partners ?? []) as Option[]);
        setOffers((payload.offers ?? []) as Option[]);
      })
      .catch((caught: Error) => setError(caught.message));
  }, [session]);

  function set(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await createBudget(session, form);
      navigate(`/reward-budgets/${created.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'unavailable');
      setBusy(false);
    }
  }

  return (
    <main className="narrow">
      <p><Link to="/reward-budgets">Reward Budgets</Link></p>
      <h1>New budget</h1>
      <p>Commission and euro amounts are converted to integers on the server. Provider and platform token accounts must differ.</p>
      <form onSubmit={submit}>
        <label>Name<input onChange={(event) => set('name', event.target.value)} value={form.name} /></label>
        <label>Sponsor display name<input onChange={(event) => set('sponsorDisplayName', event.target.value)} value={form.sponsorDisplayName} /></label>
        <label>
          Provider partner
          <select onChange={(event) => set('providerPartnerId', event.target.value)} value={form.providerPartnerId}>
            <option value="">Select</option>
            {partners.map((partner) => (
              <option key={partner.id} value={partner.id}>{partner.name}</option>
            ))}
          </select>
        </label>
        <label>
          Link offer
          <select onChange={(event) => set('offerId', event.target.value)} value={form.offerId}>
            <option value="">None</option>
            {offers.map((offer) => (
              <option key={offer.id} value={offer.id}>{offer.partnerName} · {offer.title}</option>
            ))}
          </select>
        </label>
        <label>Commission<input onChange={(event) => set('commission', event.target.value)} value={form.commission} /></label>
        <label>Budget chain id<input onChange={(event) => set('budgetChainId', event.target.value)} value={form.budgetChainId} /></label>
        <label>Authority<input onChange={(event) => set('authorityWallet', event.target.value)} value={form.authorityWallet} /></label>
        <label>Verifier<input onChange={(event) => set('verifierWallet', event.target.value)} value={form.verifierWallet} /></label>
        <label>Provider token account<input onChange={(event) => set('providerTokenAccount', event.target.value)} value={form.providerTokenAccount} /></label>
        <label>Platform token account<input onChange={(event) => set('platformTokenAccount', event.target.value)} value={form.platformTokenAccount} /></label>
        <label>Withdrawal token account<input onChange={(event) => set('withdrawalTokenAccount', event.target.value)} value={form.withdrawalTokenAccount} /></label>
        <label>Mint<input onChange={(event) => set('mint', event.target.value)} value={form.mint} /></label>
        <label>Program<input onChange={(event) => set('programId', event.target.value)} value={form.programId} /></label>
        <label>Network<input onChange={(event) => set('network', event.target.value)} value={form.network} /></label>
        {error ? <p className="error">{error}</p> : null}
        <button disabled={busy} type="submit">Create</button>
      </form>
    </main>
  );
}
