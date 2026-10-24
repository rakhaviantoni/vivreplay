'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  XIcon as X, 
  ShieldCheckIcon as ShieldCheck, 
  CheckCircleIcon as CheckCircle, 
  StorefrontIcon as Store, 
  PencilSimpleIcon as Edit, 
  ShareNetworkIcon as Share2, 
  EyeIcon as Eye, 
  EyeSlashIcon as EyeOff, 
  CameraIcon as Camera,
  TrendUpIcon as TrendingUp,
  ArrowSquareOutIcon as ExternalLink,
  MagnifyingGlassPlusIcon as ZoomIn
} from '@phosphor-icons/react';
import { CardArt } from '../card-art';
import { VaultSlotSlabPlate } from '../views/vault-slot-slab-plate';
import { VaultSlotMetaIdentity } from '../views/vault-slot-meta-identity';
import { EffectText } from '../../effect-text';
import { PokemonCardText } from '../../pokemon-card-text';
import { printings } from '@/packages/card-data/catalog';
import { formatCompactMoney, GRADING_PROVIDERS } from '@/packages/domain';
import { toast } from 'sonner';
import type { EnrichedCollectionItem } from '../types';

interface SlabDetailModalProps {
  slab: EnrichedCollectionItem | null;
  open: boolean;
  canManagePhotos?: boolean;
  hideValues: boolean;
  preferredCurrency?: string;
  onClose: () => void;
  onEdit: (slab: EnrichedCollectionItem) => void;
  onSell: (slab: EnrichedCollectionItem) => void;
  onToggleHideValues: () => void;
  onShare: (slab: EnrichedCollectionItem) => void;
}

