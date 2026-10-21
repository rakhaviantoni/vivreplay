import type {EnrichedCollectionItem} from '../types';

export function VaultSlotSlabPlate({item}:{item:EnrichedCollectionItem}){
  const isPsa=(item.provider||'PSA').toUpperCase()==='PSA';
  return <div className={`vault-slab-plate vault-slot-slab-plate${isPsa?' is-psa':''}`} aria-label={`${item.provider||'PSA'} grade ${item.grade||'10'}, certificate ${item.certification||'unverified'}`}>
    {isPsa?<div className="vault-slot-psa-label">
      <div className="vault-slot-psa-top"><span>{item.card.setCode||'TRADING CARD'}</span><b>{item.card.code}</b></div>
      <div className="vault-slot-psa-name"><strong>{item.card.name}</strong><b>{item.grade||'10'}</b></div>
      <div className="vault-slot-psa-cert"><span><b>P<span>S</span>A</b> CERT</span><strong>{item.certification?String(item.certification).slice(0,14):'UNVERIFIED'}</strong></div>
    </div>:<><div className="vault-slab-plate-left"><span className="vault-slab-provider">{item.provider}</span><span className="vault-slab-grade-num">{item.grade||'10'}</span></div><span className="vault-slab-cert-pill">#{item.certification?String(item.certification).slice(0,10):'UNVERIFIED'}</span></>}
  </div>;
}
