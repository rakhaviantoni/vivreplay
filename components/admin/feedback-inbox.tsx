'use client';

import { useCallback, useEffect, useState } from 'react';

type Report = {
  id: string;
  category: string;
  summary: string;
  details: string;
  card_code: string | null;
  printing_id: string | null;
  listing_id: string | null;
  page_path: string;
  contact_email: string | null;
  status: string;
  created_at: string;
};

async function fetchReports() {
  const response = await fetch('/api/admin/feedback', { cache: 'no-store' });
  const body = await response.json() as { reports?: Report[]; error?: string };
  if (!response.ok) throw new Error(body.error ?? 'Could not load feedback.');
  return body.reports ?? [];
}

export function FeedbackInbox() {
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void fetchReports().then((items) => {
      if (active) setReports(items);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Could not load feedback.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setReports(await fetchReports());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load feedback.');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <section className="admin-workbench">
      <div className="admin-toolbar">
        <div><p className="eyebrow">COMMUNITY REPORTS</p><h2>Feedback inbox</h2></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>{reports.length} recent</span>
          <button type="button" className="admin-refresh" onClick={() => void load()} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>
      {error ? (
        <div role="alert" className="admin-error">
          <p>{error}</p>
          <button type="button" className="admin-refresh" onClick={() => void load()} disabled={loading}>Try again</button>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-health-table">
            <thead><tr>{['When', 'Type', 'Summary', 'Card or listing', 'Page', 'Contact', 'Details'].map((item) => <th key={item}>{item}</th>)}</tr></thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>{new Date(report.created_at).toLocaleString()}</td>
                  <td>{report.category}</td>
                  <td>{report.summary}</td>
                  <td>{report.card_code ?? report.listing_id ?? '-'}{report.printing_id && <small style={{ display: 'block', opacity: .65 }}>{report.printing_id}</small>}</td>
                  <td>{report.page_path}</td>
                  <td>{report.contact_email ?? '-'}</td>
                  <td>{report.details}</td>
                </tr>
              ))}
              {!loading && !reports.length && <tr><td colSpan={7}>No reports have been submitted.</td></tr>}
              {loading && !reports.length && <tr><td colSpan={7}>Loading feedback…</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
