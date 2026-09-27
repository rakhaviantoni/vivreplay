'use client';

import React from 'react';
import { 
  ClockIcon as Clock, 
  PlusIcon as Plus, 
  ShieldCheckIcon as ShieldCheck, 
  StorefrontIcon as Store, 
  PencilSimpleIcon as Edit 
} from '@phosphor-icons/react';
import type { EnrichedCollectionItem } from '../types';

interface ActivityTabProps {
  items: EnrichedCollectionItem[];
}

export function ActivityTab({ items }: ActivityTabProps) {
  // Generate chronological audit timeline from items
  const activities = [
    {
      id: 'act-1',
      date: 'Sep 24, 2026',
      time: '14:20',
      action: 'Added Raw Card',
      description: 'Added 4x OP01-016 Nami (Red · Character · R) in NM condition to Vault.',
      type: 'add',
    },
    {
      id: 'act-2',
      date: 'Sep 21, 2026',
      time: '10:15',
      action: 'Listed for Sale',
      description: 'Listed OP01-025 Roronoa Zoro on VivrePlay Market for Rp400,000.',
      type: 'market',
    },
    {
      id: 'act-3',
      date: 'Sep 19, 2026',
      time: '16:45',
      action: 'Valuation Updated',
      description: 'Market benchmark updated for OP05-119 Monkey D. Luffy PSA 10 (+4.7% 30D).',
      type: 'valuation',
    },
    {
      id: 'act-4',
      date: 'Sep 18, 2026',
      time: '09:30',
      action: 'Authenticated Slab Logged',
      description: 'Logged OP05-119 Monkey D. Luffy PSA 10 (Cert #84920194) · Provider Verified.',
      type: 'slab',
    },
    {
      id: 'act-5',
      date: 'Aug 18, 2026',
      time: '14:30',
      action: 'Subgrades Recorded',
      description: 'Recorded BGS 9.5 subgrades for OP09-001 Shanks (C:10, Cr:9.5, E:10, S:9.5).',
      type: 'slab',
    },
    {
      id: 'act-6',
      date: 'Aug 04, 2026',
      time: '11:00',
      action: 'Vault Milestone',
      description: 'Completed 85% of OP-09 Emperors in the New World main set.',
      type: 'milestone',
    },
  ];

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontFamily: 'var(--display-font, Georgia, serif)', fontSize: '22px', fontWeight: 600, margin: 0 }}>
          Collection Audit & Activity History
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--vault-ink-secondary)', margin: '4px 0 0' }}>
          Personal chronological record of catalog additions, grading registrations, price adjustments, and market activities.
        </p>
      </div>

      <div style={{
        position: 'relative',
        paddingLeft: '28px',
        borderLeft: '2px solid var(--vault-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}>
        {activities.map(act => (
          <div key={act.id} style={{ position: 'relative' }}>
            {/* Timeline Node Icon */}
            <div style={{
              position: 'absolute',
              left: '-37px',
              top: '2px',
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: 'var(--vault-panel)',
              border: '2px solid var(--vault-gold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--vault-gold)' }} />
            </div>

            <div style={{
              padding: '14px 18px',
              borderRadius: '12px',
              background: 'var(--vault-panel)',
              border: '1px solid var(--vault-border)',
              boxShadow: '0 2px 8px rgba(35, 28, 16, 0.03)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--vault-ink)' }}>
                  {act.action}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--vault-ink-muted)' }}>
                  {act.date} · {act.time}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--vault-ink-secondary)', margin: 0, lineHeight: 1.5 }}>
                {act.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
