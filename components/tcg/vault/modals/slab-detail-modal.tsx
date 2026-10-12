'use client';

import React, { useEffect, useState } from 'react';
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
import { EffectText } from '../../effect-text';
import { printings } from '@/packages/card-data/catalog';
import { formatCompactMoney, GRADING_PROVIDERS } from '@/packages/domain';
import { toast } from 'sonner';
import type { EnrichedCollectionItem } from '../types';

interface SlabDetailModalProps {
  slab: EnrichedCollectionItem | null;
  open: boolean;
  canManagePhotos?: boolean;
  hideValues: boolean;
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
  onClose,
  onEdit,
  onSell,
  onToggleHideValues,
  onShare,
}: SlabDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'price_history' | 'population' | 'activity'>('overview');
  const [activePhotoRole, setActivePhotoRole] = useState<'front' | 'back' | 'label' | 'extra'>('front');
  const [isZoomed, setIsZoomed] = useState(false);
  const [slabPhotos,setSlabPhotos]=useState<Array<{id:string;role:string}>>([]);
  const [photoBusy,setPhotoBusy]=useState(false);

  useEffect(()=>{
    if(!open||!slab||!canManagePhotos)return;
    const controller=new AbortController();
    setSlabPhotos([]);
    void fetch(`/api/photos?instanceId=${encodeURIComponent(slab.id)}`,{signal:controller.signal})
      .then(async response=>{if(!response.ok)throw new Error('Could not load slab photos.');return await response.json() as {photos?:Array<{id:string;role:string}>}})
      .then(result=>{if(!controller.signal.aborted)setSlabPhotos(result.photos??[]);})
      .catch(error=>{if(!(error instanceof DOMException&&error.name==='AbortError'))setSlabPhotos([]);});
    return()=>controller.abort();
  },[open,slab?.id,canManagePhotos]);

  if (!open || !slab) return null;

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
      setSlabPhotos(current=>[...current,{id:result.id!,role:selectedPhotoRole}]);
      toast.success(`${activePhotoRole==='extra'?'Additional':activePhotoRole[0].toUpperCase()+activePhotoRole.slice(1)} slab photo uploaded`);
    }catch(error){toast.error(error instanceof Error?error.message:'Could not upload slab photo.');}
    finally{setPhotoBusy(false);}
  };

  const printing = printings.find(p => p.id === slab.printingId);
  const lang = slab.language || slab.card.language || printing?.language || 'EN';
  const variant = slab.variant || slab.card.variant || printing?.variant || 'Standard';
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
        return { label: 'User Entered', icon: ShieldCheck, color: 'var(--vault-gold)', desc: 'Certification entered by owner; registry verification pending' };
    }
  };

  const vBadge = getVerificationBadge();
  const VIcon = vBadge.icon;

  return (
    <div className="vault-slab-detail-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }} style={{
      position: 'fixed',
      inset: 0,
      zIndex: 150,
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
                {slab.provider || 'PSA'} {slab.grade || '10'} · AUTHENTICATED SLAB
              </span>
              <span style={{
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
              </span>
            </div>
            <h2 style={{ fontFamily: 'var(--display-font, var(--font-sans))', fontSize: '28px', fontWeight: 600, margin: '4px 0 0', color: 'var(--vault-ink)' }}>
              {slab.card.name}
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--vault-ink-muted)', marginTop: '2px' }}>
              {slab.card.code} · {lang} · {variant} · {slab.card.rarity}
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
            <div className="vault-slab-case" style={{
              position: 'relative',
              borderRadius: '14px',
              background: 'var(--vault-surface-warm)',
              border: '2px solid var(--vault-border)',
              boxShadow: 'var(--vault-case-shadow)',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
            }}>
              {/* Slab Label Plate */}
              <div className="vault-slab-case-plate" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'var(--vault-panel)',
                border: '1px solid var(--vault-border)',
                marginBottom: '10px',
              }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--vault-gold)', letterSpacing: '0.08em' }}>
                    {slab.provider || 'PSA'}
                  </span>
                  <div style={{ fontFamily: 'var(--display-font, var(--font-sans))', fontSize: '18px', fontWeight: 700, color: 'var(--vault-ink)' }}>
                    {slab.grade || '10'}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '9px', color: 'var(--vault-ink-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Certification
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', color: 'var(--vault-ink-secondary)', fontWeight: 600 }}>
                    #{slab.certification || '84920194'}
                  </span>
                </div>
              </div>

              {/* Artwork Viewport with Zoom Option */}
              <div className="vault-detail-art" style={{ position: 'relative', aspectRatio: '420 / 580', borderRadius: '8px', overflow: 'hidden', cursor: 'zoom-in', background: 'var(--vault-surface-warm)' }} onClick={() => setIsZoomed(!isZoomed)}>
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
            <div className="vault-slab-photo-switch" style={{
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
                  className={`vault-slab-photo-role${activePhotoRole===role?' is-active':''}`}
                >
                  {role}{slabPhotos.some(photo=>photo.role===(role==='extra'?'additional':role))?' · ✓':''}
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
                  {hideValues ? '••••••••' : slab.acquisitionAmount > 0 ? formatCompactMoney(slab.acquisitionAmount, 'IDR') : '-'}
                </div>
                <small style={{ fontSize: '10px', color: 'var(--vault-ink-muted)' }}>{slab.acquiredAt ? new Date(slab.acquiredAt).toLocaleDateString() : 'Date not recorded'}</small>
              </div>

              <div>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--vault-ink-muted)' }}>
                  Est. Market Value
                </span>
                <div style={{ fontFamily: 'var(--display-font, var(--font-sans))', fontSize: '18px', fontWeight: 600, color: 'var(--vault-gold)', marginTop: '2px' }}>
                  {hideValues ? '••••••••' : slab.hasMarketEstimate ? formatCompactMoney(slab.estimatedValue, 'IDR') : 'Not available'}
                </div>
                <small style={{ fontSize: '10px', color: 'var(--vault-ink-muted)' }}>No graded price available</small>
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
                      {slab.gainLossAmount >= 0 ? '+' : ''}{formatCompactMoney(slab.gainLossAmount, 'IDR')}
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
            <div className="vault-slab-tabs">
              {(['overview', 'price_history', 'population', 'activity'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`vault-slab-tab${activeTab===tab?' is-active':''}`}
                >
                  {tab.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            {activeTab === 'overview' && (
              <div style={{ fontSize: '12px', color: 'var(--vault-ink-secondary)', lineHeight: 1.6 }}>
                <p style={{ margin: '0 0 10px' }}>
                  <strong>Card Effect:</strong> {slab.card.effect ? <EffectText text={slab.card.effect}/> : 'No effect text available.'}
                </p>
                {slab.notes && (
                  <p style={{ margin: '0 0 10px', fontStyle: 'italic', color: 'var(--vault-ink-muted)' }}>
                    <strong>Collector Notes:</strong> &ldquo;{slab.notes}&rdquo;
                  </p>
                )}
                {certificationUrl && slab.certification && (
                  <a
                    href={certificationUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--vault-gold)', fontSize: '11.5px', textDecoration: 'none', fontWeight: 600 }}
                  >
                    {providerDef?.id==='PSA'?'View PSA certificate, sales & population':'Open grading company site'} <ExternalLink size={13} />
                  </a>
                )}
              </div>
            )}

            {activeTab === 'price_history' && (
              <div style={{ fontSize: '12px', color: 'var(--vault-ink-secondary)' }}>
                <strong>No graded sales history in Vault yet.</strong>
                {providerDef?.id==='PSA'&&certificationUrl&&<p><a href={certificationUrl} target="_blank" rel="noreferrer" style={{color:'var(--vault-gold)'}}>View PSA sales for this certificate <ExternalLink size={13}/></a></p>}
                <p style={{ color: 'var(--vault-ink-muted)' }}>Raw card prices are not used to estimate graded cards.</p>
              </div>
            )}

            {activeTab === 'population' && (
              <div style={{ fontSize: '12px', color: 'var(--vault-ink-secondary)' }}>
                <span style={{ fontSize: '11px', color: 'var(--vault-ink-muted)', display: 'block', marginBottom: '8px' }}>
                  Population report
                </span>
                {providerDef?.id==='PSA'&&certificationUrl?<p><a href={certificationUrl} target="_blank" rel="noreferrer" style={{color:'var(--vault-gold)'}}>View PSA population for this certificate <ExternalLink size={13}/></a></p>:<p style={{ color: 'var(--vault-ink-muted)' }}>Open the grading company’s certificate page to check its current population data.</p>}
              </div>
            )}

            {activeTab === 'activity' && (
              <div style={{ fontSize: '11.5px', color: 'var(--vault-ink-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>{slab.acquiredAt ? `Added to Vault on ${new Date(slab.acquiredAt).toLocaleDateString()}.` : 'Added date is not recorded.'}</div>
                {slab.certification && providerDef?.website && <div>Certification: {slab.certification}</div>}
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
  );
}
