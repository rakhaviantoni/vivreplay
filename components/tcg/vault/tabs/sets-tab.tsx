'use client';

import React, { useEffect, useState } from 'react';
import { CardPreviewModal } from '../../card-preview-modal';
import { 
  TrophyIcon as Trophy, 
  ShareNetworkIcon as Share2, 
  StorefrontIcon as Store, 
  ArrowLeftIcon as ArrowLeft,
  CheckCircleIcon as CheckCircle,
  EyeIcon as Eye,
  SparkleIcon as Sparkles
} from '@phosphor-icons/react';
import { CardArt } from '../card-art';
import type { Card } from '@/packages/card-data/catalog';
import type { SetProgress, EnrichedCollectionItem } from '../types';
import {versionedCardCatalogUrl} from '@/lib/card-catalog-cache';

interface SetsTabProps {
  language: 'EN'|'ID';
  progressList: SetProgress[];
  items: EnrichedCollectionItem[];
  onShareProgress: (set: SetProgress) => void;
  onFindMissingInMarket: (setCode: string) => void;
  onSelectItem: (item: EnrichedCollectionItem) => void;
  wishlistSetCodes?: string[];
}
type SetRow={code:string;name:string;releaseYear:number;mainSetTotal:number;parallelsTotal:number};

export function SetsTab({
  language,
  progressList,
  items,
  onShareProgress,
  onFindMissingInMarket,
  onSelectItem,
  wishlistSetCodes = [],
}: SetsTabProps) {
  const id=language==='ID';
  const t=(en:string,indo:string)=>id?indo:en;
  const [activeSetCode, setActiveSetCode] = useState<string | null>(null);
  const [filterMissingOnly, setFilterMissingOnly] = useState(false);
  const [variantFilter, setVariantFilter] = useState<'all' | 'standard' | 'parallel'>('all');
  const [catalogCards,setCatalogCards]=useState<Card[]>([]);
  const [catalogLoading,setCatalogLoading]=useState(false);
  const [catalogError,setCatalogError]=useState(false);
  const [catalogAttempt,setCatalogAttempt]=useState(0);
  const [catalogSets,setCatalogSets]=useState<SetRow[]>([]);
  const [showAllSets,setShowAllSets]=useState(false);
  const [preview,setPreview]=useState<Card|null>(null);

  useEffect(()=>{let active=true;fetch(versionedCardCatalogUrl('/api/cards/sets')).then(response=>{if(!response.ok)throw new Error('Set catalog unavailable');return response.json() as Promise<{sets?:SetRow[]}>}).then(result=>{if(active&&result.sets?.length)setCatalogSets(result.sets)}).catch(()=>{});return()=>{active=false}},[]);

  const allProgressList=React.useMemo(()=>{
    const source=catalogSets.length?catalogSets:progressList.map(set=>({code:set.code,name:set.name,releaseYear:set.releaseYear,mainSetTotal:set.mainSetTotal,parallelsTotal:set.parallelsTotal}));
    return source.map(set=>{
      const normalized=set.code.toUpperCase().replace(/[-_\s]/g,'');
      const owned=items.filter(item=>(item.setCode||item.card.setCode||'').toUpperCase().replace(/[-_\s]/g,'')===normalized);
      const mainOwned=new Set(owned.map(item=>item.card.code)).size;
      const parallelOwned=new Set(owned.filter(item=>/parallel|manga|alt/i.test(item.variant||item.card.variant||'')).map(item=>item.card.code)).size;
      const percentage=set.mainSetTotal?Math.min(100,Number((mainOwned/set.mainSetTotal*100).toFixed(1))):0;
      return{code:set.code,name:set.name,releaseYear:set.releaseYear,totalCards:set.mainSetTotal,ownedCount:mainOwned,percentage,mainSetOwned:mainOwned,mainSetTotal:set.mainSetTotal,parallelsOwned:parallelOwned,parallelsTotal:set.parallelsTotal,isComplete:percentage>=100};
    });
  },[catalogSets,progressList,items]);

  useEffect(()=>{
    if(!activeSetCode)return;
    const controller=new AbortController();
    setCatalogLoading(true);setCatalogError(false);setCatalogCards([]);
    fetch(versionedCardCatalogUrl(`/api/cards/catalog?language=EN&set=${encodeURIComponent(activeSetCode)}`),{signal:controller.signal})
      .then(response=>{if(!response.ok)throw new Error('catalog unavailable');return response.json() as Promise<{cards?:Array<Record<string,unknown>>}>})
      .then(payload=>{
        if(controller.signal.aborted)return;
        const normalized=activeSetCode.toUpperCase().replace(/[-_\s]/g,'');
        const rows=(payload.cards??[]).filter(row=>String(row.set_code??'').toUpperCase().replace(/[-_\s]/g,'')===normalized);
        const mapped=rows.flatMap((row,index)=>{
          const identity=row.tcg_card_identities as Record<string,unknown>|null;
          if(!identity)return[];
          return [{id:String(row.id),code:String(identity.code??''),name:String(identity.name??identity.code??''),color:String(identity.color??''),type:(String(identity.card_type??'Character') as Card['type']),cost:Number(identity.cost??0),power:Number(identity.power??0),rarity:String(row.rarity??''),art:index%6,effect:String(identity.effect_text??''),imageUrl:String(row.card_image_url??'')||undefined,imageSource:'external' as const,setCode:String(row.set_code??''),language:String(row.language??'EN'),printingCode:String(row.printing_code??identity.code??''),variant:String(row.variant??'Standard')}];
        });
        mapped.sort((a,b)=>Number(!/^(standard|base)$/i.test(a.variant??''))-Number(!/^(standard|base)$/i.test(b.variant??''))||a.code.localeCompare(b.code));
        setCatalogCards([...new Map(mapped.map(card=>[card.code,card])).values()]);
      })
      .catch(()=>{if(!controller.signal.aborted)setCatalogError(true)})
      .finally(()=>{if(!controller.signal.aborted)setCatalogLoading(false)});
    return()=>controller.abort();
  },[activeSetCode,catalogAttempt]);

  const selectedSet = allProgressList.find(s => s.code === activeSetCode);

  if (activeSetCode && selectedSet) {
    // Collect all cards associated with this set code
    const setAllCards = catalogCards;
    
    // Determine which are owned
    const ownedMap = new Map<string, EnrichedCollectionItem>();
    items.forEach(item => {
      const itemSet=(item.setCode||item.card.setCode||'').toUpperCase().replace(/[-_\s]/g,'');
      if (itemSet === activeSetCode.toUpperCase().replace(/[-_\s]/g,'')) {
        ownedMap.set(item.card.code, item);
      }
    });

    const displayCards = setAllCards.filter(c => {
      const isOwned = ownedMap.has(c.code);
      if (filterMissingOnly && isOwned) return false;
      return true;
    });

    return (
      <div>
        {/* Back and Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <button
            type="button"
            className="vault-btn vault-btn-secondary"
            onClick={() => setActiveSetCode(null)}
          >
            <ArrowLeft size={16} />
            {t('All Sets','Semua set')}
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="vault-btn vault-btn-secondary"
              onClick={() => onShareProgress(selectedSet)}
            >
              <Share2 size={15} />
              {t('Share Progress','Bagikan progres')}
            </button>
            <button
              type="button"
              className="vault-btn vault-btn-primary"
              onClick={() => onFindMissingInMarket(selectedSet.code)}
            >
              <Store size={15} />
              {t('Find Missing Cards','Cari kartu yang belum dimiliki')}
            </button>
          </div>
        </div>

        {/* Set Header Card */}
        <div className="vault-set-card" style={{ marginBottom: '24px' }}>
          <div className="vault-set-header">
            <div>
              <span className="vault-set-code">{selectedSet.code}</span>
              <h2 className="vault-set-title">{selectedSet.name}</h2>
              <p style={{ fontSize: '12px', color: 'var(--vault-ink-secondary)', margin: '4px 0 0' }}>
                {t('Browse every card in this set. Cards in your collection are marked.','Lihat semua kartu dalam set ini. Kartu yang sudah ada di koleksi akan ditandai.')}
              </p>
            </div>
            <span className="vault-set-percent">{selectedSet.percentage}%</span>
          </div>

          <div className="vault-set-progress-track">
            <div className="vault-set-progress-bar" style={{ width: `${selectedSet.percentage}%` }} />
          </div>

          <div className="vault-set-stats-row">
            <span>{t('Main set','Kartu utama')}: <b>{selectedSet.mainSetOwned} / {selectedSet.mainSetTotal}</b></span>
            <span>{t('Parallels','Kartu paralel')}: <b>{selectedSet.parallelsOwned} / {selectedSet.parallelsTotal}</b></span>
            <span>{t('Master set','Set lengkap')}: <b>{Math.min(100, Math.round(((selectedSet.mainSetOwned + selectedSet.parallelsOwned) / (selectedSet.mainSetTotal + selectedSet.parallelsTotal)) * 100))}%</b></span>
          </div>
        </div>

        {/* Completion Milestone Moment (Restrained Archival Banner) */}
        {selectedSet.isComplete && (
          <div className="vault-completion-banner">
            <div className="vault-completion-banner-text">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Trophy size={20} color="var(--vault-gold)" weight="fill" />
                <h3>{t('Set complete:','Set selesai dikoleksi:')} {selectedSet.code}</h3>
              </div>
              <p>
                {t(`You have all ${selectedSet.mainSetTotal} main-set cards from ${selectedSet.name}.`,`Semua ${selectedSet.mainSetTotal} kartu utama ${selectedSet.name} sudah ada di koleksi Anda.`)}
              </p>
            </div>
            <button
              type="button"
              className="vault-btn vault-btn-primary"
              onClick={() => onShareProgress(selectedSet)}
            >
              <Share2 size={15} />
              {t('Share milestone','Bagikan pencapaian')}
            </button>
          </div>
        )}

        {/* Filter bar for Set View */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className={`vault-btn vault-btn-secondary ${!filterMissingOnly ? 'is-active' : ''}`}
              onClick={() => setFilterMissingOnly(false)}
            >
              {t(`All cards (${setAllCards.length})`,`Semua kartu (${setAllCards.length})`)}
            </button>
            <button
              type="button"
              className={`vault-btn vault-btn-secondary ${filterMissingOnly ? 'is-active' : ''}`}
              onClick={() => setFilterMissingOnly(true)}
            >
              {t(`Missing (${Math.max(0, setAllCards.length - ownedMap.size)})`,`Belum dimiliki (${Math.max(0, setAllCards.length - ownedMap.size)})`)}
            </button>
          </div>
          <span style={{ fontSize: '11.5px', color: 'var(--vault-ink-muted)' }}>
            {catalogLoading?t('Loading cards…','Memuat kartu…'):catalogError?<>{t('Cards could not load.','Kartu gagal dimuat.')} <button type="button" className="vault-btn vault-btn-secondary" onClick={()=>setCatalogAttempt(value=>value+1)}>{t('Try again','Coba lagi')}</button></>:t(`Showing ${displayCards.length} cards in release order`,`Menampilkan ${displayCards.length} kartu sesuai urutan rilis`)}
          </span>
        </div>

        {/* Official Set Sequence Grid */}
        {!catalogLoading&&!catalogError&&displayCards.length===0&&<p role="status" className="vault-set-empty">{t('No cards are available for this set yet.','Kartu untuk set ini belum tersedia.')}</p>}
        <div className="vault-set-inspect-grid">
          {!catalogLoading&&!catalogError&&displayCards.map(card => {
            const ownedItem = ownedMap.get(card.code);
            const isOwned = Boolean(ownedItem);

            return (
              <div
                key={card.id}
                className={`vault-set-item-slot ${!isOwned ? 'is-missing' : ''}`}
                onClick={() => {
                  if (ownedItem) {
                    onSelectItem(ownedItem);
                  } else setPreview(card);
                }}
                role="button"
                tabIndex={0}
                style={{ cursor: 'pointer' }}
                onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();if(ownedItem)onSelectItem(ownedItem);else setPreview(card)}}}
                title={isOwned ? `${card.name} (Owned)` : `${card.name} (Missing · Click to find listings)`}
              >
                <div className="vault-slot-card-stage">
                  <CardArt card={card} />
                </div>
                <div style={{ padding: '2px 4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--vault-ink-muted)' }}>
                    <span>{card.code}</span>
                    <span>{card.rarity}</span>
                  </div>
                  <strong style={{ fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', color: 'var(--vault-ink)' }}>
                    {card.name}
                  </strong>
                </div>
              </div>
            );
          })}
        </div>
        {preview&&<CardPreviewModal card={preview} language="EN" cards={setAllCards} onClose={()=>setPreview(null)} onNavigate={setPreview}/>}
      </div>
    );
  }

  const activeCodes=new Set([
    ...items.map(item=>item.setCode||item.card.setCode||'').filter(Boolean).map(code=>code.toUpperCase().replace(/[-_\s]/g,'')),
    ...wishlistSetCodes.map(code=>code.toUpperCase().replace(/[-_\s]/g,'')),
  ]);
  const activeSets=allProgressList.filter(set=>activeCodes.has(set.code.toUpperCase().replace(/[-_\s]/g,'')));
  const shownSets=showAllSets?allProgressList:activeSets;

  return (
    <div>
      <div className="vault-sets-heading">
        <div>
          <h2>{t('Set progress','Progres set')}</h2>
          <p>{showAllSets?t('Browse every supported set.','Lihat semua set yang tersedia.'):t('Sets with cards in your Vault or Wishlist.','Set yang memiliki kartu di Koleksi atau Wishlist.')}</p>
        </div>
        <div className="vault-sets-switch" role="group" aria-label={t('Set list','Daftar set')}>
          <button type="button" className={!showAllSets?'is-active':''} aria-pressed={!showAllSets} onClick={()=>setShowAllSets(false)}>{t('Your sets','Set Anda')} <span>{activeSets.length}</span></button>
          <button type="button" className={showAllSets?'is-active':''} aria-pressed={showAllSets} onClick={()=>setShowAllSets(true)}>{t('All sets','Semua set')} <span>{allProgressList.length}</span></button>
        </div>
      </div>

      <div className="vault-sets-overview">
        {!shownSets.length&&<div className="vault-sets-empty"><p>{t('Your Vault and Wishlist do not have cards from a supported set yet.','Koleksi dan Wishlist Anda belum berisi kartu dari set yang tersedia.')}</p><button type="button" className="vault-btn vault-btn-secondary" onClick={()=>setShowAllSets(true)}>{t('Browse all sets','Lihat semua set')}</button></div>}
        {shownSets.map(set => (
          <div key={set.code} className="vault-set-card">
            <div className="vault-set-header">
              <div>
                <span className="vault-set-code">{set.code}</span>
                <h3 className="vault-set-title">{set.name}</h3>
                {set.releaseYear>0&&<span style={{ fontSize: '11px', color: 'var(--vault-ink-muted)' }}>{t('Released','Dirilis')} {set.releaseYear}</span>}
              </div>
              <span className="vault-set-percent">{set.percentage}%</span>
            </div>

            <div className="vault-set-progress-track">
              <div className="vault-set-progress-bar" style={{ width: `${set.percentage}%` }} />
            </div>

            <div className="vault-set-stats-row">
              <span>{t('Main set','Kartu utama')}: <b>{set.mainSetOwned} / {set.mainSetTotal}</b></span>
              <span>{t('Parallels','Kartu paralel')}: <b>{set.parallelsOwned} / {set.parallelsTotal}</b></span>
            </div>

            <div className="vault-set-actions">
              <button
                type="button"
                className="vault-btn vault-btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setActiveSetCode(set.code)}
              >
                {t('View set cards','Lihat kartu set')}
              </button>
              <button
                type="button"
                className="vault-btn vault-btn-secondary"
                onClick={() => onFindMissingInMarket(set.code)}
                title="Find missing cards on market"
              >
                <Store size={14} />
              </button>
              <button
                type="button"
                className="vault-btn vault-btn-secondary"
                onClick={() => onShareProgress(set)}
                title="Share set progress"
              >
                <Share2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