export function SlabDetailModal({
  slab,
  open,
  canManagePhotos=false,
  hideValues,
  preferredCurrency,
  onClose,
  onEdit,
  onSell,
  onToggleHideValues,
  onShare,
}: SlabDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'price_history' | 'population' | 'activity'>('overview');
  const [activePhotoRole, setActivePhotoRole] = useState<'front' | 'back' | 'label' | 'extra'>('front');
  const [isZoomed, setIsZoomed] = useState(false);
  const [slabPhotoData,setSlabPhotoData]=useState<{instanceId:string;photos:Array<{id:string;role:string}>}|null>(null);
  const [photoBusy,setPhotoBusy]=useState(false);
  const [pokemonPrintingData,setPokemonPrintingData]=useState<{printingId:string;source:Record<string,unknown>|null}|null>(null);
  const [estimateRate,setEstimateRate]=useState<{currency:string;rate:number}|null>(null);
  const portalTarget=typeof document==='undefined'?null:document.body;

  useEffect(()=>{
    if(!open||!slab||!canManagePhotos)return;
    const controller=new AbortController();
    void fetch(`/api/photos?instanceId=${encodeURIComponent(slab.id)}`,{signal:controller.signal})
      .then(async response=>{if(!response.ok)throw new Error('Could not load slab photos.');return await response.json() as {photos?:Array<{id:string;role:string}>}})
      .then(result=>{if(!controller.signal.aborted)setSlabPhotoData({instanceId:slab.id,photos:result.photos??[]});})
      .catch(error=>{if(!(error instanceof DOMException&&error.name==='AbortError'))setSlabPhotoData({instanceId:slab.id,photos:[]});});
    return()=>controller.abort();
  },[open,slab?.id,canManagePhotos]);

  useEffect(()=>{
    if(!open||!slab||(slab.card.gameSlug!=='pokemon'&&!/^PK-/i.test(slab.card.code)))return;
    const controller=new AbortController();
    const params=new URLSearchParams({game:'pokemon',language:slab.language||slab.card.language||'EN',ids:slab.printingId});
    void fetch(`/api/cards/catalog?${params}`,{signal:controller.signal})
      .then(async response=>response.ok?await response.json() as {cards?:Array<{id:string;source_payload?:Record<string,unknown>}>}:{cards:[]})
      .then(result=>{if(!controller.signal.aborted){const printing=result.cards?.find(card=>card.id===slab.printingId);setPokemonPrintingData({printingId:slab.printingId,source:printing?.source_payload??slab.card.source_payload??null});}})
      .catch(error=>{if(!(error instanceof DOMException&&error.name==='AbortError'))setPokemonPrintingData({printingId:slab.printingId,source:slab.card.source_payload??null});});
    return()=>controller.abort();
  },[open,slab]);

  const estimateCurrency=preferredCurrency&&/^(IDR|USD|JPY)$/.test(preferredCurrency)?preferredCurrency:'IDR';
  useEffect(()=>{
    if(estimateCurrency==='IDR')return;
    let active=true;
    void fetch(`https://api.frankfurter.dev/v2/providers/ecb/rate/idr/${estimateCurrency.toLowerCase()}`,{cache:'force-cache'})
      .then(async response=>response.ok?await response.json() as {rate?:number}:{})
      .then(result=>{if(active&&typeof result.rate==='number'&&Number.isFinite(result.rate))setEstimateRate({currency:estimateCurrency,rate:result.rate});})
      .catch(()=>{});
    return()=>{active=false};
  },[estimateCurrency]);

  const formatEstimate=(amountIdr:number)=>{
    if(estimateCurrency==='IDR')return formatCompactMoney(amountIdr,'IDR');
    if(!estimateRate||estimateRate.currency!==estimateCurrency)return formatCompactMoney(amountIdr,'IDR');
    const converted=amountIdr*estimateRate.rate;
    return estimateCurrency==='USD'?formatCompactMoney(Math.round(converted*100),'USD'):formatCompactMoney(Math.round(converted),estimateCurrency);
  };

  if (!open || !slab || !portalTarget) return null;

  const slabPhotos=slabPhotoData?.instanceId===slab.id?slabPhotoData.photos:[];
  const selectedPhotoRole=activePhotoRole==='extra'?'additional':activePhotoRole;
  const activePhoto=slabPhotos.find(photo=>photo.role===selectedPhotoRole);
  const uploadSlabPhoto=async(event:React.ChangeEvent<HTMLInputElement>)=>{
    const file=event.currentTarget.files?.[0];
    event.currentTarget.value='';
    if(!file||!slab)return;
    const form=new FormData();form.set('photo',file);form.set('instanceId',slab.id);form.set('role',selectedPhotoRole);
    setPhotoBusy(true);
    try{
      const response=await fetch('/api/photos',{method:'POST',body:form});
      const result=await response.json() as {id?:string;error?:string};
      if(!response.ok||!result.id)throw new Error(result.error??'Could not upload slab photo.');
      setSlabPhotoData(current=>({instanceId:slab.id,photos:[...(current?.instanceId===slab.id?current.photos:[]),{id:result.id!,role:selectedPhotoRole}]}));
      toast.success(`${activePhotoRole==='extra'?'Additional':activePhotoRole[0].toUpperCase()+activePhotoRole.slice(1)} slab photo uploaded`);
    }catch(error){toast.error(error instanceof Error?error.message:'Could not upload slab photo.');}
    finally{setPhotoBusy(false);}
  };

  const printing = printings.find(p => p.id === slab.printingId);
  const lang = slab.language || slab.card.language || printing?.language || 'EN';
  const variant = slab.variant || slab.card.variant || printing?.variant || '';
  const isPokemon=slab.card.gameSlug==='pokemon'||/^PK-/i.test(slab.card.code);
  const pokemonSource=pokemonPrintingData?.printingId===slab.printingId?pokemonPrintingData.source:slab.card.source_payload??null;
  const subgrades = slab.subgrades;
  const storedProvider=String(slab.provider??'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
  const providerDef = GRADING_PROVIDERS.find(p => [p.id,p.shortName,p.name].some(value=>value.toLowerCase().replace(/[^a-z0-9]/g,'')===storedProvider)||storedProvider==='beckett'&&p.id==='BGS');
  const certificationUrl=slab.certification&&providerDef?.id==='PSA'
    ? `https://www.psacard.com/cert/${encodeURIComponent(slab.certification)}/psa`
    : providerDef?.website;

  // Verification badge details
  const getVerificationBadge = () => {
    switch (slab.verificationStatus) {
      case 'provider_verified':
        return { label: 'Provider Verified', icon: CheckCircle, color: '#4ade80', desc: 'Officially verified with grading company registry' };
      case 'platform_verified':
        return { label: 'Platform Verified', icon: CheckCircle, color: '#38bdf8', desc: 'Inspected and approved by VivrePlay authenticated vault' };
      case 'failed':
        return { label: 'Verification Failed', icon: X, color: '#ef4444', desc: 'Certification numbers do not match public registry' };
      case 'unavailable':
        return { label: 'Verification Unavailable', icon: ShieldCheck, color: '#94a3b8', desc: 'Grading provider does not have an open verification API' };
      default:
        return null;
    }
  };

  const vBadge = getVerificationBadge();
  const VIcon = vBadge?.icon;

  return createPortal((
    <div className="vault-slab-detail-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }} style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1200,
      background: 'var(--vault-modal-overlay)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div className="vault-detail-modal vault-slab-detail-modal" role="dialog" aria-modal="true" aria-label={`${slab.card.name} slab details`} style={{
        width: '100%',
        maxWidth: '920px',
        maxHeight: 'calc(100dvh - 40px)',
        overflow: 'hidden',
        borderRadius: '20px',
        background: 'var(--vault-panel)',
        border: '1px solid var(--vault-border)',
        boxShadow: 'var(--vault-modal-shadow)',
        color: 'var(--vault-ink)',
        position: 'relative',
      }}>
        <button type="button" className="vault-modal-close" onClick={onClose} aria-label="Close slab details">
          <X size={22} />
        </button>
        <div className="vault-slab-detail-scroll">
        {/* Top Bar with Title & Close */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.12em', color: 'var(--vault-gold)' }}>
                {slab.provider || 'PSA'} {slab.grade || '10'}
              </span>
              {vBadge&&VIcon&&<span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '10px',
                fontWeight: 700,
                color: vBadge.color,
                background: 'var(--vault-surface-warm)',
                padding: '2px 8px',
                borderRadius: '12px',
                border: `1px solid ${vBadge.color}40`,
              }}>
                <VIcon size={12} weight="fill" />
                {vBadge.label}
              </span>}
            </div>
            <h2 style={{ fontFamily: 'var(--display-font, var(--font-sans))', fontSize: '28px', fontWeight: 600, margin: '4px 0 0', color: 'var(--vault-ink)' }}>
              {slab.card.name}
            </h2>
            <div className="vault-slab-detail-card-meta">
              {isPokemon
                ? <VaultSlotMetaIdentity item={slab} printingLabel="" />
                : <span className="vault-slot-meta-identity">
                    <b>{slab.card.code}</b>
                    <span>{lang}</span>
                    {variant && variant.toLowerCase() !== 'standard' && <span>{variant}</span>}
                    <span>{slab.card.rarity}</span>
                  </span>}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="vault-btn vault-btn-secondary"
              style={{ background: 'var(--vault-surface-warm)', borderColor: 'var(--vault-border)', color: 'var(--vault-ink)', height: '34px' }}
              onClick={onToggleHideValues}
              title={hideValues ? 'Show values' : 'Hide values'}
            >
              {hideValues ? <EyeOff size={15} /> : <Eye size={15} />}
              {hideValues ? 'Value Hidden' : 'Hide Value'}
            </button>
          </div>
        </div>

        {/* Desktop Split Layout: Left Large Slab Photo & Gallery, Right Info & Tabs */}
        <div className="vault-slab-detail-layout" style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 340px) 1fr',
          gap: '32px',
          alignItems: 'flex-start',
        }}>
          {/* Left: Slab Presentation Stage & Photo Gallery */}
          <div>
            <div className="vault-slab-case">
              {!activePhoto&&<VaultSlotSlabPlate item={slab} />}

              {/* Artwork Viewport with Zoom Option */}
              <div className="vault-detail-art" style={{ position: 'relative', aspectRatio: '420 / 580', borderRadius: '17px', overflow: 'hidden', cursor: 'zoom-in', background: 'var(--vault-surface-warm)' }} onClick={() => setIsZoomed(!isZoomed)}>
                {activePhoto?<img src={`/api/photos/${activePhoto.id}`} alt={`${activePhotoRole} photo for ${slab.card.name} slab`} style={{width:'100%',height:'100%',objectFit:'contain'}}/>:activePhotoRole==='front'?<CardArt card={slab.card}/>:<div className="vault-slab-photo-empty">{photoBusy?'Uploading photo…':`No ${activePhotoRole} photo attached yet`}</div>}
                <button
                  type="button"
                  className="vault-slab-zoom-button"
                  style={{position:'absolute',bottom:'8px',right:'8px'}}
                  title="Zoom artwork"
                >
                  <ZoomIn size={14} />
                </button>
              </div>
            </div>

            {/* Slab Multi-Photo Switcher (Front, Back, Label, Extra) */}
            <div className="vault-slab-photo-switch" role="group" aria-label="Slab photos" style={{
              display: 'flex',
              gap: '6px',
              marginTop: '12px',
              justifyContent: 'center',
            }}>
              {(['front', 'back', 'label', 'extra'] as const).map(role => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setActivePhotoRole(role)}
                  aria-pressed={activePhotoRole===role}
                  className={`vault-slab-photo-role${activePhotoRole===role?' is-active':''}`}
                >
                  <span>{role==='extra'?'Extra':role[0].toUpperCase()+role.slice(1)}</span>
                  {slabPhotos.some(photo=>photo.role===(role==='extra'?'additional':role))&&<CheckCircle size={14} weight="fill" aria-label="Photo added"/>}
                </button>
              ))}
            </div>

            {/* Attach front, back, label, and detail photos to this slab. */}
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              {canManagePhotos ? <>
              <label style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                color: 'var(--vault-ink-secondary)',
                cursor: 'pointer',
                background: 'var(--vault-surface-warm)',
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid var(--vault-border)',
              }}>
                <Camera size={15} />
                {photoBusy? 'Uploading…' : `Add ${activePhotoRole==='extra'?'additional':activePhotoRole} photo`}
                <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={photoBusy||slabPhotos.length>=8} onChange={uploadSlabPhoto} style={{ display: 'none' }} />
              </label>
              <small className="vault-slab-photo-help">{slabPhotos.length}/8 photos · JPEG, PNG or WebP · max 5 MB</small>
              </> : <small className="vault-slab-photo-help">Sign in to attach slab photos.</small>}
            </div>
          </div>

          {/* Right: Slab Details, Tabs & Valuation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Top Financial Valuation Summary */}
            <div style={{
              padding: '16px',
              borderRadius: '12px',
              background: 'var(--vault-surface-warm)',
              border: '1px solid var(--vault-border)',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
            }}>
              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--vault-ink-muted)' }}>
                  Acquired Cost
                </span>
                <div style={{ fontFamily: 'var(--display-font, var(--font-sans))', fontSize: '18px', fontWeight: 600, color: 'var(--vault-ink)', marginTop: '2px' }}>
                  {hideValues ? '••••••••' : slab.acquisitionAmount > 0 ? formatCompactMoney(slab.acquisitionAmount, slab.currency || 'IDR') : '-'}
                </div>
                <small style={{ fontSize: '10px', color: 'var(--vault-ink-muted)' }}>{slab.acquiredAt ? new Date(slab.acquiredAt).toLocaleDateString() : 'Date not recorded'}</small>
              </div>

              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--vault-ink-muted)' }}>
                  Market estimate{slab.hasMarketEstimate&&estimateCurrency!=='IDR'?` (${estimateRate?.currency===estimateCurrency?estimateCurrency:'IDR'})`:''}
                </span>
                <div style={{ fontFamily: 'var(--display-font, var(--font-sans))', fontSize: '18px', fontWeight: 600, color: 'var(--vault-gold)', marginTop: '2px' }}>
                  {hideValues ? '••••••••' : slab.hasMarketEstimate ? formatEstimate(slab.estimatedValue) : 'No graded price data'}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--vault-ink-muted)' }}>
                  Unrealized Gain
                </span>
                <div style={{
                  fontFamily: 'var(--display-font, var(--font-sans))',
                  fontSize: '18px',
                  fontWeight: 600,
                  color: 'var(--vault-gold)',
                  marginTop: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  {hideValues ? '••••••••' : slab.hasMarketEstimate && slab.acquisitionAmount > 0 ? (
                    <>
                      <TrendingUp size={16} />
                      {slab.gainLossAmount >= 0 ? '+' : ''}{formatEstimate(slab.gainLossAmount)}
                    </>
                  ) : '-'}
                </div>
                <small style={{ fontSize: '10px', color: 'var(--vault-ink-muted)' }}>
                  {hideValues ? 'Hidden' : slab.hasMarketEstimate && slab.acquisitionAmount > 0 ? `${slab.gainLossPercent >= 0 ? '+' : ''}${slab.gainLossPercent.toFixed(1)}%` : 'No comparable market price'}
                </small>
              </div>
            </div>

            {/* Subgrades Breakdown if Provider Supports Them */}
            {subgrades && typeof subgrades === 'object' && Object.keys(subgrades).length > 0 && (
              <div style={{
                padding: '14px 16px',
                borderRadius: '12px',
                background: 'var(--vault-surface-warm)',
                border: '1px solid var(--vault-border)',
              }}>
                  <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--vault-ink-muted)', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
                  Subgrades Inspection
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                  {Object.entries(subgrades).map(([key, val]) => (
                    <div key={key} style={{ padding: '8px', background: 'var(--vault-panel)', borderRadius: '8px', border: '1px solid var(--vault-border)', textAlign: 'center' }}>
                      <span style={{ fontSize: '9px', color: 'var(--vault-ink-muted)', display: 'block', textTransform: 'uppercase' }}>{key}</span>
                      <strong style={{ fontFamily: 'var(--display-font, var(--font-sans))', fontSize: '16px', color: 'var(--vault-gold)' }}>
                        {String(val)}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tabs Selector: Overview | Price History | Population | Activity */}
            <div className="vault-slab-tabs" role="tablist" aria-label="Slab details">
              {(['overview', 'price_history', 'population', 'activity'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  id={`vault-slab-tab-${tab}`}
                  role="tab"
                  aria-selected={activeTab===tab}
                  aria-controls={`vault-slab-panel-${tab}`}
                  tabIndex={activeTab===tab?0:-1}
                  onKeyDown={event=>{
                    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
                    event.preventDefault();
                    const tabs=Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')??[]);
                    const current=tabs.indexOf(event.currentTarget);
                    const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(current+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
                    const nextTab=tabs[next];
                    nextTab?.focus();
                    const tabName=nextTab?.id.replace('vault-slab-tab-','') as typeof activeTab|undefined;
                    if(tabName)setActiveTab(tabName);
                  }}
                  className={`vault-slab-tab${activeTab===tab?' is-active':''}`}
                >
                  {tab==='price_history'?'Price history':tab==='population'?'Population':tab==='activity'?'Activity':'Overview'}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            {activeTab === 'overview' && (
              <div className="vault-slab-panel" id="vault-slab-panel-overview" role="tabpanel" aria-labelledby="vault-slab-tab-overview" tabIndex={0}>
                <div className="vault-slab-panel-section">
                  {isPokemon
                    ? pokemonSource
                      ? <PokemonCardText code={slab.card.code} name={slab.card.name} language={lang} source={pokemonSource as Parameters<typeof PokemonCardText>[0]['source']}/>
                      : <p>Card details are not available.</p>
                    : <><h3>Card effect</h3><p>{slab.card.effect ? <EffectText text={slab.card.effect}/> : 'No effect text available.'}</p></>}
                </div>
                {slab.notes && (
                  <div className="vault-slab-panel-section">
                    <h3>Your notes</h3>
                    <p>{slab.notes}</p>
                  </div>
                )}
                {certificationUrl && slab.certification && (
                  <a className="vault-slab-panel-link"
                    href={certificationUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {providerDef?.id==='PSA'?'View PSA certificate, sales & population':'Open grading company site'} <ExternalLink size={13} />
                  </a>
                )}
              </div>
            )}

            {activeTab === 'price_history' && (
              <div className="vault-slab-panel" id="vault-slab-panel-price_history" role="tabpanel" aria-labelledby="vault-slab-tab-price_history" tabIndex={0}>
                <div className="vault-slab-panel-section"><h3>Sales history</h3><p>No graded sales recorded in Vault.</p></div>
                {providerDef?.id==='PSA'&&certificationUrl&&<a className="vault-slab-panel-link" href={certificationUrl} target="_blank" rel="noreferrer">View PSA sales for this certificate <ExternalLink size={13}/></a>}
                <p className="vault-slab-panel-note">Raw card prices are not used to estimate graded cards.</p>
              </div>
            )}

            {activeTab === 'population' && (
              <div className="vault-slab-panel" id="vault-slab-panel-population" role="tabpanel" aria-labelledby="vault-slab-tab-population" tabIndex={0}>
                <div className="vault-slab-panel-section"><h3>Population</h3>
                  {providerDef?.id==='PSA'&&certificationUrl?<p>See the grading company’s report for this card.</p>:<p>Check the grading company’s certificate page for current population data.</p>}
                </div>
                {providerDef?.id==='PSA'&&certificationUrl&&<a className="vault-slab-panel-link" href={certificationUrl} target="_blank" rel="noreferrer">View PSA population for this certificate <ExternalLink size={13}/></a>}
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="vault-slab-panel" id="vault-slab-panel-activity" role="tabpanel" aria-labelledby="vault-slab-tab-activity" tabIndex={0}>
                <div className="vault-slab-panel-section"><h3>Vault activity</h3>
                  <p>{slab.acquiredAt ? `Added ${new Date(slab.acquiredAt).toLocaleDateString()}.` : 'Added date not recorded.'}</p>
                </div>
                {slab.certification && providerDef?.website && <p>Certificate {slab.certification}</p>}
                {slab.notes && <div>{slab.notes}</div>}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '16px' }}>
              <button
                type="button"
                className="vault-btn vault-btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => onShare(slab)}
              >
                <Share2 size={15} />
                Share Slab Card
              </button>
              <button
                type="button"
                className="vault-btn vault-btn-secondary"
                style={{ background: 'var(--vault-surface-warm)', borderColor: 'var(--vault-border)', color: 'var(--vault-ink)' }}
                onClick={() => onSell(slab)}
              >
                <Store size={15} />
                List for Sale
              </button>
              <button
                type="button"
                className="vault-btn vault-btn-secondary"
                style={{ background: 'var(--vault-surface-warm)', borderColor: 'var(--vault-border)', color: 'var(--vault-ink)' }}
                onClick={() => onEdit(slab)}
              >
                <Edit size={15} />
                Edit
              </button>
        </div>
        </div>
        </div>
      </div>
      </div>
    </div>
  ),portalTarget);
}
