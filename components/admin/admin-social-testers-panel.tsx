'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import type { SocialTesterRequestRecord, SocialTesterRequestStatus } from '@/lib/server/postforme';

export function AdminSocialTestersPanel() {
  const [requests, setRequests] = useState<SocialTesterRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/social-testers', { cache: 'no-store' });
      const data = (await res.json().catch(() => null)) as { requests?: SocialTesterRequestRecord[] } | null;
      if (Array.isArray(data?.requests)) {
        setRequests(data.requests);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(id: string, status: SocialTesterRequestStatus) {
    setUpdatingId(id);
    try {
      const res = await fetch('/api/admin/social-testers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      }
    } finally {
      setUpdatingId(null);
    }
  }

  function copyHandle(key: string, value: string) {
    void navigator.clipboard?.writeText(value);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1500);
  }

  return (
    <section className="admin-panel" aria-label="Social auto-post tester requests">
      <div className="admin-panel-head">
        <div>
          <h2>
            <Share2 size={16} /> Social Auto-Post Tester Requests
          </h2>
          <p>
            Users requesting early access to Instagram, Facebook Page, or Threads auto-publishing. Add their handle in Meta App Dashboard, then mark Invited.
          </p>
        </div>
        <button type="button" className="admin-btn-secondary" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="admin-muted">Loading tester requests...</p>
      ) : requests.length === 0 ? (
        <p className="admin-muted">No tester access requests submitted yet.</p>
      ) : (
        <div className="admin-social-testers-list">
          {requests.map((req) => (
            <article key={req.id} className="admin-social-tester-row">
              <div className="admin-social-tester-info">
                <div className="admin-social-tester-title">
                  <strong>{req.displayName || req.username}</strong>
                  <span>@{req.username}</span>
                  <span className={`profile-tester-status is-${req.status.toLowerCase()}`}>{req.status}</span>
                </div>
                <div className="admin-social-tester-handles">
                  {req.instagramHandle && (
                    <button
                      type="button"
                      className="admin-copy-chip"
                      onClick={() => copyHandle(`${req.id}-ig`, req.instagramHandle!)}
                      title="Copy Instagram handle"
                    >
                      <span>IG: @{req.instagramHandle}</span>
                      {copiedKey === `${req.id}-ig` ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  )}
                  {req.facebookProfile && (
                    <button
                      type="button"
                      className="admin-copy-chip"
                      onClick={() => copyHandle(`${req.id}-fb`, req.facebookProfile!)}
                      title="Copy Facebook / Meta profile"
                    >
                      <span>FB/Meta: {req.facebookProfile}</span>
                      {copiedKey === `${req.id}-fb` ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  )}
                  {req.threadsHandle && (
                    <button
                      type="button"
                      className="admin-copy-chip"
                      onClick={() => copyHandle(`${req.id}-th`, req.threadsHandle!)}
                      title="Copy Threads handle"
                    >
                      <span>Threads: @{req.threadsHandle}</span>
                      {copiedKey === `${req.id}-th` ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  )}
                </div>
                {req.notes && <p className="admin-social-tester-note">{req.notes}</p>}
              </div>

              <div className="admin-social-tester-actions">
                <button
                  type="button"
                  className="admin-btn-secondary"
                  disabled={updatingId === req.id || req.status === 'INVITED'}
                  onClick={() => void updateStatus(req.id, 'INVITED')}
                >
                  Mark Invited
                </button>
                <button
                  type="button"
                  className="admin-btn-secondary"
                  disabled={updatingId === req.id || req.status === 'APPROVED'}
                  onClick={() => void updateStatus(req.id, 'APPROVED')}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="admin-btn-secondary"
                  disabled={updatingId === req.id || req.status === 'DECLINED'}
                  onClick={() => void updateStatus(req.id, 'DECLINED')}
                >
                  Decline
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
