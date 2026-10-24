'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import {
  WarningIcon as AlertTriangle,
  CheckCircleIcon as CheckCircle2,
  DatabaseIcon as Database,
  ImageBrokenIcon as ImageOff,
  ArrowClockwiseIcon as RefreshCw,
  MagnifyingGlassIcon as Search,
  ShapesIcon as Shapes,
} from '@phosphor-icons/react';
import { MarketPolicyManager } from '@/components/admin/market-policy-manager';
import { PaymentMethodsManager } from '@/components/admin/payment-methods-manager';
import { MarketplaceManager } from '@/components/admin/marketplace-manager';
import { FeedbackInbox } from '@/components/admin/feedback-inbox';
import { TrafficAttribution } from '@/components/admin/traffic-attribution';
import { PayoutManager } from '@/components/admin/payout-manager';
import { MarketDisputesManager } from '@/components/admin/market-disputes-manager';
import { AdminCustomerManager, AdminOverview } from '@/components/admin/admin-overview';
import { ProviderOperations } from '@/components/admin/provider-operations';
import { PokemonCatalogStatus } from '@/components/admin/pokemon-catalog-status';

type Health={generatedAt:string;summary:{identities:number;printings:number;sets:number;storedSmall:number;missingImages:number;missingCards:number;unrepresentedSets:number};missingImages:Array<{id:string;code:string;name:string;setCode:string;language:string;variant:string;reason:string}>;missingCards:Array<{code:string;name:string}>;sets:Array<{setCode:string;setName:string;total:number;stored:number;sourceMissing:number}>;unrepresentedSets:Array<{setCode:string;setName:string;kind:string}>};
type CoachRequest={id:string;actor_email:string|null;actor_subject:string|null;ip_address:string|null;user_agent:string|null;locale:string;model:string;question:string;leader_code:string|null;deck_size:number;candidate_count:number;response_text:string|null;status:string;error_code:string|null;duration_ms:number;created_at:string};
const number=new Intl.NumberFormat('en-US');

