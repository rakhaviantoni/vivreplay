'use client';

import React, {useEffect} from 'react';
import { CheckCircleIcon as CheckCircle, PlusIcon as Plus } from '@phosphor-icons/react';
import { CardArt } from '../card-art';
import { printings, type Card } from '@/packages/card-data/catalog';
import { formatCompactMoney, type CollectionItem } from '@/packages/domain';
import type { EnrichedCollectionItem, VaultCard, VaultPrinting } from '../types';
import { VaultPanelEmpty } from '../vault-panel-empty';
import { VaultSlotMetaIdentity } from '../views/vault-slot-meta-identity';
import { VaultSlabCase } from '../views/vault-slot-slab-plate';
import { LOCAL_SLAB_EXAMPLE_ID_PREFIX, getLocalVaultItems, saveLocalVaultItems } from '../local-vault';
import { toast } from 'sonner';

type SlabExampleCard={game:'one-piece'|'pokemon';card:VaultCard;printing:VaultPrinting};
type CatalogRow={id:string;identity_id?:string;rarity?:string|null;variant?:string|null;set_code?:string|null;set_name?:string|null;printing_code?:string|null;language?:string|null;sub_types?:string[]|string|null;source_payload?:Record<string,unknown>|null;card_image_url?:string|null;tcg_card_identities?:{id?:string;code?:string;name?:string;color?:string;card_type?:string;cost?:number;power?:number;effect_text?:string}|null};

const slabExampleStyles=[
  {provider:'PSA',grade:'10'},
  {provider:'CGC',grade:'PRISTINE 10'},
  {provider:'BGS',grade:'BLACK LABEL 10',subgrades:{Centering:10,Corners:10,Edges:10,Surface:10}},
  {provider:'TAG',grade:'PRISTINE 10'},
  {provider:'EGS',grade:'PRISTINE 10'},
  {provider:'EGS',grade:'10',subgrades:{__labelStyle:'clear'}},
  {provider:'ARS',grade:'10'},
  {provider:'EGS',grade:'10'},
] as const;

function toExampleCard(game:'one-piece'|'pokemon',row:CatalogRow):SlabExampleCard|null{
  const identity=row.tcg_card_identities;
  if(!identity?.id||!identity.code||!identity.name)return null;
  const language=(row.language??'EN').toUpperCase();
  const variant=row.variant??'Standard';
  const setCode=row.set_code??'';
  const printingCode=row.printing_code??identity.code;
  const rarity=row.rarity??'';
  const cardName=identity.name.trim();
  const nameSuffix=` - ${identity.code}`;
  const name=game==='one-piece'&&cardName.toUpperCase().endsWith(nameSuffix.toUpperCase())?cardName.slice(0,-nameSuffix.length).trim():cardName;
  const sourcePayload=row.source_payload??undefined;
  const printing:VaultPrinting={id:row.id,language,variant,printing_code:printingCode,set_code:setCode,set_name:row.set_name??undefined,rarity,card_image_url:row.card_image_url??null,sub_types:row.sub_types??null};
  const card:VaultCard={
    id:identity.id,code:identity.code,name,color:identity.color??'Colorless',type:(identity.card_type??'Character') as Card['type'],cost:Number(identity.cost??0),power:Number(identity.power??0),rarity,art:0,effect:identity.effect_text??'',
    imageUrl:row.card_image_url??undefined,imageSource:'external',setCode,language,variant,printingCode,gameSlug:game,source_payload:sourcePayload,availablePrintings:[printing],
  };
  return {game,card,printing};
}

let localSlabSeedPromise:Promise<void>|null=null;
const LOCAL_SLAB_EXAMPLES_SEEDED_KEY='vivreplay-local-slab-examples-v5';

function hasLoadableArtwork(url:string):Promise<boolean>{
  return new Promise(resolve=>{
    const image=new Image();
    const timeout=window.setTimeout(()=>{image.src='';resolve(false);},8000);
    image.onload=()=>{window.clearTimeout(timeout);resolve(true);};
    image.onerror=()=>{window.clearTimeout(timeout);resolve(false);};
    image.src=url;
  });
}

async function findExampleCard(game:'one-piece'|'pokemon',rows:CatalogRow[]):Promise<SlabExampleCard|null>{
  const candidates=rows.filter(row=>{
    const identity=row.tcg_card_identities;
    if(!identity?.id||!identity.name||!row.card_image_url)return false;
    return true;
  }).slice(0,12);
  for(const row of candidates){
    if(await hasLoadableArtwork(row.card_image_url!))return toExampleCard(game,row);
  }
  return null;
}

