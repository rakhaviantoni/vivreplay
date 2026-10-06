'use client';

import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {
  WarningIcon as AlertTriangle,
  CheckCircleIcon as CheckCircle2,
  ChartLineUpIcon as ChartLineUp,
  DatabaseIcon as Database,
  EnvelopeSimpleIcon as EnvelopeSimple,
  ImageBrokenIcon as ImageOff,
  ArrowClockwiseIcon as RefreshCw,
  MagnifyingGlassIcon as Search,
  ShapesIcon as Shapes,
  SlidersHorizontalIcon as SlidersHorizontal,
  PulseIcon as Pulse,
  SignOutIcon as SignOut,
} from '@phosphor-icons/react';
import { MarketPolicyManager } from '@/components/admin/market-policy-manager';
import { MarketplaceManager } from '@/components/admin/marketplace-manager';
import { FeedbackInbox } from '@/components/admin/feedback-inbox';
import { TrafficAttribution } from '@/components/admin/traffic-attribution';
import { PayoutManager } from '@/components/admin/payout-manager';

type Health={generatedAt:string;summary:{identities:number;printings:number;sets:number;storedSmall:number;missingImages:number;missingCards:number;unrepresentedSets:number};missingImages:Array<{id:string;code:string;name:string;setCode:string;language:string;variant:string;reason:string}>;missingCards:Array<{code:string;name:string}>;sets:Array<{setCode:string;setName:string;total:number;stored:number;sourceMissing:number}>;unrepresentedSets:Array<{setCode:string;setName:string;kind:string}>};
type CoachRequest={id:string;actor_email:string|null;actor_subject:string|null;ip_address:string|null;user_agent:string|null;locale:string;model:string;question:string;leader_code:string|null;deck_size:number;candidate_count:number;response_text:string|null;status:string;error_code:string|null;duration_ms:number;created_at:string};
const number=new Intl.NumberFormat('en-US');

