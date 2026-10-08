'use client';

import { useEffect, useState } from 'react';
import {
  FloppyDiskIcon as FloppyDisk,
  ArrowCounterClockwiseIcon as Reset,
  StorefrontIcon as Storefront,
  ClockIcon as Clock,
  TagIcon as Tag,
  SparkleIcon as Sparkle,
  ShieldCheckIcon as ShieldCheck,
  LightningIcon as Lightning,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import type { AccountTier, ListingTierPolicy } from '@/lib/market/policy';
import { MARKET_BUYER_FEE_PERCENT } from '@/lib/market/policy';
import { DEFAULT_PRO_PRICING,type ProPricing } from '@/lib/market/pro-pricing';

interface PolicyResponse {
  policies: Record<AccountTier, ListingTierPolicy>;
  proPricing:ProPricing;
  stats: {
    activeListings: number;
    activeSellers: number;
  };
}

function dateForInput(value:string|null){
  if(!value)return '';
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))return '';
  return new Date(date.getTime()-date.getTimezoneOffset()*60_000).toISOString().slice(0,10);
}

export function MarketPolicyManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ activeListings: 0, activeSellers: 0 });
  const [initialPolicies, setInitialPolicies] = useState<Record<AccountTier, ListingTierPolicy> | null>(null);

  // Form states
  const [freeDays, setFreeDays] = useState(7);
  const [freeMax, setFreeMax] = useState(25);
  const [freeFee, setFreeFee] = useState(1.5);

  const [proDays, setProDays] = useState(30);
  const [proMax, setProMax] = useState(2500);
  const [proFee, setProFee] = useState(0.75);
  const [proAutoRenew, setProAutoRenew] = useState(true);
  const [proPrice,setProPrice]=useState(DEFAULT_PRO_PRICING.amount);
  const [proDuration,setProDuration]=useState(DEFAULT_PRO_PRICING.durationDays);
  const [proIntroPrice,setProIntroPrice]=useState<number|null>(DEFAULT_PRO_PRICING.introAmount);
  const [proIntroEndDate,setProIntroEndDate]=useState(dateForInput(DEFAULT_PRO_PRICING.introEndsAt));
  const [proIntroLimit,setProIntroLimit]=useState(DEFAULT_PRO_PRICING.introLimit);
  const [initialPricing,setInitialPricing]=useState<ProPricing>(DEFAULT_PRO_PRICING);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/market-policy', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load market policy');
      const data = (await res.json()) as PolicyResponse;
      setStats(data.stats);
      setInitialPolicies(data.policies);

      setFreeDays(data.policies.free.durationDays);
      setFreeMax(data.policies.free.maxActiveListings);
      setFreeFee(data.policies.free.commissionPercent);

      setProDays(data.policies.pro.durationDays);
      setProMax(data.policies.pro.maxActiveListings);
      setProFee(data.policies.pro.commissionPercent);
      setProAutoRenew(data.policies.pro.canAutoRenew);
      setProPrice(data.proPricing.amount);
      setProDuration(data.proPricing.durationDays);
      setProIntroPrice(data.proPricing.introAmount);
      setProIntroEndDate(dateForInput(data.proPricing.introEndsAt));
      setProIntroLimit(data.proPricing.introLimit);
      setInitialPricing(data.proPricing);
    } catch {
      toast.error('Unable to fetch live Market policies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer=window.setTimeout(()=>void load(),0);
    return()=>window.clearTimeout(timer);
  }, []);

  const applyPreset = (preset: 'recommended' | 'quick-turn' | 'relaxed') => {
    if (preset === 'recommended') {
      setFreeDays(7);
      setFreeMax(25);
      setFreeFee(1.5);
      setProDays(30);
      setProMax(2500);
      setProFee(0.75);
      setProAutoRenew(true);
      toast.info('Applied "Recommended (7d / 25 listings)" preset. Click Save to apply.');
    } else if (preset === 'quick-turn') {
      setFreeDays(3);
      setFreeMax(25);
      setFreeFee(1.5);
      setProDays(30);
      setProMax(2500);
      setProFee(0.75);
      setProAutoRenew(true);
      toast.info('Applied "Quick-turn listings (3d / 25 listings)" preset. Click Save to apply.');
    } else if (preset === 'relaxed') {
      setFreeDays(30);
      setFreeMax(25);
      setFreeFee(1.5);
      setProDays(60);
      setProMax(2500);
      setProFee(0.75);
      setProAutoRenew(true);
      toast.info('Applied "Relaxed (30d / 25 listings)" preset. Click Save to apply.');
    }
  };

  const resetToSaved = () => {
    if (!initialPolicies) return;
    setFreeDays(initialPolicies.free.durationDays);
    setFreeMax(initialPolicies.free.maxActiveListings);
    setFreeFee(initialPolicies.free.commissionPercent);

    setProDays(initialPolicies.pro.durationDays);
    setProMax(initialPolicies.pro.maxActiveListings);
    setProFee(initialPolicies.pro.commissionPercent);
    setProAutoRenew(initialPolicies.pro.canAutoRenew);
    setProPrice(initialPricing.amount);
    setProDuration(initialPricing.durationDays);
    setProIntroPrice(initialPricing.introAmount);
    setProIntroEndDate(dateForInput(initialPricing.introEndsAt));
    setProIntroLimit(initialPricing.introLimit);
    toast.message('Reverted to currently active policy.');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        free: {
          durationDays: Math.max(1, Number(freeDays)),
          maxActiveListings: Math.max(1, Number(freeMax)),
          commissionPercent: Math.max(0, Number(freeFee)),
          canAutoRenew: false,
        },
        pro: {
          durationDays: Math.max(1, Number(proDays)),
          maxActiveListings: Math.max(1, Number(proMax)),
          commissionPercent: Math.max(0, Number(proFee)),
          canAutoRenew: proAutoRenew,
        },
        proPricing:{
          amount:Number(proPrice),
          durationDays:Number(proDuration),
          introAmount:proIntroPrice===null?null:Number(proIntroPrice),
          introEndsAt:proIntroEndDate?new Date(`${proIntroEndDate}T23:59:59+07:00`).toISOString():null,
          introLimit:Number(proIntroLimit),
        },
      };

      const res = await fetch('/api/admin/market-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err?.error || 'Failed to update policy');
      }

      setInitialPolicies({
        free: { ...payload.free, tier: 'free' },
        pro: { ...payload.pro, tier: 'pro' },
      });
      setInitialPricing(payload.proPricing);
      toast.success('Market policies updated live in D1 storage!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save policies');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-health-skeleton" aria-label="Loading market policy">
        <i />
        <i />
        <i />
        <i />
      </div>
    );
  }

  return (
    <form className="admin-policy-view" onSubmit={handleSave}>
      <header className="admin-policy-header">
        <div>
          <h2>Market Retention & Limits Policy</h2>
          <p>
            Configure listing lifespans, seller quotas, and seller fees. Buyers also pay a {MARKET_BUYER_FEE_PERCENT}% Market service fee on new orders.
          </p>
        </div>
        <div className="admin-policy-presets">
          <span style={{ fontSize: 11, fontWeight: 700, color: '#798076' }}>Presets:</span>
          <button
            type="button"
            className="admin-preset-btn"
            onClick={() => applyPreset('recommended')}
          >
            Recommended (7d / 25)
          </button>
          <button
            type="button"
            className="admin-preset-btn"
            onClick={() => applyPreset('quick-turn')}
          >
            Quick-turn (3d / 25)
          </button>
          <button
            type="button"
            className="admin-preset-btn"
            onClick={() => applyPreset('relaxed')}
          >
            Relaxed (30d / 25)
          </button>
        </div>
      </header>

      <section className="admin-metrics">
        <div>
          <Storefront size={18} />
          <span>Active listings</span>
          <strong>{stats.activeListings}</strong>
        </div>
        <div>
          <Tag size={18} />
          <span>Active sellers</span>
          <strong>{stats.activeSellers}</strong>
        </div>
        <div className="healthy">
          <Clock size={18} />
          <span>Free retention window</span>
          <strong>{freeDays} Days</strong>
        </div>
        <div className="healthy">
          <Lightning size={18} />
          <span>Pro retention window</span>
          <strong>{proDays} Days</strong>
        </div>
      </section>

      <div className="admin-policy-grid">
        {/* Free Tier Card */}
        <div className="admin-policy-card">
          <span className="admin-tier-badge free">
            <ShieldCheck size={13} /> Free Tier (Casual Collectors)
          </span>
          <h3>Standard Account</h3>
          <p className="tier-desc">Default tier assigned to all registered collectors and local players.</p>

          <div className="admin-policy-fields">
            <div className="admin-policy-field">
              <label htmlFor="free-days">
                Listing Expiration Duration <span>(Retention Hook)</span>
              </label>
              <input
                id="free-days"
                type="number"
                min="1"
                max="365"
                value={freeDays}
                onChange={(e) => setFreeDays(Number(e.target.value))}
                required
              />
              <small>Cards expire after this many days. Sellers can renew in 1 click.</small>
            </div>

            <div className="admin-policy-field">
              <label htmlFor="free-max">
                Max Active Listings <span>(Simultaneous)</span>
              </label>
              <input
                id="free-max"
                type="number"
                min="1"
                max="1000"
                value={freeMax}
                onChange={(e) => setFreeMax(Number(e.target.value))}
                required
              />
              <small>Cap on active WTS/WTB listings. Prevents spam while giving casuals enough room.</small>
            </div>

            <div className="admin-policy-field">
              <label htmlFor="free-fee">
                Seller fee <span>(%)</span>
              </label>
              <input
                id="free-fee"
                type="number"
                min="0"
            max="100"
            step="0.01"
                value={freeFee}
                onChange={(e) => setFreeFee(Number(e.target.value))}
                required
              />
              <small>Deducted from seller proceeds after a completed sale.</small>
            </div>

            <div className="admin-policy-field">
              <label>Auto-Renewal</label>
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #e2d5c0',
                  background: 'rgba(0,0,0,0.02)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#6e7a71',
                }}
              >
                Disabled for Free tier (drives user to log in and renew manually).
              </div>
            </div>
          </div>
        </div>

        {/* Pro Tier Card */}
        <div className="admin-policy-card is-pro">
          <span className="admin-tier-badge pro">
            <Sparkle size={13} /> Pro Tier (Card Stores & Power Sellers)
          </span>
          <h3>Pro Collector & Shop</h3>
          <p className="tier-desc">Paid subscriber tier for local card game stores and large inventory traders.</p>

          <div className="admin-policy-fields">
            <div className="admin-policy-field">
              <label htmlFor="pro-days">
                Listing Expiration Duration <span>(Active Days)</span>
              </label>
              <input
                id="pro-days"
                type="number"
                min="1"
                max="365"
                value={proDays}
                onChange={(e) => setProDays(Number(e.target.value))}
                required
              />
              <small>Extended listing lifespan before requiring renewal or auto-reup.</small>
            </div>

            <div className="admin-policy-field">
              <label htmlFor="pro-max">
                Max Active Listings <span>(Shop Inventory)</span>
              </label>
              <input
                id="pro-max"
                type="number"
                min="1"
                max="100000"
                value={proMax}
                onChange={(e) => setProMax(Number(e.target.value))}
                required
              />
              <small>Maximum simultaneous listings allowed for Pro stores.</small>
            </div>

            <div className="admin-policy-field">
              <label htmlFor="pro-fee">
                Seller fee <span>(%)</span>
              </label>
              <input
                id="pro-fee"
                type="number"
                min="0"
            max="100"
            step="0.01"
                value={proFee}
                onChange={(e) => setProFee(Number(e.target.value))}
                required
              />
              <small>Deducted from seller proceeds after a completed sale.</small>
            </div>

            <div className="admin-policy-field">
              <label>Auto-Renewal Feature</label>
              <label className="admin-policy-toggle">
                <input
                  type="checkbox"
                  checked={proAutoRenew}
                  onChange={(e) => setProAutoRenew(e.target.checked)}
                />
                <span>Automatically renew listings before expiration</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <section className="admin-policy-card admin-pro-pricing-card">
        <span className="admin-tier-badge pro"><Sparkle size={13}/>Market Pro pricing</span>
        <p className="tier-desc">Changes apply to new checkouts. Existing orders keep their original total and membership term.</p>
        <div className="admin-policy-fields">
          <div className="admin-policy-field"><label htmlFor="pro-price">Regular price <span>(IDR)</span></label><input id="pro-price" type="number" min="1000" step="100" value={proPrice} onChange={event=>setProPrice(Number(event.target.value))} required/><small>Charged for each membership period.</small></div>
          <div className="admin-policy-field"><label htmlFor="pro-duration">Membership length <span>(days)</span></label><input id="pro-duration" type="number" min="1" max="365" value={proDuration} onChange={event=>setProDuration(Number(event.target.value))} required/><small>How long Pro benefits remain active after payment.</small></div>
          <div className="admin-policy-field"><label htmlFor="pro-intro-price">Launch price <span>(IDR, optional)</span></label><input id="pro-intro-price" type="number" min="1000" step="100" value={proIntroPrice??''} onChange={event=>setProIntroPrice(event.target.value?Number(event.target.value):null)} placeholder="Off"/><small>Must be lower than the regular price.</small></div>
          <div className="admin-policy-field"><label htmlFor="pro-intro-date">Launch offer ends <span>(Jakarta time)</span></label><input id="pro-intro-date" type="date" value={proIntroEndDate} onChange={event=>setProIntroEndDate(event.target.value)} disabled={proIntroPrice===null}/><small>Leave blank to turn off the launch offer.</small></div>
          <div className="admin-policy-field"><label htmlFor="pro-intro-limit">Launch offer account limit</label><input id="pro-intro-limit" type="number" min="0" step="1" value={proIntroLimit} onChange={event=>setProIntroLimit(Number(event.target.value))} disabled={proIntroPrice===null} required/><small>Set to 0 for no account limit.</small></div>
        </div>
      </section>

      <footer className="admin-policy-footer">
        <button type="button" className="admin-discard-btn" onClick={resetToSaved} disabled={saving}>
          <Reset size={14} style={{ marginRight: 6 }} /> Reset Unsaved
        </button>
        <button type="submit" className="admin-save-btn" disabled={saving}>
          {saving ? (
            <Clock size={16} className="spin" />
          ) : (
            <FloppyDisk size={16} />
          )}
          {saving ? 'Saving to D1...' : 'Save Market Policies'}
        </button>
      </footer>
    </form>
  );
}
