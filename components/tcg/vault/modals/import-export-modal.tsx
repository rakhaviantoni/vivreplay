'use client';

import React, { useState } from 'react';
import { 
  XIcon as X, 
  DownloadSimpleIcon as Download, 
  UploadSimpleIcon as Upload, 
  CheckCircleIcon as CheckCircle, 
  WarningCircleIcon as AlertCircle, 
  FileTextIcon as FileText 
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { cards, printings } from '@/packages/card-data/catalog';
import { api } from '@/lib/client';
import type { EnrichedCollectionItem } from '../types';

interface ImportExportModalProps {
  open: boolean;
  onClose: () => void;
  items: EnrichedCollectionItem[];
  onImportComplete: () => Promise<void> | void;
}

export function ImportExportModal({
  open,
  onClose,
  items,
  onImportComplete,
}: ImportExportModalProps) {
  const [tab, setTab] = useState<'export' | 'import'>('export');
  const [importText, setImportText] = useState('');
  const [parsedPreview, setParsedPreview] = useState<{
    recognized: Array<{ code: string; name: string; type: string; condition: string; qty: number; printingId: string }>;
    unrecognized: Array<{ line: string; reason: string }>;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  // Handle CSV / JSON Export
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(items, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `vivreplay-vault-${new Date().toISOString().slice(0, 10)}.json`);
    dlAnchorElem.click();
    toast.success('Collection exported to JSON');
  };

  const handleExportCSV = () => {
    const headers = ['id', 'cardCode', 'cardName', 'type', 'quantity', 'condition', 'provider', 'grade', 'certification', 'cost', 'currency', 'acquiredAt', 'notes'];
    const rows = items.map(i => [
      i.id,
      i.card.code,
      `"${i.card.name.replaceAll('"', '""')}"`,
      i.type,
      i.quantity,
      i.condition,
      i.provider || '',
      i.grade || '',
      i.certification || '',
      i.acquisitionAmount || 0,
      i.currency || 'IDR',
      i.acquiredAt || '',
      `"${(i.notes || '').replaceAll('"', '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `vivreplay-vault-${new Date().toISOString().slice(0, 10)}.csv`);
    link.click();
    toast.success('Collection exported to CSV');
  };

  // Preview Import Text
  const handleParseImport = () => {
    if (!importText.trim()) return;
    const lines = importText.trim().split('\n');
    const recognized: Array<{ code: string; name: string; type: string; condition: string; qty: number; printingId: string }> = [];
    const unrecognized: Array<{ line: string; reason: string }> = [];

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.toLowerCase().startsWith('code')) return;

      // Try CSV format or simple text format e.g. "OP05-119, 1, NM" or "OP01-025 x4"
      const parts = trimmed.split(/,|\t/);
      const codeCandidate = parts[0]?.trim().toUpperCase().replace(/\s+/g, '');
      const card = cards.find(c => c.code.toUpperCase().replace(/\s+/g, '') === codeCandidate);

      if (card) {
        const qty = parseInt(parts[1]?.replace(/[^\d]/g, '') || '1') || 1;
        const condition = (parts[2]?.trim().toUpperCase() || 'NM');
        const printing = printings.find(p => p.cardId === card.id) || printings[0];
        recognized.push({
          code: card.code,
          name: card.name,
          type: 'RAW',
          condition: ['NM', 'LP', 'MP', 'HP', 'DMG'].includes(condition) ? condition : 'NM',
          qty,
          printingId: printing.id,
        });
      } else {
        unrecognized.push({
          line: trimmed,
          reason: `No card identity matches code "${parts[0]?.trim()}".`,
        });
      }
    });

    setParsedPreview({ recognized, unrecognized });
  };

  const handleConfirmImport = async () => {
    if (!parsedPreview || !parsedPreview.recognized.length) return;
    setBusy(true);
    try {
      for (const item of parsedPreview.recognized) {
        await api('/api/collection', {
          printingId: item.printingId,
          type: item.type,
          quantity: item.qty,
          condition: item.condition,
          visibility: 'private',
          acquisitionAmount: 0,
          currency: 'IDR',
          acquiredAt: new Date().toISOString(),
          notes: 'Batch imported into Vault',
        });
      }
      toast.success(`Successfully imported ${parsedPreview.recognized.length} cards into your Vault`);
      await onImportComplete();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 160,
      background: 'rgba(10, 12, 16, 0.75)',
      backdropFilter: 'blur(7px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '600px',
        maxHeight: '92vh',
        overflowY: 'auto',
        borderRadius: '18px',
        background: 'var(--vault-panel)',
        border: '1px solid var(--vault-border)',
        boxShadow: '0 28px 70px rgba(0, 0, 0, 0.35)',
        padding: '26px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--vault-gold)', textTransform: 'uppercase' }}>
              Collection Data Portability & Safety
            </span>
            <h3 style={{ fontFamily: 'var(--display-font, Georgia, serif)', fontSize: '22px', fontWeight: 600, margin: '2px 0 0' }}>
              Import & Export Archive
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vault-ink-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Switcher: Export vs Import */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
          <button
            type="button"
            className={`vault-btn ${tab === 'export' ? 'vault-btn-primary' : 'vault-btn-secondary'}`}
            style={{ height: '36px', justifyContent: 'center' }}
            onClick={() => setTab('export')}
          >
            <Download size={15} />
            Export Data
          </button>
          <button
            type="button"
            className={`vault-btn ${tab === 'import' ? 'vault-btn-primary' : 'vault-btn-secondary'}`}
            style={{ height: '36px', justifyContent: 'center' }}
            onClick={() => setTab('import')}
          >
            <Upload size={15} />
            Import Collection
          </button>
        </div>

        {/* Export Tab */}
        {tab === 'export' && (
          <div>
            <p style={{ fontSize: '12.5px', color: 'var(--vault-ink-secondary)', lineHeight: 1.5, marginBottom: '18px' }}>
              Your collection data belongs to you. Export your complete archive including printing references, grades, certifications, acquisition costs, and notes.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 18px',
                borderRadius: '12px',
                background: 'var(--vault-slot-bg)',
                border: '1px solid var(--vault-border)',
              }}>
                <div>
                  <strong style={{ fontSize: '13px', display: 'block' }}>JSON Structured Backup</strong>
                  <span style={{ fontSize: '11px', color: 'var(--vault-ink-muted)' }}>
                    Full fidelity backup with subgrades and timestamps ({items.length} items)
                  </span>
                </div>
                <button
                  type="button"
                  className="vault-btn vault-btn-primary"
                  onClick={handleExportJSON}
                >
                  <Download size={15} />
                  Export JSON
                </button>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 18px',
                borderRadius: '12px',
                background: 'var(--vault-slot-bg)',
                border: '1px solid var(--vault-border)',
              }}>
                <div>
                  <strong style={{ fontSize: '13px', display: 'block' }}>CSV Spreadsheet Export</strong>
                  <span style={{ fontSize: '11px', color: 'var(--vault-ink-muted)' }}>
                    Standard tabular format compatible with Excel and Google Sheets
                  </span>
                </div>
                <button
                  type="button"
                  className="vault-btn vault-btn-secondary"
                  onClick={handleExportCSV}
                >
                  <FileText size={15} />
                  Export CSV
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import Tab */}
        {tab === 'import' && (
          <div>
            <p style={{ fontSize: '12.5px', color: 'var(--vault-ink-secondary)', lineHeight: 1.5, marginBottom: '14px' }}>
              Import cards via CSV or batch code entry (e.g. <code>OP05-119, 1, NM</code>). Cards are previewed before saving; ambiguous entries will never be silently mapped.
            </p>

            {!parsedPreview ? (
              <div>
                <textarea
                  rows={6}
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  placeholder={`Paste CSV rows or card codes:\nOP05-119, 1, NM\nOP01-025, 4, NM\nOP09-001, 1, NM`}
                  className="vault-select-compact"
                  style={{ width: '100%', height: 'auto', padding: '10px 12px', fontFamily: 'var(--font-mono, monospace)', fontSize: '11.5px', marginBottom: '12px' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    className="vault-btn vault-btn-secondary"
                    onClick={() => setImportText('OP05-119, 1, NM\nOP01-025, 4, NM\nOP09-001, 1, NM\nOP02-004, 1, NM')}
                  >
                    Load Sample Batch
                  </button>
                  <button
                    type="button"
                    className="vault-btn vault-btn-primary"
                    disabled={!importText.trim()}
                    onClick={handleParseImport}
                  >
                    Preview Import
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {/* Preview Classification: Recognized vs Unrecognized */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                  <div style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'rgba(74, 222, 128, 0.1)',
                    border: '1px solid rgba(74, 222, 128, 0.3)',
                    color: '#2e8b57',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}>
                    <CheckCircle size={16} weight="fill" />
                    {parsedPreview.recognized.length} Recognized
                  </div>

                  {parsedPreview.unrecognized.length > 0 && (
                    <div style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#c0392b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}>
                      <AlertCircle size={16} weight="fill" />
                      {parsedPreview.unrecognized.length} Needs Review
                    </div>
                  )}
                </div>

                <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '16px' }}>
                  {parsedPreview.recognized.map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--vault-border-light)', fontSize: '11.5px' }}>
                      <span><b>{item.code}</b> · {item.name}</span>
                      <span style={{ color: 'var(--vault-ink-muted)' }}>{item.qty}x ({item.condition})</span>
                    </div>
                  ))}
                  {parsedPreview.unrecognized.map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: '#c0392b', fontSize: '11px' }}>
                      <span>&ldquo;{item.line}&rdquo;</span>
                      <span>{item.reason}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    className="vault-btn vault-btn-secondary"
                    onClick={() => setParsedPreview(null)}
                    disabled={busy}
                  >
                    Edit Input
                  </button>
                  <button
                    type="button"
                    className="vault-btn vault-btn-primary"
                    disabled={busy || parsedPreview.recognized.length === 0}
                    onClick={handleConfirmImport}
                  >
                    {busy ? 'Importing...' : `Confirm Import (${parsedPreview.recognized.length} Cards)`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
