import { db, errorResponse } from '@/lib/server/store';
import { isCurrentUserAdmin } from '@/lib/server/admin-auth';

type RawOrderRow = {
  id: string;
  kind: string;
  status: string;
  subtotal: number;
  shipping_fee: number;
  amount: number;
  currency: string;
  details: string | null;
  shipping_status: string | null;
  shipping_waybill_id: string | null;
  shipping_tracking_url: string | null;
  paid_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  fulfilled_at: string | null;
  created_at: string;
  listing_id: string | null;
  listing_title: string | null;
  buyer_name: string | null;
  buyer_username: string | null;
  seller_name: string | null;
  seller_username: string | null;
};

function parseTimestampMs(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const iso = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function diffHours(startRaw: string | null | undefined, endRaw: string | null | undefined): number | null {
  const start = parseTimestampMs(startRaw);
  const end = parseTimestampMs(endRaw);
  if (start === null || end === null || end < start) return null;
  return Math.round(((end - start) / (60 * 60 * 1000)) * 10) / 10;
}

function parseOrderDetails(raw: string | null): {
  courier: string | null;
  service: string | null;
  paymentMethod: string | null;
} {
  if (!raw) return { courier: null, service: null, paymentMethod: null };
  try {
    const parsed = JSON.parse(raw) as {
      courier?: { company?: string; name?: string; service?: string; type?: string };
      shipping?: { courier?: string; courierName?: string; service?: string; serviceName?: string };
      paymentMethod?: string;
      channel?: string;
    };
    const courier =
      parsed.courier?.company ||
      parsed.courier?.name ||
      parsed.shipping?.courier ||
      parsed.shipping?.courierName ||
      null;
    const service =
      parsed.courier?.service ||
      parsed.courier?.type ||
      parsed.shipping?.service ||
      parsed.shipping?.serviceName ||
      null;
    const paymentMethod = parsed.paymentMethod || parsed.channel || null;
    return {
      courier: courier ? String(courier).toUpperCase() : null,
      service: service ? String(service) : null,
      paymentMethod: paymentMethod ? String(paymentMethod) : null,
    };
  } catch {
    return { courier: null, service: null, paymentMethod: null };
  }
}

export async function GET() {
  if (!(await isCurrentUserAdmin())) {
    return Response.json({ error: 'Admin access is required.' }, { status: 403 });
  }

  try {
    const database = db();
    const res = await database
      .prepare(
        `SELECT o.id, o.kind, o.status, o.subtotal, o.shipping_fee, o.amount, o.currency,
                o.details, o.shipping_status, o.shipping_waybill_id, o.shipping_tracking_url,
                o.paid_at, o.dispatched_at, o.delivered_at, o.fulfilled_at, o.created_at,
                o.listing_id, l.title AS listing_title,
                bp.display_name AS buyer_name, bp.username AS buyer_username,
                sp.display_name AS seller_name, sp.username AS seller_username
         FROM checkout_orders o
         LEFT JOIN listings l ON l.id = o.listing_id
         LEFT JOIN profiles bp ON bp.id = o.buyer_id
         LEFT JOIN profiles sp ON sp.id = o.seller_id
         WHERE o.kind = 'MARKET'
         ORDER BY o.created_at DESC
         LIMIT 300`,
      )
      .all<RawOrderRow>();

    const orders = (res.results ?? []).map((row) => {
      const meta = parseOrderDetails(row.details);
      const hoursToShip = diffHours(row.paid_at, row.dispatched_at);
      const hoursToDeliver = diffHours(row.dispatched_at, row.delivered_at);
      const hoursTotal = diffHours(row.paid_at, row.delivered_at ?? row.fulfilled_at);

      return {
        id: row.id,
        status: row.status,
        subtotal: row.subtotal,
        shippingFee: row.shipping_fee,
        amount: row.amount,
        currency: row.currency,
        courier: meta.courier,
        service: meta.service,
        paymentMethod: meta.paymentMethod,
        shippingStatus: row.shipping_status,
        waybill: row.shipping_waybill_id,
        trackingUrl: row.shipping_tracking_url,
        paidAt: row.paid_at,
        dispatchedAt: row.dispatched_at,
        deliveredAt: row.delivered_at,
        fulfilledAt: row.fulfilled_at,
        createdAt: row.created_at,
        listingId: row.listing_id,
        listingTitle: row.listing_title,
        buyerName: row.buyer_name,
        buyerUsername: row.buyer_username,
        sellerName: row.seller_name,
        sellerUsername: row.seller_username,
        hoursToShip,
        hoursToDeliver,
        hoursTotal,
      };
    });

    return Response.json({ orders }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
