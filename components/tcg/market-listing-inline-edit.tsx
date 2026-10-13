'use client';

import {useState, type FormEvent, type ReactNode} from 'react';
import {CheckIcon as Check, PencilSimpleIcon as Pencil, SpinnerGapIcon as Spinner, XIcon as Close} from '@phosphor-icons/react';
import {toast} from 'sonner';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';

export type InlineListingCard = {printingId: string; name: string; quantity: number; unitAmount: number};
type Language = 'EN' | 'ID';

function EditButton({label, expanded, onClick}: {
  label: string; expanded: boolean; onClick: () => void;
}) {
  return <button
    type="button"
    className="market-listing-edit-trigger is-compact"
    onClick={onClick}
    aria-label={label}
    aria-expanded={expanded}
    title={label}
  ><Pencil size={14}/></button>;
}

function EditActions({busy, language, onCancel}: {busy: boolean; language: Language; onCancel: () => void}) {
  const id = language === 'ID';
  return <span className="market-listing-inline-actions">
    <button type="submit" className="market-listing-inline-save" disabled={busy} aria-label={id ? 'Simpan' : 'Save'} title={id ? 'Simpan' : 'Save'}>
      {busy ? <Spinner className="is-spinning" size={15}/> : <Check size={15}/>}
    </button>
    <button type="button" className="market-listing-inline-cancel" disabled={busy} onClick={onCancel} aria-label={id ? 'Batal' : 'Cancel'} title={id ? 'Batal' : 'Cancel'}><Close size={15}/></button>
  </span>;
}

