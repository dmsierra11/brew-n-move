import { useMemo, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';

import { runCampaignAction } from '../lib/api';
import {
  campaignFromCoffeeAndDiscount,
  discountPercentFromPrices,
  formatMinorEuro,
  parseEuroToCents,
  parsePercent,
  settlementPreview,
} from '../lib/money';

export type CampaignOffer = {
  collect_end: string | null;
  collect_start: string | null;
  description: string;
  expires_at: string | null;
  id: string;
  issued_count: number;
  list_price_cents: number;
  location_id: string;
  partner_name: string;
  pay_price_cents: number;
  points_cost: number;
  quantity: number | null;
  status: string;
  title: string;
  value_label: string;
};

export type Cover = {
  available?: number | string;
  deposited?: number | string;
  reserved?: number | string;
};

type Props = {
  budgetId: string;
  commissionBps: number;
  cover: Cover | null;
  offers: CampaignOffer[];
  onSaved: () => Promise<void>;
  session: Session;
};

function coverLine(remaining: number, total: string) {
  const words = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
  const count = remaining >= 0 && remaining <= 10 ? words[remaining] : String(remaining);
  return remaining === 1
    ? `${count} voucher uses ${total} of this vault`
    : `${count} vouchers use ${total} of this vault`;
}

function emptyForm() {
  return {
    collectEnd: '',
    collectStart: '',
    description: 'Demo offer: 20% off a 4.00 coffee. 3fe Demo Café is a labeled demonstration record, not a commercial partnership.',
    discountPercent: '20',
    expiresAt: '',
    listPrice: '4.00',
    quantity: '10',
    status: 'paused',
    title: '20% off a coffee',
  };
}

function fromOffer(offer: CampaignOffer) {
  return {
    collectEnd: offer.collect_end?.slice(0, 5) ?? '',
    collectStart: offer.collect_start?.slice(0, 5) ?? '',
    description: offer.description,
    discountPercent: discountPercentFromPrices(offer.list_price_cents, offer.pay_price_cents),
    expiresAt: offer.expires_at ? offer.expires_at.slice(0, 16) : '',
    listPrice: (offer.list_price_cents / 100).toFixed(2),
    quantity: String(offer.quantity ?? ''),
    status: offer.status,
    title: offer.title,
  };
}

function offerStatusLabel(status: string) {
  return status === 'active' ? 'live' : status;
}

export function CampaignForm({ budgetId, commissionBps, cover, offers, onSaved, session }: Props) {
  const [selectedId, setSelectedId] = useState(offers[0]?.id ?? 'new');
  const selected = offers.find((offer) => offer.id === selectedId) ?? null;
  const [form, setForm] = useState(() => (offers[0] ? fromOffer(offers[0]) : emptyForm()));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const listCents = parseEuroToCents(form.listPrice);
  const discountPercent = parsePercent(form.discountPercent);
  const pricing = listCents != null && listCents > 0 && discountPercent != null && discountPercent > 0
    ? campaignFromCoffeeAndDiscount(listCents, discountPercent)
    : null;
  const payCents = pricing?.payCents ?? null;
  const pointsCost = pricing?.pointsCost ?? null;
  const quantity = Number.parseInt(form.quantity, 10);
  const issued = selected?.issued_count ?? 0;
  const remaining = Number.isInteger(quantity) ? Math.max(quantity - issued, 0) : 0;
  const preview = listCents != null && payCents != null && payCents <= listCents && listCents > 0
    ? settlementPreview(listCents, payCents, commissionBps)
    : null;
  const needed = preview ? preview.discount * BigInt(remaining) : 0n;
  const available = cover?.available == null ? 0n : BigInt(cover.available);
  const underfunded = preview != null && preview.discount > 0n && needed > available;
  const commissionPercent = (commissionBps / 100).toFixed(0);

  const copy = useMemo(() => {
    if (!preview) {
      return null;
    }
    return {
      commission: formatMinorEuro(preview.commission),
      discount: formatMinorEuro(preview.discount),
      list: formatMinorEuro(preview.original),
      pay: formatMinorEuro(preview.discounted),
      provider: formatMinorEuro(preview.provider),
    };
  }, [preview]);

  function selectOffer(id: string) {
    setSelectedId(id);
    setError(null);
    setNotice(null);
    if (id === 'new') {
      setForm(emptyForm());
      return;
    }
    const offer = offers.find((row) => row.id === id);
    if (offer) {
      setForm(fromOffer(offer));
    }
  }

  function set(name: keyof ReturnType<typeof emptyForm>, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: FormEvent, status: 'paused' | 'active') {
    event.preventDefault();
    if (listCents == null || payCents == null || pointsCost == null || !Number.isInteger(quantity) || quantity < 1) {
      setError('Enter a coffee value, a discount percentage, and a quantity of at least 1.');
      return;
    }
    if (status === 'active' && underfunded) {
      setError('This vault does not have enough remaining cover. Add cover in Vault details, then create the campaign.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await runCampaignAction(session, {
        action: selected ? 'update-campaign' : 'create-campaign',
        budgetId,
        collectEnd: form.collectEnd || null,
        collectStart: form.collectStart || null,
        description: form.description,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        listPriceCents: listCents,
        offerId: selected?.id,
        payPriceCents: payCents,
        pointsCost,
        quantity,
        status,
        title: form.title,
        valueLabel: pricing?.valueLabel ?? form.title,
      });
      const createdId = typeof result.id === 'string' ? result.id : null;
      setNotice(
        status === 'active'
          ? 'Live on Rewards.'
          : selected?.status === 'active'
            ? 'Campaign paused.'
            : selected
              ? 'Campaign saved.'
              : 'Campaign created.',
      );
      await onSaved();
      if (createdId) {
        setSelectedId(createdId);
      }
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message : 'unavailable';
      setError(reason === 'underfunded'
        ? 'This vault does not have enough remaining cover. Add cover in Vault details, then create the campaign.'
        : reason === 'quantity_below_issued'
          ? 'Quantity cannot go below the number of vouchers already issued.'
          : reason);
    } finally {
      setBusy(false);
    }
  }

  const live = selected?.status === 'active';

  return (
    <section>
      <h2>Campaign</h2>
      <p>New campaigns bind to 3fe Demo Café and go live on Rewards when created. Issued vouchers keep their frozen discount and reserved cover.</p>
      <label>
        Campaign
        <select onChange={(event) => selectOffer(event.target.value)} value={selectedId}>
          {offers.map((offer) => (
            <option key={offer.id} value={offer.id}>
              {offer.title} · {offer.partner_name} · {offerStatusLabel(offer.status)}
            </option>
          ))}
          <option value="new">New campaign</option>
        </select>
      </label>
      {selected ? (
        <p>{live ? 'Live on Rewards.' : 'Paused. Not shown on Rewards.'}</p>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {notice ? <p>{notice}</p> : null}
      <form onSubmit={(event) => void submit(event, selected ? (live ? 'active' : 'paused') : 'active')}>
        <label>Title<input onChange={(event) => set('title', event.target.value)} value={form.title} /></label>
        <label>Description<textarea onChange={(event) => set('description', event.target.value)} value={form.description} /></label>
        <label>Coffee value (euro)<input onChange={(event) => set('listPrice', event.target.value)} value={form.listPrice} /></label>
        <label>Discount (%)<input onChange={(event) => set('discountPercent', event.target.value)} value={form.discountPercent} /></label>
        <label>Quantity<input onChange={(event) => set('quantity', event.target.value)} value={form.quantity} /></label>
        <label>Collect from (optional)<input onChange={(event) => set('collectStart', event.target.value)} type="time" value={form.collectStart} /></label>
        <label>Collect until (optional)<input onChange={(event) => set('collectEnd', event.target.value)} type="time" value={form.collectEnd} /></label>
        <label>Expiry (optional)<input onChange={(event) => set('expiresAt', event.target.value)} type="datetime-local" value={form.expiresAt} /></label>
        {copy && preview && pricing ? (
          <div className="preview">
            <p>{pricing.valueLabel}</p>
            <dl className="split">
              <div><dt>Coffee</dt><dd>{copy.list}</dd></div>
              <div><dt>Member pays</dt><dd>{copy.pay}</dd></div>
              <div><dt>Discount</dt><dd>{copy.discount}</dd></div>
              <div><dt>Brew Points</dt><dd>{pricing.pointsCost}</dd></div>
              <div><dt>Café receives</dt><dd>{copy.provider}</dd></div>
              <div><dt>Brew &amp; Move receives</dt><dd>{copy.commission}</dd></div>
            </dl>
            <p>{coverLine(remaining, formatMinorEuro(needed))}</p>
            <p className="muted">Vault remaining {formatMinorEuro(available)} · {commissionPercent}% of what the member pays</p>
            {underfunded ? (
              <p className="error">This vault does not have enough remaining cover. Add cover in Vault details, then create the campaign.</p>
            ) : null}
            {issued > 0 ? <p>{issued} voucher{issued === 1 ? '' : 's'} already issued. Price and availability changes apply only to future issuances.</p> : null}
          </div>
        ) : (
          <p>Enter a coffee value and a discount percentage to preview the split.</p>
        )}
        <div className="actions">
          {selected ? (
            <>
              <button disabled={busy || (live && underfunded) || !preview} type="submit">Save</button>
              {live ? (
                <button className="secondary" disabled={busy} onClick={(event) => void submit(event, 'paused')} type="button">Pause</button>
              ) : (
                <button
                  className="secondary"
                  disabled={busy || underfunded || !preview}
                  onClick={(event) => void submit(event, 'active')}
                  type="button"
                >
                  Make live
                </button>
              )}
            </>
          ) : (
            <button disabled={busy || underfunded || !preview} type="submit">Create campaign</button>
          )}
        </div>
      </form>
    </section>
  );
}