export function AdminDashboard(){
  const [section, setSection] = useState<'catalog' | 'policy' | 'marketplace' | 'feedback' | 'traffic' | 'payouts'>('catalog');
  const [data,setData]=useState<Health|null>(null);
  const [requests,setRequests]=useState<CoachRequest[]>([]);
  const [query,setQuery]=useState('');
  const [tab,setTab]=useState<'images'|'cards'|'sets'>('images');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  const load=()=>{
    setLoading(true);
    setError('');
    Promise.all([
      fetch('/api/admin/catalog-health',{cache:'no-store'}),
      fetch('/api/admin/ai-coach',{cache:'no-store'})
    ]).then(async([healthResponse,coachResponse])=>{
      const body=await healthResponse.json() as Health&{error?:string};
      if(!healthResponse.ok)throw new Error(body.error);
      setData(body);
      if(coachResponse.ok){
        const coach=await coachResponse.json() as {requests:CoachRequest[]};
        setRequests(coach.requests);
      }
    }).catch(reason=>setError(reason instanceof Error?reason.message:'Unable to load catalog health.')).finally(()=>setLoading(false));
  };

  useEffect(load,[]);

  const filteredImages=useMemo(()=>data?.missingImages.filter(item=>`${item.code} ${item.name} ${item.setCode} ${item.language}`.toLowerCase().includes(query.toLowerCase()))??[],[data,query]);
  const filteredCards=useMemo(()=>data?.missingCards.filter(item=>`${item.code} ${item.name}`.toLowerCase().includes(query.toLowerCase()))??[],[data,query]);
  const filteredSets=useMemo(()=>data?.sets.filter(item=>`${item.setCode} ${item.setName}`.toLowerCase().includes(query.toLowerCase()))??[],[data,query]);
  const coverage=data?Math.round(data.summary.storedSmall/data.summary.printings*1000)/10:0;

  return (
    <main className="page admin-health">
      <header className="admin-health-heading">
        <div>
          <p className="eyebrow">OPERATIONS & CONTROL</p>
          <h1>{section === 'catalog' ? 'Catalog health' : section === 'policy' ? 'Market Policy' : section === 'marketplace' ? 'Listings & sellers' : section === 'traffic' ? 'Campaign attribution' : section==='payouts'?'Payouts':'Feedback inbox'}</h1>
          <p>
            {section === 'catalog'
              ? 'Storage coverage and import gaps across the live One Piece catalog.'
              : section === 'policy' ? 'Dynamic listing lifespans, seller quotas, and retention rules.' : section === 'marketplace' ? 'Recent Market listings and the sellers behind them.' : section === 'traffic' ? 'UTM campaigns, landing pages, and referrals to VivrePlay.' : section==='payouts'?'Review seller withdrawal requests and record transfers.':'Card data reports, product feedback, and bug reports.'}
          </p>
        </div>

        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <button
            type="button"
            className="admin-refresh"
            onClick={() => setSection('catalog')}
            style={section === 'catalog' ? { background: '#2f493d', color: '#fff9ee', borderColor: '#2f493d' } : undefined}
          >
            <Pulse size={15}/>Catalog
          </button>
          <button
            type="button"
            className="admin-refresh"
            onClick={() => setSection('feedback')}
            style={section === 'feedback' ? { background: '#2f493d', color: '#fff9ee', borderColor: '#2f493d' } : undefined}
          >
            <AlertTriangle size={15}/>Feedback
          </button>
          <button type="button" className="admin-refresh" onClick={()=>setSection('traffic')} style={section==='traffic'?{background:'#2f493d',color:'#fff9ee',borderColor:'#2f493d'}:undefined}>
            <ChartLineUp size={15}/>Traffic
          </button>
          <button type="button" className="admin-refresh" onClick={()=>setSection('payouts')} style={section==='payouts'?{background:'#2f493d',color:'#fff9ee',borderColor:'#2f493d'}:undefined}>Payouts</button>
          <button
            type="button"
            className="admin-refresh"
            onClick={() => setSection('marketplace')}
            style={section === 'marketplace' ? { background: '#2f493d', color: '#fff9ee', borderColor: '#2f493d' } : undefined}
          >
            <Database size={15}/>Listings & sellers
          </button>
          <button
            type="button"
            className="admin-refresh"
            onClick={() => setSection('policy')}
            style={section === 'policy' ? { background: '#2f493d', color: '#fff9ee', borderColor: '#2f493d' } : undefined}
          >
            <SlidersHorizontal size={15}/>Market Policy
          </button>
          <Link href="/admin/emails" className="admin-refresh" style={{textDecoration:'none'}}>
            <EnvelopeSimple size={15}/>Emails
          </Link>
          <button type="button" className="admin-refresh" onClick={async()=>{await fetch('/api/admin/session',{method:'DELETE'});window.location.assign('/admin')}}>
            <SignOut size={15}/>Sign out
          </button>
          {section === 'catalog' && (
            <button type="button" className="admin-refresh" onClick={load} disabled={loading}>
              <RefreshCw size={15} className={loading?'spin':''}/>Refresh
            </button>
          )}
        </div>
      </header>

      {section === 'policy' ? (
        <MarketPolicyManager />
      ) : section === 'marketplace' ? (
        <MarketplaceManager />
      ) : section === 'feedback' ? (
        <FeedbackInbox />
      ) : section === 'traffic' ? (
        <TrafficAttribution />
      ) : section === 'payouts' ? (
        <PayoutManager />
      ) : (
        <>
          {error && <p className="admin-error">{error}</p>}
          {!data && loading ? (
            <div className="admin-health-skeleton" aria-label="Loading catalog health">
              <i/><i/><i/><i/>
            </div>
          ) : data && (
            <>
              <section className="admin-metrics">
                <div><Database size={18}/><span>Card identities</span><strong>{number.format(data.summary.identities)}</strong></div>
                <div><Shapes size={18}/><span>Printings</span><strong>{number.format(data.summary.printings)}</strong></div>
                <div className={data.summary.missingImages?'needs-attention':'healthy'}><ImageOff size={18}/><span>Images missing</span><strong>{number.format(data.summary.missingImages)}</strong></div>
                <div className={data.summary.missingCards||data.summary.unrepresentedSets?'needs-attention':'healthy'}><AlertTriangle size={18}/><span>Import gaps</span><strong>{number.format(data.summary.missingCards+data.summary.unrepresentedSets)}</strong></div>
              </section>

              <section className="admin-coverage">
                <div>
                  <div><p>Storage coverage</p><strong>{coverage}%</strong></div>
                  <i><b style={{width:`${coverage}%`}}/></i>
                  <small>{number.format(data.summary.storedSmall)} printings with an available image of {number.format(data.summary.printings)}</small>
                </div>
              </section>

              <section className="admin-workbench">
                <div className="admin-toolbar">
                  <div className="admin-tabs">
                    <button className={tab==='images'?'active':''} onClick={()=>setTab('images')}>Missing images <b>{number.format(data.summary.missingImages)}</b></button>
                    <button className={tab==='cards'?'active':''} onClick={()=>setTab('cards')}>Cards without printings <b>{number.format(data.summary.missingCards)}</b></button>
                    <button className={tab==='sets'?'active':''} onClick={()=>setTab('sets')}>Set coverage <b>{number.format(data.summary.sets)}</b></button>
                  </div>
                  <label><Search size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={tab==='sets'?'Filter sets':'Filter code or name'}/></label>
                </div>
                {tab==='images'&&<HealthTable headers={['Card','Set','Language','Printing','Issue']} rows={filteredImages.map(item=>[`${item.code} · ${item.name}`,item.setCode,item.language,item.variant,item.reason])}/>}
                {tab==='cards'&&<HealthTable headers={['Card','Identity']} rows={filteredCards.map(item=>[item.code,item.name])}/>}
                {tab==='sets'&&<><HealthTable headers={['Set','Printings','Stored','Coverage','No source']} rows={filteredSets.map(item=>[`${item.setCode} · ${item.setName}`,number.format(item.total),number.format(item.stored),`${item.total?Math.round(item.stored/item.total*100):0}%`,number.format(item.sourceMissing)])}/>{data.unrepresentedSets.length>0&&<div className="admin-unrepresented"><strong>Set records without printings</strong>{data.unrepresentedSets.map(item=><span key={item.setCode}>{item.setCode} · {item.setName}</span>)}</div>}</>}
              </section>

              <section className="admin-workbench admin-coach-log">
                <div className="admin-toolbar">
                  <div><p className="eyebrow">AI COACH</p><h2>Deck Coach requests</h2></div>
                  <span>{requests.length} latest requests</span>
                </div>
                <HealthTable headers={['When','Account','IP','Deck','Question','Model','Status','Time']} rows={requests.map(item=>[new Date(item.created_at).toLocaleString(),item.actor_email??item.actor_subject??'Anonymous',item.ip_address??'-',`${item.leader_code??'No leader'} · ${item.deck_size}/50`,item.question,item.model,item.status,item.duration_ms?`${item.duration_ms} ms`:'-'])}/>
              </section>

              <p className="admin-health-note"><CheckCircle2 size={14}/>Cards render through VivrePlay’s asset route. Original source URLs stay in provenance records only.</p>
            </>
          )}
        </>
      )}
    </main>
  );
}

function HealthTable({headers,rows}:{headers:string[];rows:string[][]}){
  return (
    <div className="admin-table-wrap">
      <table className="admin-health-table">
        <thead>
          <tr>{headers.map(header=><th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row,index)=><tr key={`${row[0]}-${index}`}>{row.map((cell,column)=><td key={column}>{cell}</td>)}</tr>)}
          {!rows.length&&<tr><td colSpan={headers.length}>No records match this filter.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
