import {
  MARKET_BUYER_FEE_CAP_BANDS,
  MARKET_BUYER_FEE_MINIMUM,
  MARKET_SELLER_FEE_MINIMUM,
  MARKET_BUYER_FEE_PERCENT,
  MARKET_PRO_BUYER_FEE_PERCENT,
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
  const minimum=policies.buyerFeeMinimum??MARKET_BUYER_FEE_MINIMUM;
  const sellerMinimum=policies.sellerFeeMinimum??MARKET_SELLER_FEE_MINIMUM;
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
    ? `Biaya pembeli sebesar ${percent(MARKET_BUYER_FEE_PERCENT)}% untuk Free atau ${percent(MARKET_PRO_BUYER_FEE_PERCENT)}% untuk Pro, dengan minimum Rp${money(minimum,true)} dan batas sesuai subtotal kartu: ${caps}. Biaya penjual ${percent(policies.free.commissionPercent)}% untuk Free atau ${percent(policies.pro.commissionPercent)}% untuk Pro, minimal Rp${money(sellerMinimum,true)} dan tidak melebihi subtotal kartu. Ongkir ditampilkan terpisah sebelum pembayaran.`
    : `Buyer fees are ${percent(MARKET_BUYER_FEE_PERCENT)}% for Free or ${percent(MARKET_PRO_BUYER_FEE_PERCENT)}% for Pro, with a Rp${money(minimum,false)} minimum and card-subtotal caps: ${caps}. Seller fees are ${percent(policies.free.commissionPercent)}% for Free or ${percent(policies.pro.commissionPercent)}% for Pro, with a Rp${money(sellerMinimum,false)} minimum that cannot exceed the card subtotal. Delivery is shown separately before payment.`;
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
