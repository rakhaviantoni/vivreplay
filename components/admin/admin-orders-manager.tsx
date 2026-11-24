'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowsClockwiseIcon as Refresh,
  ArrowSquareOutIcon as ExternalLink,
  CheckIcon as Check,
  CopyIcon as Copy,
  PackageIcon as Package,
} from '@phosphor-icons/react';
import { formatMoney } from '@/packages/domain';
import { AdminLoadingSkeleton } from '@/components/admin/admin-loading-skeleton';

type AdminOrder = {
  id: string;
  status: string;
  subtotal: number;
  shippingFee: number;
  amount: number;
  currency: string;
  courier: string | null;
  service: string | null;
  paymentMethod: string | null;
  shippingStatus: string | null;
  waybill: string | null;
  trackingUrl: string | null;
  paidAt: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  fulfilledAt: string | null;
  createdAt: string;
  listingId: string | null;
  listingTitle: string | null;
  buyerName: string | null;
  buyerUsername: string | null;
  sellerName: string | null;
  sellerUsername: string | null;
  hoursToShip: number | null;
  hoursToDeliver: number | null;
  hoursTotal: number | null;
};

function formatDurationHours(hours: number | null): string {
  if (hours === null) return '-';
  if (hours < 24) return `${hours}h`;
  const days = Math.round((hours / 24) * 10) / 10;
  return `${days}d`;
}

