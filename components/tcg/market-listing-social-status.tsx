'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from '@/components/ui/localized-link';
import {
  ArrowSquareOutIcon as ArrowSquareOut,
  CalendarBlankIcon as Calendar,
  CheckCircleIcon as CheckCircle,
  ClockIcon as Clock,
  FacebookLogoIcon as FacebookLogo,
  GlobeIcon as Globe,
  InstagramLogoIcon as InstagramLogo,
  ShareNetworkIcon as ShareNetwork,
  ThreadsLogoIcon as ThreadsLogo,
  TrashIcon as Trash,
  XIcon as X,
} from '@phosphor-icons/react';

type ListingSocialLog = {
  id: string;
  platform: string;
  status: string;
  postId: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  caption: string | null;
  username: string | null;
  permalink: string | null;
  mediaUrl: string | null;
  canRemoteDelete: boolean;
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  threads: 'Threads',
};

function PlatformIcon({ platform, size = 14 }: { platform: string; size?: number }) {
  const key = platform.toLowerCase();
  if (key === 'instagram') return <InstagramLogo size={size} weight="fill" />;
  if (key === 'facebook') return <FacebookLogo size={size} weight="fill" />;
  if (key === 'threads') return <ThreadsLogo size={size} weight="fill" />;
  return <Globe size={size} />;
}

function formatLogDate(raw: string | null, lang: 'EN' | 'ID'): string {
  if (!raw) return '';
  const date = new Date(raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString(lang === 'ID' ? 'id-ID' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MarketListingSocialStatus({
  listingId,
  language,
}: {
  listingId: string;
  language: 'EN' | 'ID';
}) {
  const t = useCallback((en: string, id: string) => (language === 'ID' ? id : en), [language]);
  const [logs, setLogs] = useState<ListingSocialLog[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/market/social/publish?listingId=${encodeURIComponent(listingId)}`, {
        cache: 'no-store',
      });
      const data = (await res.json().catch(() => null)) as { logs?: ListingSocialLog[] } | null;
      if (Array.isArray(data?.logs)) {
        setLogs(data.logs);
      }
    } finally {
      setLoaded(true);
    }
  }, [listingId]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  async function handleRemove(logId: string) {
    setRemovingId(logId);
    try {
      const res = await fetch(`/api/market/social/publish?logId=${encodeURIComponent(logId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setLogs((prev) => prev.filter((item) => item.id !== logId));
      }
    } finally {
      setRemovingId(null);
    }
  }

  if (!loaded) return null;

  return (
    <>
      <div className="market-listing-social-bar" role="region" aria-label={t('Social publish status', 'Status publikasi sosial')}>
        <div className="market-listing-social-bar-left">
          <span className="market-listing-social-bar-label">
            <ShareNetwork size={14} />
            {logs.length > 0
              ? t('Social Posts', 'Postingan Sosial')
              : t('Not yet published to connected socials', 'Belum dipublikasikan ke media sosial')}
          </span>

          {logs.length > 0 && (
            <div className="market-listing-social-pills">
              {logs.map((log) => {
                const pKey = log.platform.split(',')[0]?.trim().toLowerCase() ?? log.platform.toLowerCase();
                return (
                  <button
                    key={log.id}
                    type="button"
                    className={`market-listing-social-pill is-${pKey}`}
                    onClick={() => setOpen(true)}
                    title={t('View social post details', 'Lihat detail postingan sosial')}
                  >
                    <PlatformIcon platform={pKey} size={13} />
                    <span>{PLATFORM_LABELS[pKey] ?? log.platform}</span>
                    <em>{log.status === 'SCHEDULED' ? t('Scheduled', 'Terjadwal') : t('Published', 'Terbit')}</em>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="market-listing-social-bar-actions">
          {logs.length > 0 && (
            <button
              type="button"
              className="market-listing-social-detail-btn"
              onClick={() => setOpen(true)}
            >
              {t('Post details', 'Detail postingan')}
            </button>
          )}
          <Link href="/profile?tab=socials" className="market-listing-social-manage-link">
            {t('All social posts', 'Semua postingan')}
          </Link>
        </div>
      </div>

      {open && (
        <div
          className="social-post-detail-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={t('Published social post details', 'Detail postingan media sosial')}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="social-post-detail-modal">
            <div className="social-post-detail-head">
              <div>
                <h3>{t('Social Post Details', 'Detail Postingan Sosial')}</h3>
                <p>
                  {t(
                    `${logs.length} ${logs.length === 1 ? 'post' : 'posts'} linked to this listing.`,
                    `${logs.length} postingan tertaut ke listing ini.`
                  )}
                </p>
              </div>
              <button
                type="button"
                className="social-post-detail-close"
                onClick={() => setOpen(false)}
                aria-label={t('Close', 'Tutup')}
              >
                <X size={16} />
              </button>
            </div>

            <div className="social-post-detail-list">
              {logs.length === 0 ? (
                <p className="profile-socials-muted">
                  {t('All linked social posts were removed.', 'Semua postingan tertaut telah dihapus.')}
                </p>
              ) : (
                logs.map((log) => {
                  const pKey = log.platform.split(',')[0]?.trim().toLowerCase() ?? log.platform.toLowerCase();
                  const dateText = formatLogDate(
                    log.status === 'SCHEDULED' ? log.scheduledAt : log.publishedAt,
                    language
                  );
                  return (
                    <article key={log.id} className="social-post-detail-item">
                      <div className="social-post-detail-item-head">
                        <div className="social-post-detail-platform">
                          <span className={`profile-social-badge is-${pKey}`}>
                            <PlatformIcon platform={pKey} size={14} />
                          </span>
                          <div>
                            <strong>{PLATFORM_LABELS[pKey] ?? log.platform}</strong>
                            {log.username && <span>@{log.username.replace(/^@/, '')}</span>}
                          </div>
                        </div>
                        <span className={`profile-social-post-status is-${log.status.toLowerCase()}`}>
                          {log.status === 'SCHEDULED' ? <Clock size={12} /> : <CheckCircle size={12} weight="fill" />}
                          <span>{log.status === 'SCHEDULED' ? t('Scheduled', 'Terjadwal') : t('Published', 'Terbit')}</span>
                        </span>
                      </div>

                      {dateText && (
                        <div className="social-post-detail-date">
                          <Calendar size={13} />
                          <span>{dateText}</span>
                        </div>
                      )}

                      {log.mediaUrl && (
                        <div className="social-post-detail-media">
                          <img src={log.mediaUrl} alt={PLATFORM_LABELS[pKey] ?? log.platform} loading="lazy" />
                        </div>
                      )}

                      {log.caption && <p className="social-post-detail-caption">{log.caption}</p>}

                      <div className="social-post-detail-actions">
                        {log.permalink && (
                          <a
                            href={log.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="profile-social-action-link"
                          >
                            <ArrowSquareOut size={14} />
                            {t(`View on ${PLATFORM_LABELS[pKey] ?? log.platform}`, `Lihat di ${PLATFORM_LABELS[pKey] ?? log.platform}`)}
                          </a>
                        )}
                        <button
                          type="button"
                          className="profile-social-action-remove"
                          disabled={removingId === log.id}
                          onClick={() => void handleRemove(log.id)}
                        >
                          <Trash size={14} />
                          {removingId === log.id
                            ? t('Removing...', 'Menghapus...')
                            : log.canRemoteDelete
                              ? t('Delete Post', 'Hapus Postingan')
                              : t('Unlink', 'Lepas Tautan')}
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
