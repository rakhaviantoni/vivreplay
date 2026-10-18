import {
  MARKET_BUYER_FEE_CAP_BANDS,
  MARKET_PRO_SHIPPING_VOUCHER_CAP,
  MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL,
  MARKET_PRO_SHIPPING_VOUCHER_SHARE,
  MARKET_PRO_SHIPPING_VOUCHERS_PER_MONTH,
  MARKET_PRO_SHIPPING_VOUCHERS_PER_YEAR,
  type ListingTierPolicy,
} from './policy';

type Policies = {free: ListingTierPolicy; pro: ListingTierPolicy; buyerFeeMinimum?:number; sellerFeeMinimum?:number; shippingVoucherMinSubtotal?:number};

function money(amount: number, id: boolean) {
  return new Intl.NumberFormat(id ? 'id-ID' : 'en-US', {maximumFractionDigits: 0}).format(amount);
}

function percent(value: number) {
  return Number.isInteger(value) ? String(value) : String(value).replace(/0+$/, '').replace(/\.$/, '');
}

export function marketFeeDisclosure(policies: Policies, id: boolean) {
  const caps = MARKET_BUYER_FEE_CAP_BANDS.map((band, index) => {
    const cap = `Rp${money(band.cap, id)}`;
    if (index === 0) return id ? `${cap} hingga Rp${money(band.maxSubtotal, true)}` : `${cap} up to Rp${money(band.maxSubtotal, false)}`;
    if (index === MARKET_BUYER_FEE_CAP_BANDS.length - 1) return id ? `${cap} di atas Rp${money(MARKET_BUYER_FEE_CAP_BANDS[index - 1].maxSubtotal, true)}` : `${cap} above Rp${money(MARKET_BUYER_FEE_CAP_BANDS[index - 1].maxSubtotal, false)}`;
    const previous = MARKET_BUYER_FEE_CAP_BANDS[index - 1].maxSubtotal;
    return id
      ? `${cap} di atas Rp${money(previous, true)} hingga Rp${money(band.maxSubtotal, true)}`
      : `${cap} above Rp${money(previous, false)} through Rp${money(band.maxSubtotal, false)}`;
  }).join('; ');
  return id
    ? `Biaya layanan Market adalah biaya VivrePlay, terpisah dari MDR QRIS. Biaya sebesar ${percent(policies.free.commissionPercent)}% untuk Free dan ${percent(policies.pro.commissionPercent)}% untuk Pro, dengan minimum Rp${money(policies.buyerFeeMinimum??2_000,true)} untuk pembeli dan Rp${money(policies.sellerFeeMinimum??1_000,true)} untuk penjual. Batas biaya pembeli mengikuti subtotal berikut: ${caps}. Biaya penjual tidak melebihi subtotal kartu. Ongkir dan biaya pembayaran ditampilkan terpisah saat checkout.`
    : `The Market service fee is VivrePlay’s fee and is separate from QRIS MDR. The rate is ${percent(policies.free.commissionPercent)}% on Free and ${percent(policies.pro.commissionPercent)}% on Pro, with a minimum of IDR ${money(policies.buyerFeeMinimum??2_000,false)} for buyers and IDR ${money(policies.sellerFeeMinimum??1_000,false)} for sellers. Buyer fees follow these subtotal caps: ${caps}. Seller fees never exceed the card subtotal. Delivery and payment charges appear separately at checkout.`;
}

export function marketProShippingDisclosure(id: boolean, policies?:Policies) {
  const monthlyCount = MARKET_PRO_SHIPPING_VOUCHERS_PER_MONTH;
  const annualCount = MARKET_PRO_SHIPPING_VOUCHERS_PER_YEAR;
  const cap = `Rp${money(MARKET_PRO_SHIPPING_VOUCHER_CAP, id)}`;
  const minimum = `Rp${money(policies?.shippingVoucherMinSubtotal??MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL, id)}`;
  const share = `${Math.round(MARKET_PRO_SHIPPING_VOUCHER_SHARE * 100)}%`;
  return id
    ? `Satu paket Market Pro berlaku untuk aktivitas membeli dan menjual. Paket bulanan mendapat ${monthlyCount} voucher ongkir setiap bulan; voucher bulanan yang tidak dipakai akan kedaluwarsa pada akhir bulan. Pro+ tahunan mendapat ${annualCount} voucher untuk masa aktif 365 hari. Voucher tahunan dapat dipakai kapan saja selama masa aktif dan sisanya kedaluwarsa saat masa aktif berakhir. Setiap voucher memotong ${share} ongkir, maksimal ${cap}, untuk pesanan dengan subtotal kartu minimal ${minimum}.`
    : `One Market Pro plan covers both buying and selling. Monthly Pro includes ${monthlyCount} delivery vouchers each calendar month; unused monthly vouchers expire at month end. Annual Pro+ includes ${annualCount} vouchers for its 365-day term. Use them at any time during the term; unused vouchers expire when the membership ends. Each voucher takes ${share} off delivery, up to ${cap}, on orders with a card subtotal of at least ${minimum}.`;
}
