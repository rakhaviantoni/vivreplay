'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { 
  XIcon as X, 
  ShieldCheckIcon as ShieldCheck, 
  SparkleIcon as Sparkles,
  CameraIcon as Camera,
  MagnifyingGlassIcon as Search
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { cards, printings, Card } from '@/packages/card-data/catalog';
import { GRADING_PROVIDERS } from '@/packages/domain';
import { CardArt } from '../card-art';
import { CardMarketPanel } from '../../card-market-panel';
import { api } from '@/lib/client';
import { addLocalVaultItem, deleteLocalVaultItem, getLocalVaultItems, updateLocalVaultItem } from '../local-vault';
import type { EnrichedCollectionItem } from '../types';
import type { VaultPrinting } from '../types';

interface AddEditItemModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  editingItem?: EnrichedCollectionItem | null;
  initialCard?: Card;
  initialPrintingId?: string;
  isAnonymous?: boolean;
  language?: 'EN' | 'ID';
}

function normalizedProvider(value?:string|null){
  const normalized=(value??'PSA').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
  const alias=normalized==='beckett'?'bgs':normalized==='certifiedguarantycompany'?'cgc':normalized;
  return GRADING_PROVIDERS.find(provider=>[provider.id,provider.shortName,provider.name].some(candidate=>candidate.toLowerCase().replace(/[^a-z0-9]/g,'')===alias))?.shortName??value??'PSA';
}

function uniquePrintings(printings:VaultPrinting[],preferredId?:string){
  const ordered=[...printings].sort((a,b)=>String(b.id===preferredId).localeCompare(String(a.id===preferredId)));
  const seenIds=new Set<string>();
  const seenPrintings=new Set<string>();
  return ordered.filter(printing=>{
    const id=String(printing.id);
    if(seenIds.has(id))return false;
    seenIds.add(id);
    const code=String(printing.printing_code??'').trim().toLowerCase();
    if(!code)return true;
    const key=[String(printing.language??'').toLowerCase(),String(printing.set_code??'').toUpperCase().replace(/[-_\s]/g,''),String(printing.variant??'standard').trim().toLowerCase(),code].join('|');
    if(seenPrintings.has(key))return false;
    seenPrintings.add(key);
    return true;
  });
}