function formatDateShort(raw: string | null): string {
  if (!raw) return '-';
  const d = new Date(raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('en-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(d);
}

export function AdminOrdersManager() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [shippingFilter, setShippingFilter] = useState('ALL');
  const [courierFilter, setCourierFilter] = useState('ALL');
  const [slaFilter, setSlaFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'newest' | 'slow-ship' | 'slow-deliver' | 'highest'>('newest');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/orders', { cache: 'no-store' });
      const data = (await res.json()) as { orders?: AdminOrder[]; error?: string };
      if (!res.ok) throw new Error(data.error || 'Could not load orders.');
      setOrders(data.orders ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const couriers = useMemo(
    () =>
      [...new Set(orders.map((o) => o.courier).filter((v): v is string => Boolean(v)))].sort(),
    [orders],
  );

  const shippingStatuses = useMemo(
    () =>
      [...new Set(orders.map((o) => o.shippingStatus).filter((v): v is string => Boolean(v)))].sort(),
    [orders],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = orders.filter((o) => {
      if (q) {
        const hay = `${o.id} ${o.listingTitle ?? ''} ${o.buyerName ?? ''} ${o.buyerUsername ?? ''} ${o.sellerName ?? ''} ${o.sellerUsername ?? ''} ${o.waybill ?? ''} ${o.courier ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
      if (shippingFilter === 'NONE' && o.shippingStatus) return false;
      if (shippingFilter !== 'ALL' && shippingFilter !== 'NONE' && o.shippingStatus !== shippingFilter) {
        return false;
      }
      if (courierFilter !== 'ALL' && (o.courier ?? 'NONE') !== courierFilter) return false;
      if (slaFilter === 'AWAITING_DISPATCH' && !(o.status === 'PAID' && !o.dispatchedAt)) return false;
      if (slaFilter === 'SLOW_SHIP' && !(o.hoursToShip !== null && o.hoursToShip > 48)) return false;
      if (slaFilter === 'SLOW_DELIVER' && !(o.hoursToDeliver !== null && o.hoursToDeliver > 120)) return false;
      if (slaFilter === 'DELIVERED' && !o.deliveredAt) return false;
      return true;
    });

    if (sortBy === 'slow-ship') {
      return [...list].sort((a, b) => (b.hoursToShip ?? -1) - (a.hoursToShip ?? -1));
    }
    if (sortBy === 'slow-deliver') {
      return [...list].sort((a, b) => (b.hoursToDeliver ?? -1) - (a.hoursToDeliver ?? -1));
    }
    if (sortBy === 'highest') {
      return [...list].sort((a, b) => b.amount - a.amount);
    }
    return list;
  }, [orders, query, statusFilter, shippingFilter, courierFilter, slaFilter, sortBy]);

  const kpis = useMemo(() => {
    const shipHours = filtered.map((o) => o.hoursToShip).filter((v): v is number => v !== null);
    const deliverHours = filtered.map((o) => o.hoursToDeliver).filter((v): v is number => v !== null);
    const awaiting = filtered.filter((o) => o.status === 'PAID' && !o.dispatchedAt).length;
    const gmv = filtered
      .filter((o) => ['PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'FULFILLED'].includes(o.status))
      .reduce((sum, o) => sum + o.amount, 0);

    const avgShip = shipHours.length
      ? Math.round((shipHours.reduce((a, b) => a + b, 0) / shipHours.length) * 10) / 10
      : null;
    const avgDeliver = deliverHours.length
      ? Math.round((deliverHours.reduce((a, b) => a + b, 0) / deliverHours.length) * 10) / 10
      : null;

    return { count: filtered.length, avgShip, avgDeliver, awaiting, gmv };
  }, [filtered]);

  return (
    <section className="admin-workbench is-padded">
      <div className="admin-panel-head">
        <div>
          <h2>
            <Package size={18} />
            <span>Market Orders &amp; Delivery Tracking</span>
          </h2>
          <p>Filter orders by courier, shipping stage, dispatch speed, and delivery transit time.</p>
        </div>
        <button type="button" className="button secondary" onClick={() => void load()} disabled={loading}>
          <Refresh size={15} className={loading ? 'spin' : ''} />
          <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {error && <p className="admin-error">{error}</p>}

      <div className="admin-orders-kpis">
        <div className="admin-orders-kpi">
          <span>Matching Orders</span>
          <strong>{kpis.count}</strong>
        </div>
        <div className="admin-orders-kpi">
          <span>Awaiting Dispatch</span>
          <strong>{kpis.awaiting}</strong>
        </div>
        <div className="admin-orders-kpi">
          <span>Avg Time to Ship</span>
          <strong>{formatDurationHours(kpis.avgShip)}</strong>
        </div>
        <div className="admin-orders-kpi">
          <span>Avg Transit Time</span>
          <strong>{formatDurationHours(kpis.avgDeliver)}</strong>
        </div>
        <div className="admin-orders-kpi">
          <span>Paid Order Volume</span>
          <strong>{formatMoney(kpis.gmv, 'IDR')}</strong>
        </div>
      </div>

      <div className="admin-orders-filters">
        <label>
          <span>Search</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Order ID, buyer, seller, waybill"
          />
        </label>
        <label>
          <span>Order Status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">All statuses</option>
            {['PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'FULFILLED', 'PENDING', 'CANCELLED', 'FAILED'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Courier</span>
          <select value={courierFilter} onChange={(e) => setCourierFilter(e.target.value)}>
            <option value="ALL">All couriers</option>
            {couriers.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="NONE">No courier recorded</option>
          </select>
        </label>
        <label>
          <span>Shipping Status</span>
          <select value={shippingFilter} onChange={(e) => setShippingFilter(e.target.value)}>
            <option value="ALL">All shipping stages</option>
            {shippingStatuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value="NONE">Not arranged</option>
          </select>
        </label>
        <label>
          <span>Fulfillment &amp; Sort</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <select value={slaFilter} onChange={(e) => setSlaFilter(e.target.value)}>
              <option value="ALL">All SLA</option>
              <option value="AWAITING_DISPATCH">Awaiting ship</option>
              <option value="SLOW_SHIP">Ship &gt; 48h</option>
              <option value="SLOW_DELIVER">Transit &gt; 5d</option>
              <option value="DELIVERED">Delivered</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            >
              <option value="newest">Newest</option>
              <option value="slow-ship">Slowest ship</option>
              <option value="slow-deliver">Slowest deliver</option>
              <option value="highest">Highest total</option>
            </select>
          </div>
        </label>
      </div>

      {loading && !orders.length ? (
        <AdminLoadingSkeleton variant="table" label="Loading Market orders" columns={8} />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-health-table">
            <thead>
              <tr>
                <th>Order &amp; Listing</th>
                <th>Buyer / Seller</th>
                <th>Total</th>
                <th>Order / Shipping</th>
                <th>Courier &amp; Waybill</th>
                <th>Paid to Ship</th>
                <th>Ship to Deliver</th>
                <th>Timeline</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id}>
                  <td>
                    <strong>{o.listingTitle || 'Market Order'}</strong>
                    <small style={{ display: 'block', opacity: 0.7 }}>{o.id.slice(0, 8)}</small>
                  </td>
                  <td>
                    <div>
                      Buyer:{' '}
                      {o.buyerUsername ? (
                        <Link href={`/players/${encodeURIComponent(o.buyerUsername)}`}>
                          @{o.buyerUsername}
                        </Link>
                      ) : (
                        o.buyerName || '-'
                      )}
                    </div>
                    <small style={{ display: 'block', opacity: 0.75 }}>
                      Seller:{' '}
                      {o.sellerUsername ? (
                        <Link href={`/players/${encodeURIComponent(o.sellerUsername)}`}>
                          @{o.sellerUsername}
                        </Link>
                      ) : (
                        o.sellerName || '-'
                      )}
                    </small>
                  </td>
                  <td>
                    <strong>{formatMoney(o.amount, o.currency)}</strong>
                    <small style={{ display: 'block', opacity: 0.7 }}>
                      Ship: {formatMoney(o.shippingFee, o.currency)}
                    </small>
                  </td>
                  <td>
                    <span className="admin-social-status">{o.status}</span>
                    <small style={{ display: 'block', marginTop: 4, opacity: 0.75 }}>
                      {o.shippingStatus || 'No shipment'}
                    </small>
                  </td>
                  <td>
                    <strong>
                      {o.courier || '-'}
                      {o.service ? ` (${o.service})` : ''}
                    </strong>
                    {o.waybill && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <button
                          type="button"
                          className="admin-copy-chip"
                          onClick={() => {
                            void navigator.clipboard.writeText(o.waybill!);
                            setCopiedId(o.id);
                            setTimeout(() => setCopiedId((c) => (c === o.id ? null : c)), 1500);
                          }}
                        >
                          <span>{o.waybill}</span>
                          {copiedId === o.id ? <Check size={11} /> : <Copy size={11} />}
                        </button>
                        {o.trackingUrl && (
                          <a href={o.trackingUrl} target="_blank" rel="noreferrer" title="Open tracking">
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    <span
                      className={`admin-order-sla${
                        o.hoursToShip !== null && o.hoursToShip > 48
                          ? ' is-slow'
                          : o.hoursToShip !== null
                            ? ' is-fast'
                            : ''
                      }`}
                    >
                      {formatDurationHours(o.hoursToShip)}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`admin-order-sla${
                        o.hoursToDeliver !== null && o.hoursToDeliver > 120
                          ? ' is-slow'
                          : o.hoursToDeliver !== null
                            ? ' is-fast'
                            : ''
                      }`}
                    >
                      {formatDurationHours(o.hoursToDeliver)}
                    </span>
                  </td>
                  <td>
                    <small style={{ display: 'block' }}>Paid: {formatDateShort(o.paidAt)}</small>
                    <small style={{ display: 'block' }}>Shipped: {formatDateShort(o.dispatchedAt)}</small>
                    <small style={{ display: 'block' }}>Delivered: {formatDateShort(o.deliveredAt)}</small>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={8}>No orders match the selected filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
