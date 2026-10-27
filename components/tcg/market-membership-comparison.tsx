'use client';

import {MarketServiceFeeInfo} from '@/components/tcg/market-buyer-fee-cap-table';

type BundleLimits={maxListingCopies:number;maxCopiesPerCard:number;maxCardTypes:number};
export function MarketMembershipComparison({locale,selectedPeriod,freeListings,monthlyListings,annualListings,freeDays,proDays,freeBundle,monthlyBundle,annualBundle,freeProductStock=10,monthlyProductStock=50,annualProductStock=99,freeFee,proFee,buyerMinimum,sellerMinimum,monthlyVouchers,annualVouchers,loading=false}:{locale:'EN'|'ID';selectedPeriod:'monthly'|'yearly';freeListings:number;monthlyListings:number;annualListings:number;freeDays:number;proDays:number;freeBundle:BundleLimits;monthlyBundle:BundleLimits;annualBundle:BundleLimits;freeProductStock?:number;monthlyProductStock?:number;annualProductStock?:number;freeFee:number;proFee:number;buyerMinimum:number;sellerMinimum:number;monthlyVouchers:number;annualVouchers:number;loading?:boolean}){
  const id=locale==='ID';
  const t=(en:string,ind:string)=>id?ind:en;
  const format=(value:number)=>value.toLocaleString(id?'id-ID':'en-US');
  const bundleLabel=(limits:BundleLimits)=>`${format(limits.maxListingCopies)} ${t('cards total','kartu total')}, ${format(limits.maxCopiesPerCard)} ${t('per card','per kartu')}`;
  const selectedIsAnnual=selectedPeriod==='yearly';
  const proLabel=selectedIsAnnual?t('Pro annual','Pro tahunan'):t('Pro monthly','Pro bulanan');
  const selectedListings=selectedIsAnnual?annualListings:monthlyListings;
  const selectedBundle=selectedIsAnnual?annualBundle:monthlyBundle;
  const selectedProductStock=selectedIsAnnual?annualProductStock:monthlyProductStock;
  const selectedVoucher=selectedIsAnnual?`${annualVouchers} / ${t('year, use any time','tahun, bebas digunakan')}`:`${monthlyVouchers} / ${t('month','bulan')}`;
  const rows=[
    [t('Active listings','Listing aktif'),format(freeListings),format(selectedListings)],
    [t('Cards in a bundle','Kartu dalam satu bundel'),bundleLabel(freeBundle),bundleLabel(selectedBundle)],
    [t('Product stock','Stok produk'),`${t('Up to','Maksimal')} ${format(freeProductStock)} ${t('units per listing','unit per listing')}`,`${t('Up to','Maksimal')} ${format(selectedProductStock)} ${t('units per listing','unit per listing')}`],
    [t('Listing period','Masa tayang'),`${freeDays} ${t('days','hari')}`,`${proDays} ${t('days','hari')}`],
    [t('Market service fee','Biaya layanan Market'),`${freeFee}%`,`${proFee}%`],
    [t('Delivery vouchers','Voucher ongkir'),t('None','Tidak ada'),selectedVoucher],
  ];
  return <div className="market-membership-compare market-membership-compare-wide" aria-label={t('Free and Market Pro comparison','Perbandingan Free dan Market Pro')}>
    <table className="market-pro-dialog-table" aria-busy={loading}><thead><tr><th>{t('Benefit','Manfaat')}</th><th>Free</th><th>{proLabel}</th></tr></thead><tbody>{rows.map(([label,free,selected])=><tr key={label}><th scope="row">{label==='Market service fee'?<span className="buyer-fee-row-label">{label}<MarketServiceFeeInfo locale={id?'id':'en'} freePercent={freeFee} proPercent={proFee} buyerMinimum={buyerMinimum} sellerMinimum={sellerMinimum}/></span>:label}</th><td>{loading?<i className="market-pro-cell-skeleton" aria-hidden="true"/>:free}</td><td>{loading?<i className="market-pro-cell-skeleton is-pro" aria-hidden="true"/>:selected}</td></tr>)}</tbody></table>
  </div>;
}