export function LocalSlabSeeder({enabled}:{enabled:boolean}){
  useEffect(()=>{
    if(!enabled||typeof window==='undefined'||!['localhost','127.0.0.1'].includes(window.location.hostname))return;
    try{if(window.localStorage.getItem(LOCAL_SLAB_EXAMPLES_SEEDED_KEY))return;}catch{return;}
    if(!localSlabSeedPromise){
      localSlabSeedPromise=(async()=>{
        const examples=await Promise.all((['one-piece','pokemon'] as const).map(async game=>{
          try{
            const response=await fetch(`/api/cards/catalog?game=${game}&language=EN&limit=40&sort=rarity`);
            if(!response.ok)return null;
            const payload=await response.json() as {cards?:CatalogRow[]};
            return findExampleCard(game,payload.cards??[]);
          }catch{return null;}
        }));
        if(examples.some(example=>!example)||examples.length!==2)throw new Error('Both card catalogs are needed to add slab examples.');
        const timestamp=new Date().toISOString();
        const items=examples.flatMap((example,gameIndex)=>example?slabExampleStyles.map((style,index)=>({
          id:`${LOCAL_SLAB_EXAMPLE_ID_PREFIX}${example.game}-${style.provider.toLowerCase()}-${index+1}`,
          printingId:example.printing.id,type:'GRADED' as const,quantity:1,condition:'NM',provider:style.provider,grade:style.grade,
          certification:`${gameIndex===0?'19':'82'}${String(index+1).padStart(5,'0')}`,
          visibility:'private' as const,acquisitionAmount:0,currency:'IDR',acquiredAt:timestamp,notes:null,
          language:example.printing.language,variant:example.printing.variant,printingCode:example.printing.printing_code,setCode:example.printing.set_code,rarity:example.printing.rarity,
          subgrades:{...('subgrades' in style?style.subgrades:{}),...(style.provider==='EGS'&&index===4?{__labelStyle:'standard'}:{})},card:example.card,
        } satisfies CollectionItem)):[]);
        if(items.length!==16)throw new Error('Could not prepare all slab examples.');
        const current=getLocalVaultItems();
        const desiredById=new Map(items.map(item=>[item.id,item]));
        const existingIds=new Set(current.map(item=>item.id));
        const missing=items.filter(item=>!existingIds.has(item.id));
        const repaired=current.map(item=>{
          const desired=desiredById.get(item.id);
          if(!desired)return item;
          return {...item,printingId:desired.printingId,card:desired.card,language:desired.language,variant:desired.variant,printingCode:desired.printingCode,setCode:desired.setCode,rarity:desired.rarity};
        });
        if(missing.length||items.some(item=>!existingIds.has(item.id))||repaired.some((item,index)=>item!==current[index]))saveLocalVaultItems([...repaired,...missing]);
        window.localStorage.setItem(LOCAL_SLAB_EXAMPLES_SEEDED_KEY,'true');
        if(missing.length)toast.success(`Added ${missing.length} slab items to your local Vault`);
        else if(items.some(item=>existingIds.has(item.id)))toast.success('Updated the local slab samples');
      })().catch(error=>{
        console.error('Could not add local slab examples',error);
        toast.error('Could not add slab items to the local Vault. Try reloading.');
      }).finally(()=>{localSlabSeedPromise=null;});
    }
  },[enabled]);
  return null;
}

interface SlabsTabProps {
  slabs: EnrichedCollectionItem[];
  hideValues: boolean;
  onSelectSlab: (slab: EnrichedCollectionItem) => void;
  onAddNewSlab: () => void;
}

export function SlabsTab({ slabs, hideValues, onSelectSlab, onAddNewSlab }: SlabsTabProps) {
  return <section className="vault-slabs-section">
    {slabs.length===0?<VaultPanelEmpty icon={<CheckCircle size={22}/>} title="No graded cards yet" description="Add a slab to keep its grade, certificate, and value details here." action={<button type="button" className="vault-btn vault-btn-primary" onClick={onAddNewSlab}><Plus size={15}/>Add slab</button>}/>:<>
    <header className="vault-slabs-heading">
      <div>
        <h2>Graded cards</h2>
        <p>{slabs.length} {slabs.length === 1 ? 'slab' : 'slabs'}</p>
      </div>
      <button type="button" className="vault-btn vault-btn-secondary" onClick={onAddNewSlab}><Plus size={15}/>Add slab</button>
    </header>

    <div className="vault-slabs-grid">
      {slabs.map(item => {
        const printing = printings.find(candidate => candidate.id === item.printingId);
        const label = [item.language ?? item.card.language ?? printing?.language, printing?.variant].filter(Boolean).join(' ');
        const isVerified = item.verificationStatus === 'provider_verified' || item.verificationStatus === 'platform_verified';

        return <article
          key={item.id}
          className="vault-slot is-slab vault-slab-tab-card"
          onClick={() => onSelectSlab(item)}
          role="button"
          tabIndex={0}
          onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectSlab(item); } }}
        >
          <VaultSlabCase item={item}>
            <div className={`vault-slot-card-stage${item.card.gameSlug === 'pokemon' ? ' is-pokemon' : ''}`}>
              <CardArt card={item.card}/>
            </div>
          </VaultSlabCase>
          <div className="vault-slot-info vault-slab-tab-info">
            <div className="vault-slot-heading-row">
              <h3 className="vault-slot-name">{item.card.name}</h3>
            </div>
            <div className="vault-slot-meta-row">
              <VaultSlotMetaIdentity item={item} printingLabel={label}/>
            </div>
            <div className="vault-slab-tab-value">
              {!hideValues && <span>{item.hasMarketEstimate ? formatCompactMoney(item.estimatedValue, 'IDR') : 'No estimate'}</span>}
              <span className={isVerified ? 'is-verified' : ''}>{isVerified ? 'Verified' : 'Entered by you'}</span>
            </div>
          </div>
        </article>;
      })}
    </div>
    </>}
  </section>;
}
