'use client';

import {ArrowUpRightIcon} from '@phosphor-icons/react';
import {findSetProduct} from '@/lib/one-piece-products';
import './set-product-overview.css';

const cleanFact=(text:string)=>text.replace(/[・·]/g, ', ').replace(/[.。]$/, '');

export function SetProductOverview({code,id,language}:{code:string;id:boolean;language:string}) {
  const product=findSetProduct(code,language);
  if(!product)return null;
  const facts=Object.fromEntries(Object.entries(product.facts).filter((entry):entry is [string,string]=>typeof entry[1]==='string'));
  const labels:Record<string,string>=id?{'Release Date':'Tanggal rilis','MSRP':'Harga resmi','Contents':'Isi','Rarity':'Raritas'}:{'MSRP':'Retail price'};
  return <section className="set-product-overview" aria-labelledby="set-product-title">
    <h2 id="set-product-title" className="sr-only">{id?'Detail produk':'Product details'}</h2>
    <div className="set-product-details"><dl>{Object.entries(facts).filter(([key])=>['Release Date','MSRP','Contents'].includes(key)).map(([key,value])=><div className={key==='Contents'?'set-product-contents':undefined} key={key}><dt>{labels[key]??key}</dt><dd>{cleanFact(value)}</dd></div>)}</dl><div className="set-product-more">{facts.Rarity&&<details><summary>{id?'Rincian raritas':'Rarity breakdown'}</summary><p>{cleanFact(facts.Rarity)}</p></details>}<a href={product.sourceUrl} target="_blank" rel="noreferrer">{id?'Produk resmi':'Official product'} <ArrowUpRightIcon size={14}/></a></div></div>
  </section>;
}

export function SetProductArtwork({code,id,language}:{code:string;id:boolean;language:string}){
  const product=findSetProduct(code,language);
  if(!product)return null;
  const images=product.images as {pack?:string;box?:string};
  const deck=/^(ST|SD|LD)/.test(product.code);
  return <div className={`set-product-images${images.box?' has-box':''}`}>
    {images.pack&&<figure><img src={images.pack} alt={`${product.code} ${deck?'starter deck':'booster pack'}`}/><figcaption>{deck?'Starter deck':(id?'Paket booster':'Booster pack')}</figcaption></figure>}
    {images.box&&<figure><img src={images.box} alt={`${product.code} ${deck?'product contents':'booster box'}`}/><figcaption>{deck?(id?'Isi produk':'Product contents'):(id?'Boks booster':'Booster box')}</figcaption></figure>}
  </div>;
}

