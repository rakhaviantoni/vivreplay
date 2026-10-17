import {
  MARKET_BUYER_FEE_CAP_BANDS,
  MARKET_PRO_SHIPPING_VOUCHER_CAP,
  MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL,
  MARKET_PRO_SHIPPING_VOUCHER_SHARE,
  MARKET_PRO_SHIPPING_VOUCHERS_PER_MONTH,
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
  const count = MARKET_PRO_SHIPPING_VOUCHERS_PER_MONTH;
  const cap = `Rp${money(MARKET_PRO_SHIPPING_VOUCHER_CAP, id)}`;
  const minimum = `Rp${money(policies?.shippingVoucherMinSubtotal??MARKET_PRO_SHIPPING_VOUCHER_MIN_SUBTOTAL, id)}`;
  const share = `${Math.round(MARKET_PRO_SHIPPING_VOUCHER_SHARE * 100)}%`;
  return id
    ? `Satu langganan Market Pro berlaku untuk aktivitas membeli dan menjual pada akun yang sama. Harga dan masa aktif ditampilkan saat checkout. Manfaat saat ini mencakup biaya layanan yang lebih rendah, batas listing lebih tinggi, masa listing lebih panjang, dan ${count} voucher ongkir per bulan. Setiap voucher memotong ${share} ongkir, maksimal ${cap}, untuk pesanan dengan subtotal kartu minimal ${minimum}. Voucher yang tidak dipakai tidak dibawa ke bulan berikutnya.`
    : `One Market Pro membership covers buying and selling on the same account. The price and term appear at checkout. Current benefits include lower service fees, higher listing limits, longer listing periods, and ${count} monthly shipping vouchers. Each voucher takes ${share} off delivery, up to ${cap}, on orders with a card subtotal of at least ${minimum}. Unused vouchers do not roll over.`;
}