export function MarketListingTitleEdit({listingId, title, language = 'EN', children, variant = 'detail', onSaved}: {
  listingId: string; title: string; language?: Language; children: ReactNode; variant?: 'detail' | 'row'; onSaved: (title: string) => void;
}) {
  const id = language === 'ID';
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const open = () => { setValue(title); setError(''); setEditing(current => !current); };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = value.trim();
    if (next.length < 3 || next.length > 100) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/listings/${encodeURIComponent(listingId)}`, {
        method: 'PATCH', headers: {'content-type': 'application/json'}, body: JSON.stringify({action: 'details', title: next}),
      });
      const result = await response.json() as {title?: string; error?: string};
      if (!response.ok) throw new Error(result.error || 'Could not update listing title.');
      onSaved(result.title ?? next);
      setEditing(false);
      toast.success(id ? 'Judul listing diperbarui' : 'Listing title updated');
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Could not update listing title.';
      setError(message);
    } finally { setBusy(false); }
  };

  return <div className={`market-listing-inline-edit market-listing-inline-title-edit is-${variant}${editing ? ' is-editing' : ''}`}>
    <div className="market-listing-inline-value">{editing ? <form className="market-listing-inline-form market-listing-title-form" onSubmit={save}>
      <input className="market-listing-title-input" aria-label={id ? 'Nama listing' : 'Listing title'} autoFocus required minLength={3} maxLength={100} size={Math.max(3, Math.min(100, value.length + 1))} value={value} disabled={busy} onChange={event => setValue(event.target.value)}/>
      <EditActions busy={busy} language={language} onCancel={() => setEditing(false)}/>
      {error && <small role="alert">{error}</small>}
    </form> : children}</div>
    {!editing && <EditButton label={id ? 'Ubah judul' : 'Edit title'} expanded={editing} onClick={open}/>}
  </div>;
}

export function MarketListingPriceEdit({listingId, title, listingType = 'WTS', amount, currency, cards, language = 'EN', children, onSaved}: {
  listingId: string; title: string; listingType?: 'WTS' | 'WTB'; amount: number; currency: string;
  cards: InlineListingCard[]; language?: Language; children: ReactNode; onSaved: (value: {amount: number; prices: number[]}) => void;
}) {
  const id = language === 'ID';
  const quantity = Math.max(1, cards[0]?.quantity ?? 1);
  const [totalValue, setTotalValue] = useState(String(amount));
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const open = () => { setTotalValue(String(amount)); setError(''); setEditing(current => !current); };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const total = Number(totalValue.replace(/\D/g, ''));
    if (cards.length !== 1 || !Number.isSafeInteger(total) || total < 1) return;
    if (!Number.isSafeInteger(total) || total > 100000000000 || total % quantity !== 0) {
      setError(total % quantity !== 0 ? (id ? 'Total harus habis dibagi jumlah kartu.' : 'The total must divide evenly across card copies.') : (id ? 'Total harga listing melebihi batas.' : 'The listing total is over the price limit.'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const details = listingType === 'WTB';
      const response = await fetch(`/api/listings/${encodeURIComponent(listingId)}`, {
        method: 'PATCH', headers: {'content-type': 'application/json'},
        body: JSON.stringify({action: details ? 'details' : 'price', ...(details ? {title, prices: [total / quantity]} : {amount: total})}),
      });
      const result = await response.json() as {amount?: number; prices?: number[]; error?: string};
      if (!response.ok) throw new Error(result.error || 'Could not update listing price.');
      const savedPrices = result.prices?.length ? result.prices : [total / quantity];
      onSaved({amount: result.amount ?? total, prices: savedPrices});
      setEditing(false);
      toast.success(id ? 'Harga listing diperbarui' : 'Listing price updated');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update listing price.');
    } finally { setBusy(false); }
  };

  if (cards.length !== 1) return <div className="market-listing-inline-value">{children}</div>;
  return <div className={`market-listing-inline-edit market-listing-inline-price-edit${editing ? ' is-editing' : ''}`}>
    <div className="market-listing-inline-value">{editing ? <form className="market-listing-inline-form market-listing-price-form" onSubmit={save}>
      <span className="market-listing-price-currency">{currency || 'IDR'}</span>
      <input className="market-listing-total-input" aria-label={id ? 'Total harga listing' : 'Listing price'} type="text" inputMode="numeric" autoFocus value={totalValue} disabled={busy} onChange={event => setTotalValue(event.target.value)} required/>
      <EditActions busy={busy} language={language} onCancel={() => setEditing(false)}/>
      {error && <small role="alert">{error}</small>}
    </form> : children}</div>
    {!editing && <EditButton label={id ? 'Ubah harga' : 'Edit price'} expanded={editing} onClick={open}/>}
  </div>;
}

export function MarketListingUnitPriceEdit({listingId, title, listingType = 'WTS', cards, cardIndex, currency, language = 'EN', children, onSaved}: {
  listingId: string; title: string; listingType?: 'WTS' | 'WTB'; cards: InlineListingCard[]; cardIndex: number; currency: string; language?: Language; children: ReactNode; onSaved: (unitAmount: number) => void;
}) {
  const id = language === 'ID';
  const card = cards[cardIndex];
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(card?.unitAmount ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!card) return <>{children}</>;
  const open = () => { setValue(String(card.unitAmount)); setError(''); setEditing(current => !current); };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const unitAmount = Number(value.replace(/\D/g, ''));
    if (!Number.isSafeInteger(unitAmount) || unitAmount < 1) return;
    const prices = cards.map((entry, index) => index === cardIndex ? unitAmount : entry.unitAmount);
    setBusy(true);
    try {
      const details = listingType === 'WTB';
      const response = await fetch(`/api/listings/${encodeURIComponent(listingId)}`, {
        method: 'PATCH', headers: {'content-type': 'application/json'},
        body: JSON.stringify({action: details ? 'details' : 'price', ...(details ? {title} : {}), prices}),
      });
      const result = await response.json() as {prices?: number[]; error?: string};
      if (!response.ok) throw new Error(result.error || 'Could not update card price.');
      onSaved(result.prices?.[cardIndex] ?? unitAmount);
      setEditing(false);
      toast.success(id ? 'Harga kartu diperbarui' : 'Card price updated');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update card price.');
    } finally { setBusy(false); }
  };
  return <div className={`market-listing-unit-price-edit${editing ? ' is-editing' : ''}`}>
    {editing ? <form className="market-listing-inline-form market-listing-unit-price-form" onSubmit={save}>
      <span className="market-listing-price-currency">{currency || 'IDR'}</span>
      <input className="market-listing-total-input" aria-label={id ? `Harga ${card.name}` : `Price for ${card.name}`} type="text" inputMode="numeric" autoFocus value={value} disabled={busy} onChange={event => setValue(event.target.value)} required/>
      <EditActions busy={busy} language={language} onCancel={() => setEditing(false)}/>
      {error && <small role="alert">{error}</small>}
    </form> : children}
    {!editing && <EditButton label={id ? 'Ubah harga kartu' : 'Edit card price'} expanded={editing} onClick={open}/>}
  </div>;
}

export function MarketListingPriceTerms({listingId, negotiable, language = 'EN', onSaved}: {
  listingId: string; negotiable: boolean; language?: Language; onSaved: (next: boolean) => void;
}) {
  const id = language === 'ID';
  const [busy, setBusy] = useState(false);
  const change = async (value: string) => {
    const next = value === 'negotiable';
    if (next === negotiable || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/listings/${encodeURIComponent(listingId)}`, {
        method: 'PATCH', headers: {'content-type': 'application/json'}, body: JSON.stringify({action: 'terms', negotiable: next}),
      });
      const result = await response.json() as {negotiable?: boolean; error?: string};
      if (!response.ok) throw new Error(result.error || 'Could not update price terms.');
      onSaved(result.negotiable ?? next);
      toast.success(id ? 'Ketentuan harga diperbarui' : 'Price terms updated');
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Could not update price terms.');
    } finally { setBusy(false); }
  };
  return <Select value={negotiable ? 'negotiable' : 'firm'} onValueChange={value => void change(value)} disabled={busy}>
    <SelectTrigger className="market-listing-price-terms-select" aria-label={id ? 'Ketentuan harga' : 'Price terms'}><SelectValue/></SelectTrigger>
    <SelectContent position="popper" align="start" sideOffset={5} className="market-listing-price-terms-menu">
      <SelectItem value="negotiable">{id ? 'Bisa ditawar' : 'Negotiable'}</SelectItem>
      <SelectItem value="firm">{id ? 'Harga pas' : 'Firm price'}</SelectItem>
    </SelectContent>
  </Select>;
}