type Section='overview'|'customers'|'catalog'|'policy'|'payments'|'marketplace'|'feedback'|'traffic'|'payouts'|'disputes'|'operations';
export function AdminDashboard({initialSection='overview'}:{initialSection?:Section}){
  const section=initialSection;
  const [data,setData]=useState<Health|null>(null);
  const [requests,setRequests]=useState<CoachRequest[]>([]);
  const [query,setQuery]=useState('');
  const [tab,setTab]=useState<'images'|'cards'|'sets'|'unrepresented'>('images');
  const [catalogGame,setCatalogGame]=useState<'one-piece'|'pokemon'>('one-piece');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  const load=useCallback(()=>{
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
  },[]);

  useEffect(()=>{if(section==='catalog'&&catalogGame==='one-piece')load()},[section,load,catalogGame]);

  const filteredImages=useMemo(()=>data?.missingImages.filter(item=>`${item.code} ${item.name} ${item.setCode} ${item.language}`.toLowerCase().includes(query.toLowerCase()))??[],[data,query]);
  const filteredCards=useMemo(()=>data?.missingCards.filter(item=>`${item.code} ${item.name}`.toLowerCase().includes(query.toLowerCase()))??[],[data,query]);
  const filteredSets=useMemo(()=>data?.sets.filter(item=>`${item.setCode} ${item.setName}`.toLowerCase().includes(query.toLowerCase()))??[],[data,query]);
  const filteredUnrepresentedSets=useMemo(()=>data?.unrepresentedSets.filter(item=>`${item.setCode} ${item.setName} ${item.kind}`.toLowerCase().includes(query.toLowerCase()))??[],[data,query]);
  const coverage=data?Math.round(data.summary.storedSmall/data.summary.printings*1000)/10:0;

  return (
    <main className="page admin-health">
      <header className="admin-health-heading">
        <div>
          <p className="eyebrow">OPERATIONS & CONTROL</p>
          <h1>{section === 'overview' ? 'Dashboard' : section === 'customers' ? 'Customers' : section === 'catalog' ? 'Catalog health' : section === 'policy' ? 'Market Policy' : section === 'payments' ? 'Payment methods' : section === 'marketplace' ? 'Listings & sellers' : section === 'traffic' ? 'Campaign attribution' : section==='payouts'?'Payouts':section==='disputes'?'Order reports':section==='operations'?'Payments and delivery':'Feedback inbox'}</h1>
          <p>
            {section === 'overview'
              ? 'Accounts, paid orders, and sales activity.'
              : section === 'customers' ? 'Search accounts and check membership details.'
              : section === 'catalog'
              ? catalogGame==='pokemon'?'Pokémon card printings and image status.':'One Piece card printings, image status, and set coverage.'
              : section === 'policy' ? 'Dynamic listing lifespans, seller quotas, and retention rules.' : section === 'payments' ? 'Choose which iPaymu payment channels buyers can use for Market orders and Pro.' : section === 'marketplace' ? 'Recent Market listings and the sellers behind them.' : section === 'traffic' ? 'UTM campaigns, landing pages, and referrals to VivrePlay.' : section==='payouts'?'Review seller withdrawal requests and record transfers.':section==='disputes'?'Review buyer evidence, seller responses, and order outcomes.':section==='operations'?'Provider balances, payments, and shipment status.':'Card data reports, product feedback, and bug reports.'}
          </p>
        </div>

        {section==='catalog'&&<button type="button" className="admin-refresh" onClick={()=>{setLoading(true);setError('');load()}} disabled={loading}><RefreshCw size={15} className={loading?'spin':''}/>Refresh</button>}
      </header>

      {section === 'overview' ? (
        <AdminOverview />
      ) : section === 'customers' ? (
        <AdminCustomerManager />
      ) : section === 'policy' ? (
        <MarketPolicyManager />
      ) : section === 'payments' ? (
        <PaymentMethodsManager />
      ) : section === 'operations' ? (
        <ProviderOperations />
      ) : section === 'marketplace' ? (
        <MarketplaceManager />
      ) : section === 'feedback' ? (
        <FeedbackInbox />
      ) : section === 'traffic' ? (
        <TrafficAttribution />
      ) : section === 'payouts' ? (
        <PayoutManager />
      ) : section === 'disputes' ? (
        <MarketDisputesManager />
      ) : (
        <>
          {section==='catalog'&&<div className="admin-catalog-game-tabs" role="tablist" aria-label="Card game catalog"><button type="button" role="tab" aria-selected={catalogGame==='one-piece'} className={catalogGame==='one-piece'?'active':''} onClick={()=>setCatalogGame('one-piece')}><img src="/assets/one-piece-card-game-logo.png" alt="One Piece Card Game"/></button><button type="button" role="tab" aria-selected={catalogGame==='pokemon'} className={catalogGame==='pokemon'?'active':''} onClick={()=>setCatalogGame('pokemon')}><img className="pokemon-logo-navbar" src="https://upload.wikimedia.org/wikipedia/commons/1/1a/Pok%C3%A9mon_Trading_Card_Game_logo.svg" alt="Pokémon Trading Card Game"/></button></div>}
          {section==='catalog'&&catalogGame==='pokemon'?<PokemonCatalogStatus/>:<>
          {error && <p className="admin-error">{error}</p>}
          {!data && loading ? (
            <div className="admin-health-skeleton" aria-label="Loading catalog health">
              <i/><i/><i/><i/>
            </div>
          ) : data && (
            <>
              <section className="admin-metrics admin-catalog-metrics">
                <div><Database size={18}/><span>Cards</span><strong>{number.format(data.summary.identities)}</strong></div>
                <div><Shapes size={18}/><span>Printings</span><strong>{number.format(data.summary.printings)}</strong></div>
                <div className={data.summary.missingImages?'needs-attention':'healthy'}><ImageOff size={18}/><span>Images missing</span><strong>{number.format(data.summary.missingImages)}</strong></div>
                <div className={data.summary.missingCards?'needs-attention':'healthy'}><AlertTriangle size={18}/><span>Cards without printings</span><strong>{number.format(data.summary.missingCards)}</strong></div>
                <div className={data.summary.unrepresentedSets?'needs-attention':'healthy'}><Shapes size={18}/><span>Sets without printings</span><strong>{number.format(data.summary.unrepresentedSets)}</strong></div>
                <div className="admin-metric-coverage" aria-label={`${coverage}% of printings have a stored image`}>
                  <div><span>Images stored</span><strong>{coverage}%</strong></div>
                  <i><b style={{width:`${coverage}%`}}/></i>
                  <small>{number.format(data.summary.storedSmall)} of {number.format(data.summary.printings)} printings</small>
                </div>
              </section>

              <section className="admin-workbench">
                <div className="admin-toolbar">
                  <div className="admin-tabs">
                    <button className={tab==='images'?'active':''} onClick={()=>setTab('images')}>Missing images <b>{number.format(data.summary.missingImages)}</b></button>
                    <button className={tab==='cards'?'active':''} onClick={()=>setTab('cards')}>Cards without printings <b>{number.format(data.summary.missingCards)}</b></button>
                    <button className={tab==='sets'?'active':''} onClick={()=>setTab('sets')}>Set coverage <b>{number.format(data.summary.sets)}</b></button>
                    <button className={tab==='unrepresented'?'active':''} onClick={()=>setTab('unrepresented')}>Sets without printings <b>{number.format(data.summary.unrepresentedSets)}</b></button>
                  </div>
                  <label><Search size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={tab==='sets'?'Filter sets':'Filter code or name'}/></label>
                </div>
                {tab==='images'&&<HealthTable headers={['Card','Set','Language','Printing','Issue']} rows={filteredImages.map(item=>[`${item.code} / ${item.name}`,item.setCode,item.language,item.variant,item.reason])}/>}
                {tab==='cards'&&<HealthTable headers={['Card','Identity']} rows={filteredCards.map(item=>[item.code,item.name])}/>}
                {tab==='sets'&&<HealthTable headers={['Set','Printings','Stored','Coverage','No image']} rows={filteredSets.map(item=>[`${item.setCode} / ${item.setName}`,number.format(item.total),number.format(item.stored),`${item.total?Math.round(item.stored/item.total*100):0}%`,number.format(item.sourceMissing)])}/>}
                {tab==='unrepresented'&&<HealthTable headers={['Set','Name','Type']} rows={filteredUnrepresentedSets.map(item=>[item.setCode,item.setName,item.kind])}/>}
              </section>

              <section className="admin-workbench admin-coach-log">
                <div className="admin-toolbar">
                  <div><p className="eyebrow">AI COACH</p><h2>Deck Coach requests</h2></div>
                  <span>{requests.length} latest requests</span>
                </div>
                <HealthTable headers={['When','Account','IP','Deck','Question','Model','Status','Time']} rows={requests.map(item=>[new Date(item.created_at).toLocaleString(),item.actor_email??item.actor_subject??'Anonymous',item.ip_address??'-',`${item.leader_code??'No leader'} / ${item.deck_size}/50`,item.question,item.model,item.status,item.duration_ms?`${item.duration_ms} ms`:'-'])}/>
              </section>

              <p className="admin-health-note"><CheckCircle2 size={14}/>Cards render through VivrePlay’s asset route. Original source URLs stay in provenance records only.</p>
            </>
          )}
          </>}
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
