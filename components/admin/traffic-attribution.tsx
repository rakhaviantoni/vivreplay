'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowClockwiseIcon as RefreshCw, ChartLineUpIcon as Chart } from '@phosphor-icons/react';

type Campaign = { source: string; medium: string; campaign: string; visits: number; visitors: number; new_users: number };
type Visit = { id: string; landing_path: string; referrer_origin: string | null; country_code: string | null; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; utm_term: string | null; utm_content: string | null; parameters: string; converted_at: string | null; created_at: string };
type Data = { summary: { visits: number; visitors: number; new_users: number }; sources: Campaign[]; countries: Array<{ country: string; visits: number; visitors: number; new_users: number }>; pages: Array<{ path: string; visits: number }>; recent: Visit[] };
const number = new Intl.NumberFormat('en-US');

async function fetchAttribution() {
  const response = await fetch('/api/admin/attribution', { cache: 'no-store' });
  const body = await response.json() as Data & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Unable to load attribution (${response.status}).`);
  return body;
}

function AttributionTable({ title, headers, children, empty }: { title: string; headers: string[]; children: React.ReactNode; empty: boolean }) {
  return (
    <section className="admin-attribution-section">
      <h2>{title}</h2>
      <div className="admin-attribution-table-wrap">
        <table>
          <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
          <tbody>{empty ? <tr><td className="admin-attribution-no-data" colSpan={headers.length}>No records yet.</td></tr> : children}</tbody>
        </table>
      </div>
    </section>
  );
}

export function TrafficAttribution() {
  const [data, setData] = useState<Data>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void fetchAttribution().then((result) => {
      if (active) setData(result);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Unable to load attribution.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await fetchAttribution());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load attribution.');
    } finally {
      setLoading(false);
    }
  }, []);

  const hasRows = Boolean(data && (data.recent.length || data.sources.length || data.countries.length || data.pages.length));

  return (
    <section className="admin-attribution" aria-labelledby="admin-attribution-title">
      <header className="admin-attribution-header">
        <div className="admin-attribution-heading">
          <Chart size={19} aria-hidden="true" />
          <span><h2 id="admin-attribution-title">Acquisition and campaign attribution</h2><small>Consented landing sessions and account conversions · country is inferred at the edge · raw visits are retained for 180 days</small></span>
        </div>
        <button className="admin-refresh" type="button" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />{loading ? 'Loading…' : 'Refresh'}
        </button>
      </header>

      {error && !data ? (
        <div className="admin-attribution-error" role="alert">
          <div><strong>Traffic data could not be loaded</strong><p>{error}</p></div>
          <button className="admin-refresh" type="button" onClick={() => void refresh()} disabled={loading}>Try again</button>
        </div>
      ) : loading && !data ? (
        <div className="admin-attribution-loading" role="status" aria-live="polite"><span className="admin-attribution-spinner" />Loading traffic data…</div>
      ) : data ? (
        <>
          {error && <p className="admin-attribution-stale" role="status">Refresh failed: {error} Showing the last loaded data.</p>}
          <div className="admin-attribution-stats">
            <article><span>Landing sessions · 90 days</span><strong>{number.format(data.summary.visits)}</strong></article>
            <article><span>Unique browser tabs</span><strong>{number.format(data.summary.visitors)}</strong></article>
            <article><span>New accounts attributed</span><strong>{number.format(data.summary.new_users)}</strong></article>
            <article><span>Session to account</span><strong>{data.summary.visitors ? `${((data.summary.new_users / data.summary.visitors) * 100).toFixed(1)}%` : '0%'}</strong></article>
          </div>
          {!hasRows && <p className="admin-attribution-empty">No consented visits have been recorded yet.</p>}
          <AttributionTable title="Channels, sources, and campaigns" headers={['Source', 'Medium', 'Campaign', 'Landing sessions', 'Unique tabs']} empty={!data.sources.length}>
            {data.sources.map((row, index) => <tr key={`${row.source}-${row.medium}-${row.campaign}-${index}`}><td>{row.source}</td><td>{row.medium}</td><td>{row.campaign}</td><td>{number.format(row.visits)}</td><td>{number.format(row.visitors)}</td></tr>)}
          </AttributionTable>
          <AttributionTable title="New users by source" headers={['Source', 'Medium', 'Campaign', 'Sessions', 'New accounts', 'Conversion']} empty={!data.sources.length}>
            {data.sources.map((row, index) => <tr key={`${row.source}-${row.medium}-${row.campaign}-${index}`}><td>{row.source}</td><td>{row.medium}</td><td>{row.campaign}</td><td>{number.format(row.visits)}</td><td>{number.format(row.new_users)}</td><td>{row.visitors ? `${((row.new_users / row.visitors) * 100).toFixed(1)}%` : '0%'}</td></tr>)}
          </AttributionTable>
          <AttributionTable title="New users by country" headers={['Country code', 'Visits', 'Browser sessions', 'New accounts']} empty={!data.countries.length}>
            {data.countries.map((row) => <tr key={row.country}><td>{row.country}</td><td>{number.format(row.visits)}</td><td>{number.format(row.visitors)}</td><td>{number.format(row.new_users)}</td></tr>)}
          </AttributionTable>
          <AttributionTable title="Landing pages" headers={['Landing page', 'Visits']} empty={!data.pages.length}>
            {data.pages.map((row) => <tr key={row.path}><td>{row.path}</td><td>{number.format(row.visits)}</td></tr>)}
          </AttributionTable>
          <AttributionTable title="Recent visits" headers={['Date', 'Source / medium', 'Campaign', 'Country', 'New account', 'Landing page', 'Referrer site', 'Other tags']} empty={!data.recent.length}>
            {data.recent.map((row) => {
              let extras = '';
              try {
                const params = JSON.parse(row.parameters) as Record<string, string>;
                extras = Object.entries(params).filter(([key]) => !['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].includes(key)).map(([key, value]) => `${key}=${value}`).join(' · ');
              } catch { /* Older visit rows can have empty or malformed optional tags. */ }
              return <tr key={row.id}><td>{new Date(`${row.created_at.replace(' ', 'T')}Z`).toLocaleString()}</td><td>{row.utm_source ?? '-'} / {row.utm_medium ?? '-'}</td><td>{row.utm_campaign ?? '-'}</td><td>{row.country_code ?? '-'}</td><td>{row.converted_at ? 'Yes' : '-'}</td><td>{row.landing_path}</td><td>{row.referrer_origin ?? '-'}</td><td>{extras || '-'}</td></tr>;
            })}
          </AttributionTable>
        </>
      ) : null}
    </section>
  );
}
