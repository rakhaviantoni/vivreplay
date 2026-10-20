'use client';

import {MarketServiceFeeInfo} from '@/components/tcg/market-buyer-fee-cap-table';
import {MARKET_MAX_COPIES_PER_CARD,MARKET_MAX_LISTING_COPIES} from '@/lib/market/listing-limits';

export function MarketMembershipComparison({locale,period,freeListings,proListings,freeDays,proDays,freeFee,proFee,buyerMinimum,sellerMinimum,monthlyVouchers,annualVouchers,loading=false}:{locale:'EN'|'ID';period:'monthly'|'yearly';freeListings:number;proListings:number;freeDays:number;proDays:number;freeFee:number;proFee:number;buyerMinimum:number;sellerMinimum:number;monthlyVouchers:number;annualVouchers:number;loading?:boolean}){
  const id=locale==='ID';
  const t=(en:string,ind:string)=>id?ind:en;
  const rows=[
    [t('Active listings','Listing aktif'),freeListings.toLocaleString(id?'id-ID':'en-US'),proListings.toLocaleString(id?'id-ID':'en-US')],
    [t('Listing period','Masa tayang'),`${freeDays} ${t('days','hari')}`,`${proDays} ${t('days','hari')}`],
    [t('Cards per listing','Kartu per listing'),`${MARKET_MAX_LISTING_COPIES} ${t('total','total')}, ${MARKET_MAX_COPIES_PER_CARD} ${t('per card','per kartu')}`,`${MARKET_MAX_LISTING_COPIES} ${t('total','total')}, ${MARKET_MAX_COPIES_PER_CARD} ${t('per card','per kartu')}`],
    [t('Market service fee','Biaya layanan Market'),`${freeFee}%`,`${proFee}%`],
    [t('Delivery vouchers','Voucher ongkir'),t('None','Tidak ada'),period==='yearly'?`${annualVouchers} / ${t('year, use any time','tahun, bebas digunakan')}`:`${monthlyVouchers} / ${t('month','bulan')}`],
  ];
  return <div className="market-membership-compare market-membership-compare-wide" aria-label={t('Free and Market Pro comparison','Perbandingan Free dan Market Pro')}>
    <table className="market-pro-dialog-table" aria-busy={loading}><thead><tr><th>{t('Benefit','Manfaat')}</th><th>Free</th><th>{period==='yearly'?t('Market Pro Annual','Market Pro Tahunan'):'Market Pro'}</th></tr></thead><tbody>{rows.map(([label,free,pro])=><tr key={label}><th scope="row">{label==='Market service fee'?<span className="buyer-fee-row-label">{label}<MarketServiceFeeInfo locale={id?'id':'en'} freePercent={freeFee} proPercent={proFee} buyerMinimum={buyerMinimum} sellerMinimum={sellerMinimum}/></span>:label}</th>{[free,pro].map((value,index)=><td key={index}>{loading?<i className={`market-pro-cell-skeleton${index===1?' is-pro':''}`} aria-hidden="true"/>:value}</td>)}</tr>)}</tbody></table>
  </div>;
}
