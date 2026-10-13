'use client';

import {useEffect,useState} from 'react';
import {BugBeetleIcon as Bug,CheckCircleIcon as Check} from '@phosphor-icons/react';
import {authClient} from '@/lib/auth-client';
import {TurnstileField,turnstileEnabled,turnstileHeaders} from './turnstile-field';

type Category='bug'|'missing-card'|'missing-printing'|'card-data'|'rules'|'market-report'|'feedback';
const categories:Array<{id:Category;label:string}>= [{id:'bug',label:'Bug report'},{id:'missing-card',label:'Missing card'},{id:'missing-printing',label:'Missing printing or alternate art'},{id:'card-data',label:'Incorrect card data or effect'},{id:'rules',label:'Rules or effect resolution'},{id:'market-report',label:'Report a listing or seller'},{id:'feedback',label:'General feedback'}];

type CardOption={cardCode:string;printingId:string;label:string};

export function FeedbackForm({initialCategory,cardCode='',printingId='',listingId='',cardOptions=[],sourcePath}:{initialCategory?:string;cardCode?:string;printingId?:string;listingId?:string;cardOptions?:CardOption[];sourcePath?:string}){
  const category=categories.some(item=>item.id===initialCategory)?initialCategory as Category:'bug';
  const sessionState=authClient.useSession();
  const sessionEmail=sessionState.data?.user?.email??'';
  const [values,setValues]=useState({category,summary:'',details:'',cardCode,printingId,listingId,email:sessionEmail,website:''});const [busy,setBusy]=useState(false);const [submitted,setSubmitted]=useState(false);const [error,setError]=useState('');const [turnstileToken,setTurnstileToken]=useState('');const [turnstileResetKey,setTurnstileResetKey]=useState(0);
  useEffect(()=>{if(sessionEmail)setValues(current=>current.email?current:{...current,email:sessionEmail})},[sessionEmail]);
  const selectedCard=cardOptions.find(option=>option.printingId===values.printingId);
  const selectCard=(value:string)=>{const option=cardOptions.find(item=>item.printingId===value);setValues(current=>({...current,cardCode:option?.cardCode??'',printingId:option?.printingId??''}))};
  if(submitted)return <section className="feedback-confirmation" role="status"><Check size={22}/><div><strong>Thanks, we’ve got it.</strong><p>Your report is saved for review.</p></div></section>;
  return <form className="feedback-form" onSubmit={async event=>{event.preventDefault();if(turnstileEnabled&&!turnstileToken){setError('Complete the security check first.');return}setBusy(true);setError('');try{const response=await fetch('/api/feedback',{method:'POST',headers:{'content-type':'application/json',...turnstileHeaders(turnstileToken)},body:JSON.stringify({...values,pagePath:sourcePath??(window.location.pathname+window.location.search)})});const body=await response.json() as {error?:string};if(!response.ok)throw new Error(body.error??'We could not send your report.');setSubmitted(true)}catch(reason){setError(reason instanceof Error?reason.message:'We could not send your report. Please try again.')}finally{setTurnstileToken('');setTurnstileResetKey(value=>value+1);setBusy(false)}}}>
    <label>What should we review?<select value={values.category} onChange={event=>setValues({...values,category:event.target.value as Category})}>{categories.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <label>Short summary<input required minLength={4} maxLength={120} value={values.summary} onChange={event=>setValues({...values,summary:event.target.value})} placeholder="What happened?"/></label>
    <label>Details<textarea required minLength={10} maxLength={4000} rows={6} value={values.details} onChange={event=>setValues({...values,details:event.target.value})} placeholder="Include the steps or card details that will help us reproduce it."/></label>
    {cardOptions.length>1?<div className="feedback-card-context"><label>Card in this listing<select value={selectedCard?.printingId??''} onChange={event=>selectCard(event.target.value)}><option value="">Not specified</option>{cardOptions.map(option=><option key={option.printingId} value={option.printingId}>{option.label}</option>)}</select></label>{selectedCard&&<p className="feedback-card-identifiers"><span>Card code <b>{selectedCard.cardCode}</b></span><span>Printing ID <b>{selectedCard.printingId}</b></span></p>}</div>:cardOptions.length===1?<div className="feedback-card-context"><label>Card in this listing<input readOnly value={cardOptions[0].label}/></label><p className="feedback-card-identifiers"><span>Card code <b>{cardOptions[0].cardCode}</b></span><span>Printing ID <b>{cardOptions[0].printingId}</b></span></p></div>:<div className="feedback-context"><label>Card code, if relevant<input maxLength={40} value={values.cardCode} onChange={event=>setValues({...values,cardCode:event.target.value})} placeholder="e.g. OP02-013"/></label><label>Printing ID, if relevant<input maxLength={80} value={values.printingId} onChange={event=>setValues({...values,printingId:event.target.value})} placeholder="Optional"/></label></div>}
    <label>Email for a follow-up <span>(optional)</span><input type="email" maxLength={254} value={values.email} onChange={event=>setValues({...values,email:event.target.value})} placeholder="you@example.com"/></label>
    <label className="feedback-trap" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={event=>setValues({...values,website:event.target.value})}/></label>
    <TurnstileField onToken={setTurnstileToken} resetKey={turnstileResetKey}/>
    {error&&<p className="feedback-error" role="alert">{error}</p>}<button type="submit" disabled={busy}><Bug size={16}/>{busy?'Sending…':'Send report'}</button>
  </form>;
}
