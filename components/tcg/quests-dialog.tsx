'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from '@/components/ui/localized-link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowRightIcon,
  CheckCircleIcon,
  GiftIcon,
  SparkleIcon,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { PRO_TRIAL_QUEST_KEY, type QuestItem } from '@/lib/quests';

type QuestBoard = {
  quests: QuestItem[];
  totalPoints: number;
  earnedPoints: number;
  claimedCount: number;
  readyCount: number;
  proRewardClaimed: boolean;
  proRewardUnlocked: boolean;
  proRewardRequiredClaims: number;
  proRewardDays: number;
};

export function QuestsDialog({
  language,
  signedIn,
}: {
  language: 'EN' | 'ID';
  signedIn: boolean;
}) {
  const id = language === 'ID';
  const [open, setOpen] = useState(false);
  const [board, setBoard] = useState<QuestBoard | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [claimingKey, setClaimingKey] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    if (!signedIn) return;
    setLoading(true);
    setLoadError('');
    try {
      const response = await fetch('/api/quests', { cache: 'no-store' });
      const data = (await response.json().catch(() => null)) as (QuestBoard & { error?: string }) | null;
      if (!response.ok || !data) {
        throw new Error(data?.error || (id ? 'Gagal memuat quest.' : 'Could not load quests.'));
      }
      setBoard(data);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : id
            ? 'Gagal memuat quest.'
            : 'Could not load quests.'
      );
    } finally {
      setLoading(false);
    }
  }, [signedIn, id]);

  useEffect(() => {
    if (!signedIn) {
      setBoard(null);
      return;
    }
    void loadBoard();
  }, [signedIn, loadBoard]);

  useEffect(() => {
    const onOpen = () => {
      if (!signedIn) {
        window.dispatchEvent(new CustomEvent('vivreplay:open-auth', { detail: 'sign-in' }));
        return;
      }
      setOpen(true);
      void loadBoard();
    };
    window.addEventListener('vivreplay:open-quests', onOpen);
    return () => window.removeEventListener('vivreplay:open-quests', onOpen);
  }, [signedIn, loadBoard]);

  const claim = async (questKey: string) => {
    setClaimingKey(questKey);
    try {
      const response = await fetch('/api/quests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ questKey }),
      });
      const payload = (await response.json()) as QuestBoard & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || (id ? 'Gagal mengklaim hadiah.' : 'Could not claim reward.'));
      }
      setBoard(payload);
      toast.success(
        questKey === PRO_TRIAL_QUEST_KEY
          ? id
            ? '3 hari Market Pro berhasil diaktifkan!'
            : '3 days of Market Pro activated!'
          : id
            ? 'Hadiah quest diklaim!'
            : 'Quest reward claimed!'
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : id
            ? 'Gagal mengklaim hadiah.'
            : 'Could not claim reward.'
      );
    } finally {
      setClaimingKey(null);
    }
  };

  const pct =
    board && board.totalPoints > 0
      ? Math.min(100, Math.round((board.earnedPoints / board.totalPoints) * 100))
      : 0;

  const renderGroup = (group: 'starter' | 'growth', heading: string) => {
    const items = (board?.quests ?? []).filter((q) => q.group === group);
    if (!items.length) return null;
    return (
      <section className="quests-group">
        <h3>{heading}</h3>
        <div className="quests-grid">
          {items.map((quest) => {
            const ready = quest.completed && !quest.claimed;
            return (
              <article
                key={quest.key}
                className={`quest-card${quest.claimed ? ' is-claimed' : ready ? ' is-ready' : ''}`}
              >
                <div className="quest-card-top">
                  <strong>{quest.title[language]}</strong>
                  <span className="quest-points-pill">+{quest.points} VP</span>
                </div>
                <p>{quest.description[language]}</p>
                {quest.target > 1 && !quest.claimed && (
                  <div className="quest-card-progress">
                    <span>
                      {quest.progress}/{quest.target}
                    </span>
                    <i>
                      <b style={{ width: `${Math.round((quest.progress / quest.target) * 100)}%` }} />
                    </i>
                  </div>
                )}
                <div className="quest-card-actions">
                  {quest.claimed ? (
                    <span className="quest-claimed-badge">
                      <CheckCircleIcon size={14} weight="fill" />
                      {id ? 'Diklaim' : 'Claimed'}
                    </span>
                  ) : ready ? (
                    <button
                      type="button"
                      className="button primary quest-claim-btn"
                      disabled={claimingKey === quest.key}
                      onClick={() => void claim(quest.key)}
                    >
                      {claimingKey === quest.key
                        ? id
                          ? 'Mengklaim…'
                          : 'Claiming…'
                        : id
                          ? 'Klaim'
                          : 'Claim'}
                    </button>
                  ) : (
                    <Link
                      href={quest.href}
                      className="button secondary quest-go-btn"
                      onClick={() => setOpen(false)}
                    >
                      {id ? 'Buka' : 'Go'}
                      <ArrowRightIcon size={13} />
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <>
      {signedIn && (
        <button
          type="button"
          className="quests-mark"
          onClick={() => {
            setOpen(true);
            void loadBoard();
          }}
          aria-label={id ? 'Buka Quest & Hadiah' : 'Open Quests & Rewards'}
          title={id ? 'Quest & Hadiah' : 'Quests & Rewards'}
        >
          <GiftIcon size={16} />
          {board && board.readyCount > 0 && (
            <span className="quests-mark-dot" aria-hidden="true">
              {board.readyCount}
            </span>
          )}
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="quests-dialog">
          <DialogHeader>
            <DialogTitle className="quests-dialog-title">
              <SparkleIcon size={18} />
              {id ? 'Quest & Hadiah VivrePlay' : 'VivrePlay Quests & Rewards'}
            </DialogTitle>
            <DialogDescription>
              {id
                ? 'Selesaikan misi koleksi dan Market untuk mengumpulkan VivrePlay Points dan membuka bonus Market Pro.'
                : 'Complete collection and Market milestones to earn VivrePlay Points and unlock bonus Market Pro access.'}
            </DialogDescription>
          </DialogHeader>

          {loading && !board ? (
            <div className="quests-loading" role="status">
              {id ? 'Memuat progres quest…' : 'Loading quest progress…'}
            </div>
          ) : loadError && !board ? (
            <div className="quests-loading" role="status">
              <p>{loadError}</p>
              <button type="button" className="button secondary" onClick={() => void loadBoard()}>
                {id ? 'Coba lagi' : 'Try again'}
              </button>
            </div>
          ) : board ? (
            <div className="quests-body">
              <div className="quests-summary">
                <div className="quests-summary-numbers">
                  <strong>
                    {board.earnedPoints} / {board.totalPoints} VP
                  </strong>
                  <span>
                    {board.claimedCount} / {board.quests.length}{' '}
                    {id ? 'quest selesai' : 'quests completed'}
                  </span>
                </div>
                <div className="quests-progress-track" aria-hidden="true">
                  <b style={{ width: `${pct}%` }} />
                </div>
              </div>

              <div
                className={`quests-milestone${board.proRewardClaimed ? ' is-claimed' : board.proRewardUnlocked ? ' is-ready' : ''}`}
              >
                <div>
                  <span className="quests-milestone-eyebrow">
                    {id ? 'HADIAH MILESTONE' : 'MILESTONE REWARD'}
                  </span>
                  <strong>
                    {id
                      ? `Buka ${board.proRewardDays} Hari Market Pro`
                      : `Unlock ${board.proRewardDays} Days of Market Pro`}
                  </strong>
                  <p>
                    {id
                      ? `Selesaikan & klaim ${board.proRewardRequiredClaims} quest (${Math.min(board.claimedCount, board.proRewardRequiredClaims)}/${board.proRewardRequiredClaims}).`
                      : `Complete & claim ${board.proRewardRequiredClaims} quests (${Math.min(board.claimedCount, board.proRewardRequiredClaims)}/${board.proRewardRequiredClaims}).`}
                  </p>
                </div>
                {board.proRewardClaimed ? (
                  <span className="quest-claimed-badge">
                    <CheckCircleIcon size={14} weight="fill" />
                    {id ? 'Aktif / Diklaim' : 'Claimed'}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="button primary"
                    disabled={!board.proRewardUnlocked || claimingKey === PRO_TRIAL_QUEST_KEY}
                    onClick={() => void claim(PRO_TRIAL_QUEST_KEY)}
                  >
                    {claimingKey === PRO_TRIAL_QUEST_KEY
                      ? id
                        ? 'Mengaktifkan…'
                        : 'Activating…'
                      : id
                        ? `Klaim ${board.proRewardDays} Hari Pro`
                        : `Claim ${board.proRewardDays} Days Pro`}
                  </button>
                )}
              </div>

              {renderGroup('starter', id ? 'Mulai' : 'Get started')}
              {renderGroup('growth', id ? 'Koleksi & Market' : 'Collector & Market')}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
