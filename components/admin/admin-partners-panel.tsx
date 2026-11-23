'use client';

import {useCallback,useEffect,useState} from 'react';
import {CheckCircleIcon as Check,XCircleIcon as Reject,WhatsappLogoIcon as WhatsApp} from '@phosphor-icons/react';
import {toast} from 'sonner';

interface PartnerRequestRow{
  id:string;
  profileId:string|null;
  shopName:string;
  socialHandle:string;
  category:string;
  city:string;
  monthlyVolume:string|null;
  contactWhatsapp:string;
  notes:string|null;
  requestType:string;
  aiScore:number|null;
  aiRisk:string|null;
  aiSummary:string|null;
  socialMetrics:string|null;
  status:string;
  createdAt:string;
}

function whatsappHref(raw:string){
  const digits=raw.replace(/\D/g,'');
  const normalized=digits.startsWith('0')?`62${digits.slice(1)}`:digits;
  return `https://wa.me/${normalized}`;
}

export function AdminPartnersPanel(){
  const [rows,setRows]=useState<PartnerRequestRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [busyId,setBusyId]=useState('');

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const response=await fetch('/api/admin/partners',{cache:'no-store'});
      const data=await response.json() as {requests?:PartnerRequestRow[];error?:string};
      if(!response.ok)throw new Error(data.error||'Unable to load partner requests.');
      setRows(data.requests??[]);
    }catch(error){
      toast.error(error instanceof Error?error.message:'Unable to load partner requests.');
    }finally{
      setLoading(false);
    }
  },[]);

  useEffect(()=>{void load()},[load]);

  async function decide(id:string,status:'APPROVED'|'REJECTED'){
    setBusyId(id);
    try{
      const response=await fetch('/api/admin/partners',{
        method:'PATCH',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({id,status}),
      });
      const data=await response.json() as {error?:string};
      if(!response.ok)throw new Error(data.error||'Could not update request.');
      setRows(current=>current.map(row=>row.id===id?{...row,status}:row));
      toast.success(status==='APPROVED'?'Partner application approved.':'Partner application rejected.');
    }catch(error){
      toast.error(error instanceof Error?error.message:'Could not update request.');
    }finally{
      setBusyId('');
    }
  }

  return (
    <section className="admin-partners-panel">
      <div className="admin-section-head">
        <div>
          <h2>Partner &amp; Social Early-Access Applications</h2>
          <p>AI pre-screened partner, consignment, and social auto-post early-access submissions.</p>
        </div>
        <button type="button" className="button secondary" onClick={()=>void load()} disabled={loading}>
          {loading?'Refreshing...':'Refresh'}
        </button>
      </div>
      {loading&&!rows.length?<p>Loading partner applications...</p>:!rows.length?<p>No partner applications yet.</p>:(
        <div className="admin-partner-grid">
          {rows.map(row=>{
            let connected:Array<{platform:string;handle:string}>=[];
            if(row.socialMetrics){
              try{connected=JSON.parse(row.socialMetrics) as typeof connected}catch{}
            }
            return (
              <article key={row.id} className="admin-partner-card">
                <div className="admin-partner-card-top">
                  <div>
                    <strong>{row.shopName}</strong>
                    <span>{row.socialHandle} / {row.city}</span>
                  </div>
                  <div className="admin-partner-badges">
                    {row.aiScore!==null&&<span className="admin-partner-score">AI Score: {row.aiScore}/100 ({row.aiRisk||'MEDIUM'})</span>}
                    <span className={`admin-partner-status is-${row.status.toLowerCase()}`}>{row.status}</span>
                  </div>
                </div>
                <p className="admin-partner-meta">Program: {row.requestType} | Category: {row.category} | Volume: {row.monthlyVolume||'N/A'}</p>
                {row.aiSummary&&<p className="admin-partner-ai-summary">{row.aiSummary}</p>}
                {connected.length>0&&<p className="admin-partner-socials">Connected: {connected.map(c=>`${c.platform} (${c.handle})`).join(', ')}</p>}
                {row.notes&&<p className="admin-partner-notes">“{row.notes}”</p>}
                <div className="admin-partner-actions">
                  <a className="button secondary" href={whatsappHref(row.contactWhatsapp)} target="_blank" rel="noreferrer">
                    <WhatsApp size={16}/>
                    <span>WhatsApp ({row.contactWhatsapp})</span>
                  </a>
                  {row.status==='PENDING'&&(
                    <>
                      <button type="button" className="button" disabled={busyId===row.id} onClick={()=>void decide(row.id,'APPROVED')}>
                        <Check size={16}/>
                        <span>Approve</span>
                      </button>
                      <button type="button" className="button secondary" disabled={busyId===row.id} onClick={()=>void decide(row.id,'REJECTED')}>
                        <Reject size={16}/>
                        <span>Reject</span>
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
