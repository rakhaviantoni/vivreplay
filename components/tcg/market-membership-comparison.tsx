'use client';

import {MarketServiceFeeInfo} from '@/components/tcg/market-buyer-fee-cap-table';
import {MARKET_MAX_COPIES_PER_CARD,MARKET_MAX_LISTING_COPIES} from '@/lib/market/listing-limits';

export function MarketMembershipComparison({locale,freeListings,proListings,freeDays,proDays,freeFee,proFee,buyerMinimum,sellerMinimum,monthlyVouchers,annualVouchers,loading=false}:{locale:'EN'|'ID';freeListings:number;proListings:number;freeDays:number;proDays:number;freeFee:number;proFee:number;buyerMinimum:number;sellerMinimum:number;monthlyVouchers:number;annualVouchers:number;loading?:boolean}){
  const id=locale==='ID';
  const t=(en:string,ind:string)=>id?ind:en;
  const rows=[
    [t('Active listings','Listing aktif'),freeListings.toLocaleString(id?'id-ID':'en-US'),proListings.toLocaleString(id?'id-ID':'en-US'),proListings.toLocaleString(id?'id-ID':'en-US')],
    [t('Listing period','Masa tayang'),`${freeDays} ${t('days','hari')}`,`${proDays} ${t('days','hari')}`,`${proDays} ${t('days','hari')}`],
    [t('Cards per listing','Kartu per listing'),`${MARKET_MAX_LISTING_COPIES} ${t('total','total')}, ${MARKET_MAX_COPIES_PER_CARD} ${t('per card','per kartu')}`,`${MARKET_MAX_LISTING_COPIES} ${t('total','total')}, ${MARKET_MAX_COPIES_PER_CARD} ${t('per card','per kartu')}`,`${MARKET_MAX_LISTING_COPIES} ${t('total','total')}, ${MARKET_MAX_COPIES_PER_CARD} ${t('per card','per kartu')}`],
    [t('Market service fee','Biaya layanan Market'),`${freeFee}%`,`${proFee}%`,`${proFee}%`],
    [t('Delivery vouchers','Voucher ongkir'),t('None','Tidak ada'),`${monthlyVouchers} / ${t('month','bulan')}`,`${annualVouchers} ${t('for the year','untuk setahun')}`],
    [t('Membership term','Masa keanggotaan'),t('No membership','Tanpa paket'),t('30 days','30 hari'),t('365 days','365 hari')],
  ];
  return <div className="market-membership-compare market-membership-compare-wide" aria-label={t('Free, Pro, and Pro+ comparison','Perbandingan Free, Pro, dan Pro+')}>
    <table className="market-pro-dialog-table" aria-busy={loading}><thead><tr><th>{t('Benefit','Manfaat')}</th><th>Free</th><th>Pro</th><th>Pro+</th></tr></thead><tbody>{rows.map(([label,free,pro,proPlus])=><tr key={label}><th scope="row">{label==='Market service fee'?<span className="buyer-fee-row-label">{label}<MarketServiceFeeInfo locale={id?'id':'en'} freePercent={freeFee} proPercent={proFee} buyerMinimum={buyerMinimum} sellerMinimum={sellerMinimum}/></span>:label}</th>{[free,pro,proPlus].map((value,index)=><td key={index}>{loading?<i className={`market-pro-cell-skeleton${index===2?' is-pro':''}`} aria-hidden="true"/>:value}</td>)}</tr>)}</tbody></table>
  </div>;
}