export function AddEditItemModal({
  open,
  onClose,
  onSaved,
  editingItem,
  initialCard,
  initialPrintingId,
  isAnonymous = false,
  language = 'EN',
}: AddEditItemModalProps) {
  const isEditing = Boolean(editingItem);

  const [selectedCardCode, setSelectedCardCode] = useState<string>(
    editingItem ? editingItem.card.code : (initialCard ? initialCard.code : 'OP05-119')
  );
  const [cardQuery, setCardQuery] = useState('');
  const [identityPickerOpen, setIdentityPickerOpen] = useState(!editingItem && !initialCard);
  const [identityConfirmed, setIdentityConfirmed] = useState(Boolean(editingItem || initialCard));
  const [selectedIdentity, setSelectedIdentity] = useState<Card | null>(initialCard ?? null);
  const [identityResults, setIdentityResults] = useState<Card[]>([]);
  const [identitySearchLoading, setIdentitySearchLoading] = useState(false);
  const [itemType, setItemType] = useState<'RAW' | 'GRADED'>(
    editingItem ? editingItem.type : 'RAW'
  );
  const [cardLanguage, setCardLanguage] = useState<'EN' | 'JP'>((editingItem?.card.language as 'EN'|'JP') || editingItem?.language as 'EN'|'JP' || 'EN');
  const [selectedPrintingId, setSelectedPrintingId] = useState(editingItem?.printingId ?? '');
  const [condition, setCondition] = useState(editingItem?.condition || 'NM');
  const [quantity, setQuantity] = useState(editingItem ? editingItem.quantity : 1);
  const [provider, setProvider] = useState(normalizedProvider(editingItem?.provider));
  const [grade, setGrade] = useState(editingItem?.grade || '10');
  const [certification, setCertification] = useState(editingItem?.certification || '');
  const [acquisitionCost, setAcquisitionCost] = useState(editingItem ? String(editingItem.acquisitionAmount || '') : '');
  const [acquiredDate, setAcquiredDate] = useState(editingItem?.acquiredAt?.slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [visibility, setVisibility] = useState<'private' | 'public'>(editingItem?.visibility === 'public' ? 'public' : 'private');
  const [notes, setNotes] = useState(editingItem?.notes || '');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  
  // Subgrades state
  const existingSub = editingItem?.subgrades || {};
  const [centering, setCentering] = useState(String(existingSub.Centering || '10'));
  const [corners, setCorners] = useState(String(existingSub.Corners || '9.5'));
  const [edges, setEdges] = useState(String(existingSub.Edges || '10'));
  const [surface, setSurface] = useState(String(existingSub.Surface || '9.5'));

  const [busy, setBusy] = useState(false);
  const [catalogPrintings, setCatalogPrintings] = useState<VaultPrinting[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [marketEstimateIdr, setMarketEstimateIdr] = useState<number | null>(null);
  const [marketEstimateLoading, setMarketEstimateLoading] = useState(true);
  const onMarketPrice=useCallback((amount:number|null)=>{
    if(amount===null||!Number.isFinite(amount)||amount<=0){setMarketEstimateIdr(null);return;}
    const normalized=Math.round(amount);
    setMarketEstimateIdr(normalized);
  },[]);

  useEffect(() => {
    if (!open) return;
    setSubmitAttempted(false);
    setSelectedCardCode(editingItem?.card.code ?? initialCard?.code ?? 'OP05-119');
    setCardQuery('');
    setIdentityPickerOpen(!editingItem && !initialCard);
    setIdentityConfirmed(Boolean(editingItem || initialCard));
    setSelectedIdentity(editingItem?.card ?? initialCard ?? null);
    setItemType(editingItem?.type ?? 'RAW');
    setCardLanguage((editingItem?.card.language as 'EN'|'JP') || (editingItem?.language as 'EN'|'JP') || 'EN');
    setSelectedPrintingId(editingItem?.printingId ?? initialPrintingId ?? '');
    setCondition(editingItem?.condition || 'NM');
    setQuantity(editingItem?.quantity ?? 1);
    setProvider(normalizedProvider(editingItem?.provider));
    setGrade(editingItem?.grade || '10');
    setCertification(editingItem?.certification || '');
    setAcquisitionCost(editingItem ? String(editingItem.acquisitionAmount || '') : '');
    setAcquiredDate(editingItem?.acquiredAt?.slice(0, 10) || new Date().toISOString().slice(0, 10));
    setVisibility(editingItem?.visibility === 'public' ? 'public' : 'private');
    setNotes(editingItem?.notes || '');
    const subgrades = editingItem?.subgrades || {};
    setCentering(String(subgrades.Centering || '10'));
    setCorners(String(subgrades.Corners || '9.5'));
    setEdges(String(subgrades.Edges || '10'));
    setSurface(String(subgrades.Surface || '9.5'));
  }, [open, editingItem, initialCard, initialPrintingId]);

  useEffect(() => {
    const query=cardQuery.trim();
    if(!open||!identityPickerOpen||query.length<2){setIdentityResults([]);setIdentitySearchLoading(false);return;}
    let active=true;
    const controller=new AbortController();
    const timer=window.setTimeout(()=>{
      setIdentitySearchLoading(true);
      void fetch(`/api/cards/identities?q=${encodeURIComponent(query)}`,{signal:controller.signal})
        .then(async response=>{if(!response.ok)throw new Error('Card search is unavailable.');return await response.json() as {cards?:Array<{id:string;code:string;name:string;color:string;card_type:Card['type'];cost:number;power:number;effect_text:string;rarity:string|null;imageUrl?:string}>};})
        .then(result=>{if(active)setIdentityResults((result.cards??[]).map(card=>({id:card.id,code:card.code,name:card.name,color:card.color,type:card.card_type,cost:card.cost,power:card.power,effect:card.effect_text,rarity:card.rarity??'',art:0,imageSource:'external',imageUrl:card.imageUrl})));})
        .catch(()=>{if(active)setIdentityResults([]);})
        .finally(()=>{if(active)setIdentitySearchLoading(false);});
    },220);
    return()=>{active=false;window.clearTimeout(timer);controller.abort();};
  },[open,identityPickerOpen,cardQuery]);

  useEffect(() => {
    if (!open) return;
    const identityCode=editingItem?.card.code??selectedCardCode;
    let active = true;
    const controller = new AbortController();
    setCatalogLoading(true);
    void Promise.all((['EN', 'JP'] as const).map(async language => {
      const response = await fetch(`/api/cards/catalog?language=${language}&code=${encodeURIComponent(identityCode)}`, {signal: controller.signal});
      if (!response.ok) return [];
      const payload = await response.json() as {cards?:Array<{id:string;language:string;variant:string|null;printing_code:string|null;card_image_url:string|null;set_code:string|null;rarity:string|null}>};
      return (payload.cards ?? []).map(printing => ({
        id:printing.id,language:printing.language,variant:printing.variant ?? 'Standard',printing_code:printing.printing_code ?? undefined,
        card_image_url:printing.card_image_url,set_code:printing.set_code ?? undefined,rarity:printing.rarity ?? undefined,
      } satisfies VaultPrinting));
    })).then(results => {if(active)setCatalogPrintings(results.flat());}).catch(() => {if(active)setCatalogPrintings([]);}).finally(() => {if(active)setCatalogLoading(false);});
    return () => {active = false;controller.abort();};
  }, [open, editingItem?.card.code, selectedCardCode]);

  useEffect(() => {
    if (!open || !catalogPrintings.length || catalogPrintings.some(printing=>printing.language===cardLanguage)) return;
    setCardLanguage(catalogPrintings[0].language as 'EN'|'JP');
  }, [open,catalogPrintings,cardLanguage]);

  useEffect(()=>{
    if(!open||!identityConfirmed||isEditing||catalogLoading||!catalogPrintings.length)return;
    const current=catalogPrintings.find(printing=>printing.id===selectedPrintingId);
    if(current&&current.language===cardLanguage)return;
    const next=catalogPrintings.find(printing=>printing.language===cardLanguage)??catalogPrintings[0];
    setSelectedPrintingId(next.id);
  },[open,identityConfirmed,isEditing,catalogLoading,catalogPrintings,selectedPrintingId,cardLanguage]);

  const currentCard = (isEditing ? editingItem?.card : undefined) || selectedIdentity || cards.find(c => c.code === selectedCardCode) || cards[0];
  const hasSelectedIdentity = Boolean(
    currentCard?.code &&
    (isEditing || selectedIdentity || identityConfirmed || initialCard)
  );
  const sourcePrintingOptions:VaultPrinting[] = catalogPrintings.length
    ? catalogPrintings
    : catalogLoading
      ? []
      : editingItem?.card.availablePrintings?.length
      ? editingItem.card.availablePrintings
    : printings.filter(p => p.cardId === currentCard.id).map(p => ({id:p.id,language:p.language,variant:p.variant,printing_code:currentCard.printingCode??currentCard.code,set_code:p.set}));
  const uniquePrintingOptions=uniquePrintings(sourcePrintingOptions,editingItem?.printingId);
  const targetPrinting = uniquePrintingOptions.find(p => p.id === selectedPrintingId)
    || (isEditing && editingItem && selectedPrintingId === editingItem.printingId ? {id:editingItem.printingId,language:editingItem.language??editingItem.card.language??cardLanguage,variant:editingItem.variant??currentCard.variant??'Standard',printing_code:editingItem.printingCode??currentCard.printingCode??currentCard.code,set_code:editingItem.setCode??currentCard.setCode} : undefined)
    || uniquePrintingOptions.find(p => p.language === cardLanguage)
    || (isEditing && editingItem ? {id:editingItem.printingId,language:cardLanguage,variant:editingItem.variant??currentCard.variant??'Standard',printing_code:editingItem.printingCode??currentCard.printingCode??currentCard.code} : undefined)
    || uniquePrintingOptions[0];
  const targetLanguage = (targetPrinting?.language ?? cardLanguage) as 'EN'|'JP';
  const hasMarketReference = targetLanguage === 'JP';
  const selectedCardArt:Card = targetPrinting ? {...currentCard,id:targetPrinting.id,language:targetLanguage,variant:targetPrinting.variant??'Standard',setCode:targetPrinting.set_code??currentCard.setCode,printingCode:targetPrinting.printing_code??currentCard.printingCode,imageUrl:targetPrinting.card_image_url??currentCard.imageUrl} : currentCard;
  const availableLanguages = [...new Set(uniquePrintingOptions.map(printing => printing.language as 'EN'|'JP'))];
  const languagePrintings = uniquePrintingOptions.filter(printing => printing.language === cardLanguage);
  const selectedPrinting=uniquePrintingOptions.find(printing=>printing.id===targetPrinting?.id)??targetPrinting;
  const quantityValid = Number.isInteger(quantity) && quantity >= 1 && quantity <= 999;
  const formIssues = [
    !hasSelectedIdentity ? 'Search for and select a card identity.' : '',
    hasSelectedIdentity && !targetPrinting ? (catalogLoading ? 'Printings are still loading.' : 'Choose an available printing.') : '',
    itemType === 'RAW' && !quantityValid ? 'Enter a quantity from 1 to 999.' : '',
    itemType === 'GRADED' && !grade.trim() ? 'Enter the slab grade.' : '',
  ].filter(Boolean);

  useEffect(()=>{
    const estimatePrintingId=targetPrinting?.id;
    if(!open||!hasSelectedIdentity||!estimatePrintingId)return;
    if(targetLanguage!=='JP'){
      setMarketEstimateIdr(null);
      setMarketEstimateLoading(false);
      return;
    }
    let active=true;
    const controller=new AbortController();
    setMarketEstimateIdr(null);
    setMarketEstimateLoading(true);
    const applyEstimate=(estimate:unknown)=>{
      if(!active||typeof estimate!=='number'||!Number.isFinite(estimate)||estimate<=0)return false;
      const amount=Math.round(estimate);
      setMarketEstimateIdr(amount);
      return true;
    };
    void (async()=>{
      try{
        const historyResponse=await fetch(`/api/market/yuyutei?printingId=${encodeURIComponent(estimatePrintingId)}`,{signal:controller.signal});
        if(historyResponse.ok){
          const historyPayload=await historyResponse.json() as {history?:Array<{amount:number;currency:string}>;jpyToIdrRate?:number};
          const observation=historyPayload.history?.at(-1);
          const rate=historyPayload.jpyToIdrRate&&Number.isFinite(historyPayload.jpyToIdrRate)?historyPayload.jpyToIdrRate:110;
          if(observation){
            const currency=observation.currency.toUpperCase();
            const exactEstimate=currency==='JPY'?Math.round(observation.amount*rate):currency==='IDR'?observation.amount:null;
            if(applyEstimate(exactEstimate))return;
          }
        }
      }catch(error){if(error instanceof DOMException&&error.name==='AbortError')return;}
    })().finally(()=>{if(active)setMarketEstimateLoading(false);});
    return()=>{active=false;controller.abort();};
  },[open,hasSelectedIdentity,targetLanguage,targetPrinting?.id]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    if (formIssues.length) {
      toast.error(formIssues[0]);
      return;
    }
    setBusy(true);

    try {
      const subgradesObj = itemType === 'GRADED' ? {
        Centering: parseFloat(centering) || 10,
        Corners: parseFloat(corners) || 9.5,
        Edges: parseFloat(edges) || 10,
        Surface: parseFloat(surface) || 9.5,
      } : undefined;

      const payload = {
        id: editingItem?.id,
        printingId: targetPrinting.id,
        catalogCard: { ...currentCard, language:targetLanguage, variant:targetPrinting.variant??'Standard', printingCode:targetPrinting.printing_code??currentCard.code, setCode:targetPrinting.set_code??currentCard.setCode, imageUrl:targetPrinting.card_image_url??currentCard.imageUrl },
        type: itemType,
        quantity: itemType === 'GRADED' ? 1 : Number(quantity),
        condition: itemType === 'GRADED' ? 'NM' : condition,
        provider: itemType === 'GRADED' ? provider : null,
        grade: itemType === 'GRADED' ? grade : null,
        certification: itemType === 'GRADED' ? (certification.trim() || 'CERT-' + Math.floor(Math.random() * 899999 + 100000)) : null,
        visibility,
        acquisitionAmount: Math.round(Number(acquisitionCost || 0)),
        currency: 'IDR',
        acquiredAt: acquiredDate ? new Date(acquiredDate).toISOString() : new Date().toISOString(),
        notes,
        subgrades: subgradesObj,
      };

      if (isAnonymous) {
        if (isEditing && editingItem) {
          const changes = {
          ...payload,
            card: { ...currentCard, language:targetLanguage, variant:targetPrinting.variant, setCode:targetPrinting.set_code, imageUrl:targetPrinting.card_image_url || currentCard.imageUrl },
          };
          const movedToRaw = itemType === 'RAW';
          const matching = movedToRaw ? getLocalVaultItems().find(item =>
            item.id !== editingItem.id && item.type === 'RAW' && item.printingId === payload.printingId && item.condition === payload.condition && item.currency === payload.currency
          ) : undefined;
          if (matching) {
            const quantity = matching.quantity + payload.quantity;
            const acquisitionAmount = matching.acquisitionAmount + payload.acquisitionAmount;
            updateLocalVaultItem(matching.id, { quantity, acquisitionAmount, currency: payload.currency, visibility: payload.visibility, acquiredAt: payload.acquiredAt, notes: payload.notes || matching.notes });
            deleteLocalVaultItem(editingItem.id);
          } else {
            updateLocalVaultItem(editingItem.id, changes);
          }
          toast.success(matching
            ? language === 'ID' ? `Kartu digabung ke tumpukan ${currentCard.name}` : `Merged into your ${currentCard.name} stack`
            : language === 'ID' ? `Memperbarui ${currentCard.name} di Vault lokal Anda` : `Updated ${currentCard.name} in your local Vault`);
        } else {
          addLocalVaultItem({
            ...payload,
            card: payload.catalogCard,
          });
          toast.success(
            language === 'ID'
              ? `Menambahkan ${currentCard.name} (${itemType === 'GRADED' ? `${provider} ${grade}` : `${quantity}x ${condition}`}) ke Vault lokal`
              : `Added ${currentCard.name} (${itemType === 'GRADED' ? `${provider} ${grade}` : `${quantity}x ${condition}`}) to local Vault`
          );
        }
        await onSaved();
        onClose();
        return;
      }

      if (isEditing) {
        const result = await api<{mergedInto?:string;quantity?:number}>('/api/collection', payload, 'PATCH');
        toast.success(result.mergedInto
          ? language === 'ID' ? `Kartu digabung ke tumpukan ${currentCard.name}` : `Merged into your ${currentCard.name} stack`
          : `Updated ${currentCard.name} in your Vault`);
      } else {
        await api('/api/collection', payload, 'POST');
        toast.success(`Added ${currentCard.name} (${itemType === 'GRADED' ? `${provider} ${grade}` : `${quantity}x ${condition}`}) to Vault`);
      }

      await onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save to Vault.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 150,
      background: 'rgba(10, 12, 16, 0.75)',
      backdropFilter: 'blur(7px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '680px',
        maxHeight: '92vh',
        overflowY: 'auto',
        borderRadius: '18px',
        background: 'var(--vault-panel)',
        border: '1px solid var(--vault-border)',
        boxShadow: '0 28px 70px rgba(0, 0, 0, 0.3)',
        padding: '28px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <span style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--vault-gold)', textTransform: 'uppercase' }}>
              {isEditing ? 'Curate Archive Item' : 'New Collection Record'}
            </span>
            <h2 style={{ fontFamily: 'var(--display-font, var(--font-sans))', fontSize: '24px', fontWeight: 600, margin: '2px 0 0' }}>
              {isEditing ? `Edit ${editingItem?.card.name}` : 'Add Card to Your Vault'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vault-ink-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        <form noValidate onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Top Card Preview & Selection */}
          <div className="vault-identity-picker">
            <div className="vault-selected-card">
              <div className="vault-selected-card-art"><CardArt card={selectedCardArt} small /></div>
              <div className="vault-selected-card-copy">
                <span>Card identity</span>
                <strong>{currentCard.code} · {currentCard.name}</strong>
                <small>{hasSelectedIdentity ? `${currentCard.rarity || 'Card'} · choose the exact printing below` : 'Search by card name or code to select your card'}</small>
              </div>
              {!isEditing && <button type="button" className="vault-btn vault-btn-secondary" onClick={() => setIdentityPickerOpen(open => !open)}>
                {identityPickerOpen ? 'Close' : 'Change'}
              </button>}
            </div>
            {identityPickerOpen && !isEditing && <div className="vault-identity-search-panel">
              <label className="vault-identity-search"><Search size={16}/><input autoFocus value={cardQuery} onChange={event => setCardQuery(event.target.value)} placeholder="Search by card name or code" /></label>
              {cardQuery.trim().length >= 2 && <div className="vault-identity-results" role="listbox" aria-label="Card identities">
                {identitySearchLoading && <p>Searching cards…</p>}
                {!identitySearchLoading && identityResults.map(card => <button type="button" role="option" aria-selected={hasSelectedIdentity && card.code === selectedCardCode} key={card.id} className={hasSelectedIdentity && card.code === selectedCardCode ? 'selected' : ''} onClick={() => {setSelectedCardCode(card.code);setSelectedIdentity(card);setSelectedPrintingId('');setIdentityConfirmed(true);setIdentityPickerOpen(false);setCardQuery('');}}>
                  <span className="vault-identity-result-art"><CardArt card={card} small /></span><span><b>{card.name}</b><small>{card.code} · {card.rarity || card.type}</small></span>
                </button>)}
                {!identitySearchLoading && !identityResults.length && <p>No matching cards.</p>}
              </div>}
            </div>}
          </div>

          <section className="vault-printing-picker" aria-labelledby="vault-printing-heading">
            <div className="vault-printing-heading-row"><div><label id="vault-printing-heading">Printing &amp; language</label><p>Choose the exact artwork and language you own.</p></div><span>{languagePrintings.length} {languagePrintings.length === 1 ? 'printing' : 'printings'}</span></div>
            {availableLanguages.length > 0 && <div className="vault-language-options" role="group" aria-label="Card language">
              {availableLanguages.map(lang => <button type="button" key={lang} className={cardLanguage === lang ? 'active' : ''} onClick={() => setCardLanguage(lang)}>{lang === 'JP' ? '日本語 · JP' : 'English · EN'}</button>)}
            </div>}
            {selectedPrinting&&<p className="vault-printing-current-selection">{language==='ID'?'Cetakan terpilih:':'Selected printing:'} <strong>{selectedPrinting.language} · {selectedPrinting.variant||'Standard'}</strong>{selectedPrinting.printing_code&&<span> · {selectedPrinting.printing_code}</span>}{selectedPrinting.language!==cardLanguage&&<small>{language==='ID'?` · Menampilkan ${cardLanguage}; pilihan baru diterapkan setelah cetakan dipilih.`:` · Viewing ${cardLanguage}; selection changes only after you choose a printing.`}</small>}</p>}
            <div className="vault-printing-options">
              {languagePrintings.map(printing => {
                const printingCard: Card = {...currentCard,id:printing.id,language:printing.language as 'EN'|'JP',variant:printing.variant??'Standard',setCode:printing.set_code??currentCard.setCode,printingCode:printing.printing_code??currentCard.printingCode,imageUrl:printing.card_image_url??currentCard.imageUrl};
                const selected = printing.id === targetPrinting?.id;
                const printNumber=printing.printing_code?.match(/(?:[_-]p)(\d+)$/i)?.[1];
                const detail=[printing.set_code,currentCard.code,printNumber?`p${printNumber}`:printing.printing_code!==currentCard.code?printing.printing_code:null].filter(Boolean).join(' · ');
                return <button type="button" key={printing.id} className={`vault-printing-option ${selected ? 'selected' : ''}`} aria-pressed={selected} onClick={() => {setSelectedIdentity(currentCard);setSelectedCardCode(currentCard.code);setIdentityConfirmed(true);setSelectedPrintingId(printing.id);setCardLanguage(printing.language as 'EN'|'JP');}}>
                  <span className="vault-printing-option-art"><CardArt card={printingCard} small /></span><span className="vault-printing-option-copy"><b>{printing.variant || 'Standard'}</b><small>{detail || 'Standard printing'}</small></span>{selected && <span className="vault-printing-selected-mark">Selected</span>}
                </button>;
              })}
              {!languagePrintings.length && <p className="vault-printing-empty">{catalogLoading ? 'Loading available printings…' : 'No printings are listed for this language.'}</p>}
            </div>
            {targetLanguage === 'JP' && targetPrinting && <div className="vault-yuyutei-pricing"><p>Japanese market reference</p><CardMarketPanel printingId={targetPrinting.id} printing={{language:targetPrinting.language,setCode:targetPrinting.set_code,printingCode:targetPrinting.printing_code,variant:targetPrinting.variant}} onMarketPrice={onMarketPrice}/></div>}
          </section>

          {/* Format Selector: Raw Card vs Graded Slab */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--vault-ink-secondary)', display: 'block', marginBottom: '6px' }}>
              Format & Grading Type:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                className={`vault-btn ${itemType === 'RAW' ? 'vault-btn-primary' : 'vault-btn-secondary'}`}
                style={{ justifyContent: 'center', height: '40px' }}
                onClick={() => setItemType('RAW')}
              >
                Raw Card
              </button>
              <button
                type="button"
                className={`vault-btn ${itemType === 'GRADED' ? 'vault-btn-primary' : 'vault-btn-secondary'}`}
                style={{ justifyContent: 'center', height: '40px' }}
                onClick={() => setItemType('GRADED')}
              >
                <ShieldCheck size={16} />
                Graded Slab
              </button>
            </div>
          </div>

          {/* Conditional Fields based on RAW vs GRADED */}
          {itemType === 'RAW' ? (
            <div className="vault-condition-quantity">
              <fieldset className="vault-condition-fieldset">
                <legend>Card condition</legend>
                <div className="vault-condition-options" role="radiogroup" aria-label="Card condition">
                  {[
                    {code:'NM',name:'Near Mint',hint:'Like new'},
                    {code:'LP',name:'Lightly Played',hint:'Minor wear'},
                    {code:'MP',name:'Moderately Played',hint:'Visible wear'},
                    {code:'HP',name:'Heavily Played',hint:'Heavy wear'},
                    {code:'DMG',name:'Damaged',hint:'Creases or damage'},
                  ].map(option=><button key={option.code} type="button" role="radio" aria-checked={condition===option.code} className={`vault-condition-option ${condition===option.code?'selected':''}`} onClick={()=>setCondition(option.code)}>
                    <b>{option.code}</b><span>{option.name}</span><small>{option.hint}</small>
                  </button>)}
                </div>
              </fieldset>
              <div className="vault-quantity-field">
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--vault-ink-secondary)', display: 'block', marginBottom: '4px' }}>
                  Quantity:
                </label>
                <input
                  type="number"
                  min="1"
                  max="999"
                  className="vault-select-compact"
                  style={{ width: '100%' }}
                  value={quantity}
                  onChange={e => setQuantity(Number(e.target.value))}
                  aria-invalid={submitAttempted && !quantityValid}
                  aria-describedby={submitAttempted && !quantityValid ? 'vault-quantity-error' : undefined}
                />
                {submitAttempted && !quantityValid && <small id="vault-quantity-error" className="vault-field-error">Use a whole number from 1 to 999.</small>}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--vault-ink-secondary)', display: 'block', marginBottom: '4px' }}>
                    Grading Provider:
                  </label>
                  <select
                    className="vault-select-compact"
                    style={{ width: '100%' }}
                    value={provider}
                    onChange={e => setProvider(e.target.value)}
                  >
                    {GRADING_PROVIDERS.map(p => (
                      <option key={p.id} value={p.shortName}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--vault-ink-secondary)', display: 'block', marginBottom: '4px' }}>
                    Grade:
                  </label>
                  <input
                    type="text"
                    maxLength={20}
                    placeholder="10, 9.5, Pristine 10..."
                    className="vault-select-compact"
                    style={{ width: '100%' }}
                    value={grade}
                    onChange={e => setGrade(e.target.value)}
                    aria-invalid={submitAttempted && !grade.trim()}
                    aria-describedby={submitAttempted && !grade.trim() ? 'vault-grade-error' : undefined}
                  />
                  {submitAttempted && !grade.trim() && <small id="vault-grade-error" className="vault-field-error">Enter the grade printed on the slab label.</small>}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--vault-ink-secondary)', display: 'block', marginBottom: '4px' }}>
                  Certification Number:
                </label>
                <input
                  type="text"
                  maxLength={100}
                  placeholder="e.g. 84920194"
                  className="vault-select-compact"
                  style={{ width: '100%' }}
                  value={certification}
                  onChange={e => setCertification(e.target.value)}
                />
              </div>

              {/* Subgrades row */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--vault-ink-secondary)', display: 'block', marginBottom: '4px' }}>
                  Subgrades (Optional):
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--vault-ink-muted)' }}>Centering</span>
                    <input
                      type="text"
                      className="vault-select-compact"
                      style={{ width: '100%' }}
                      value={centering}
                      onChange={e => setCentering(e.target.value)}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--vault-ink-muted)' }}>Corners</span>
                    <input
                      type="text"
                      className="vault-select-compact"
                      style={{ width: '100%' }}
                      value={corners}
                      onChange={e => setCorners(e.target.value)}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--vault-ink-muted)' }}>Edges</span>
                    <input
                      type="text"
                      className="vault-select-compact"
                      style={{ width: '100%' }}
                      value={edges}
                      onChange={e => setEdges(e.target.value)}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--vault-ink-muted)' }}>Surface</span>
                    <input
                      type="text"
                      className="vault-select-compact"
                      style={{ width: '100%' }}
                      value={surface}
                      onChange={e => setSurface(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actual acquisition cost and observed market reference are separate values. */}
          <div className="vault-cost-market-grid">
            <div className="vault-cost-field">
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--vault-ink-secondary)', display: 'block', marginBottom: '4px' }}>
                {language === 'ID' ? 'Biaya perolehan (IDR)' : 'Acquisition cost (IDR)'}
              </label>
              <input
                type="number"
                min="0"
                placeholder={language === 'ID' ? 'Biaya yang dibayar, dalam rupiah' : 'What you paid, in rupiah'}
                step="1"
                className="vault-select-compact"
                aria-label={language === 'ID' ? 'Biaya perolehan dalam IDR' : 'Acquisition cost in IDR'}
                style={{ width: '100%' }}
                value={acquisitionCost}
                onChange={e => setAcquisitionCost(e.target.value)}
              />
              <span style={{ fontSize: '10px', color: 'var(--vault-ink-muted)' }}>{language === 'ID' ? 'Harga pembelian Anda; hanya terlihat oleh Anda.' : 'Your purchase cost; private to you.'}</span>
            </div>
            <div className="vault-market-reference" aria-live="polite">
              <span className="vault-market-reference-label">{language === 'ID' ? 'Estimasi pasar (IDR)' : 'Market estimate (IDR)'}</span>
              <strong>{!hasMarketReference ? (language === 'ID' ? 'Belum tersedia untuk cetakan EN' : 'Not available for EN printings') : marketEstimateLoading ? (language === 'ID' ? 'Memuat…' : 'Loading…') : marketEstimateIdr !== null ? `Rp ${marketEstimateIdr.toLocaleString('id-ID')}` : (language === 'ID' ? 'Harga cetakan ini belum ditemukan' : 'No price found for this printing')}</strong>
              <small>{!hasMarketReference ? (language === 'ID' ? 'Harga kartu bahasa Inggris belum tersedia.' : 'English pricing is not in the current dataset.') : marketEstimateIdr !== null ? (language === 'ID' ? 'Harga referensi untuk cetakan terpilih.' : 'Reference price for the selected printing.') : (language === 'ID' ? 'Menggunakan data Yuyutei untuk cetakan persis ini.' : 'Uses the exact printing’s saved Yuyutei observations.')}</small>
            </div>
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--vault-ink-secondary)', display: 'block', marginBottom: '4px' }}>
              Acquisition Date:
            </label>
            <input
              type="date"
              className="vault-select-compact"
              style={{ width: '100%' }}
              value={acquiredDate}
              onChange={e => setAcquiredDate(e.target.value)}
            />
          </div>

          {/* Visibility & Notes */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--vault-ink-secondary)', display: 'block', marginBottom: '4px' }}>
              Item Visibility:
            </label>
            <select
              className="vault-select-compact"
              style={{ width: '100%' }}
              value={visibility}
              onChange={e => setVisibility(e.target.value as any)}
            >
              <option value="private">Private (Only you can see this item)</option>
              <option value="public">Public (Visible on your profile & showcase)</option>
            </select>
            <span style={{ fontSize: '10px', color: 'var(--vault-ink-muted)' }}>
              This controls Vault profile visibility; it does not create a listing. Selling requires sign-in and a card saved in your Vault.
            </span>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--vault-ink-secondary)', display: 'block', marginBottom: '4px' }}>
              Collector Notes:
            </label>
            <textarea
              rows={2}
              maxLength={1000}
              placeholder="Provenance, event pull, centering notes, or trade story..."
              className="vault-select-compact"
              style={{ width: '100%', height: 'auto', padding: '8px 10px', resize: 'vertical' }}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* Submit Actions */}
          <div className="vault-submit-area">
            {submitAttempted && formIssues.length > 0 && <div className="vault-submit-issues" role="alert" aria-live="polite">
              <b>Can’t save yet</b><ul>{formIssues.map(issue=><li key={issue}>{issue}</li>)}</ul>
            </div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button
              type="button"
              className="vault-btn vault-btn-secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="vault-btn vault-btn-primary"
              disabled={busy}
            >
              {busy ? 'Saving...' : (isEditing ? 'Save Changes' : 'Add to Vault')}
            </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
