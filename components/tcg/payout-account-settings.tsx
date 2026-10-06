'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {BankIcon,FloppyDiskIcon,PlusIcon,TrashIcon,PencilSimpleIcon} from '@phosphor-icons/react';
import {toast} from 'sonner';
import {api} from '@/lib/client';
import {Picker} from './catalog';

type Account={id:string;bankName:string;accountHolder:string;lastFour:string;isDefault:boolean};
type PayoutState={earned:number;reserved:number;available:number;defaultBankAccountId:string|null;minimumPayout:number;requests:Array<{id:string;amount:number;currency:string;status:string;transactionReference:string|null;failureReason:string|null;createdAt:string}>};
const empty={bankName:'',accountHolder:'',accountNumber:'',makeDefault:false};
export function PayoutAccountSettings({language}:{language:'EN'|'ID'}){
  const t=(en:string,id:string)=>language==='ID'?id:en;
  const [accounts,setAccounts]=useState<Account[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [editing,setEditing]=useState<string|null>(null);
  const [showForm,setShowForm]=useState(false);
  const [confirmDelete,setConfirmDelete]=useState<string|null>(null);
  const [form,setForm]=useState(empty);
  const [customBank,setCustomBank]=useState('');
  const [payout,setPayout]=useState<PayoutState|null>(null);
  const [payoutAmount,setPayoutAmount]=useState('');
  const [payoutBankId,setPayoutBankId]=useState('');
  const [payoutBusy,setPayoutBusy]=useState(false);

  const load=async()=>{
    setError('');
    try{const [result,payoutState]=await Promise.all([api<{accounts:Account[]}>('/api/profile/bank-accounts'),api<PayoutState>('/api/profile/payouts')]);setAccounts(result.accounts);setPayout(payoutState);setPayoutBankId(current=>result.accounts.some(account=>account.id===current)?current:payoutState.defaultBankAccountId||result.accounts.find(account=>account.isDefault)?.id||result.accounts[0]?.id||'');setPayoutAmount(current=>current||String(payoutState.available||''));}
    catch{setError(t('Bank accounts could not load. Please try again.','Rekening bank belum dapat dimuat. Coba lagi.'));}
    finally{setLoading(false);}
  };
  const requestPayout=async(event:FormEvent)=>{
    event.preventDefault();if(!payoutBankId)return;setPayoutBusy(true);setError('');
    try{await api('/api/profile/payouts',{bankAccountId:payoutBankId,amount:Number(payoutAmount)});toast.success(t('Withdrawal request sent','Permintaan pencairan dikirim'));setPayoutAmount('');await load();}
    catch(error){setError(error instanceof Error?error.message:t('Withdrawal request could not be sent','Permintaan pencairan gagal dikirim'));}
    finally{setPayoutBusy(false);}
  };
  useEffect(()=>{void load();},[]);

  const save=async(event:FormEvent)=>{
    event.preventDefault();setBusy(true);setError('');
    try{
      await api('/api/profile/bank-accounts',{id:editing??undefined,bankName:form.bankName==='Other'?customBank:form.bankName,accountHolder:form.accountHolder,accountNumber:form.accountNumber||undefined,makeDefault:form.makeDefault});
      await load();setShowForm(false);setEditing(null);setForm(empty);setCustomBank('');
      toast.success(t('Bank account saved','Rekening bank disimpan'));
    }catch{setError(t('Bank account could not be saved. Check the details and try again.','Rekening bank gagal disimpan. Periksa datanya dan coba lagi.'));}
    finally{setBusy(false);}
  };
  const update=async(account:Account,method:'PATCH'|'DELETE')=>{
    setBusy(true);setError('');
    try{
      await api('/api/profile/bank-accounts',{id:account.id},method);
      if(editing===account.id){setEditing(null);setShowForm(false);setForm(empty);}
      setConfirmDelete(null);await load();
      toast.success(method==='DELETE'?t('Bank account removed','Rekening bank dihapus'):t('Default bank account updated','Rekening utama diperbarui'));
    }catch{setError(t('The change could not be saved. Please try again.','Perubahan gagal disimpan. Coba lagi.'));}
    finally{setBusy(false);}
  };
  const startEdit=(account:Account)=>{
    const known=['BCA','Mandiri','BRI','BNI','BSI','CIMB Niaga','Permata','Danamon','BTPN','SeaBank'];
    const isKnown=known.includes(account.bankName);
    setEditing(account.id);setForm({bankName:isKnown?account.bankName:'Other',accountHolder:account.accountHolder,accountNumber:'',makeDefault:account.isDefault});setCustomBank(isKnown?'':account.bankName);setShowForm(true);setConfirmDelete(null);
  };

  return <div className="profile-tab-content payout-settings">
    <div className="profile-section-header"><h2><BankIcon size={20}/>{t('Bank accounts and withdrawals','Rekening bank dan pencairan')}</h2><p>{t('Manage the account where Market earnings will be sent.','Atur rekening tujuan hasil penjualan Market.')}</p><small>{t('Account details are private. Earnings become available after the buyer confirms delivery.','Data rekening bersifat pribadi. Saldo tersedia setelah pembeli mengonfirmasi pesanan diterima.')}</small></div>
    {payout&&<section className="payout-balance-panel" aria-labelledby="payout-balance-heading"><div className="payout-balance-summary"><div><h3 id="payout-balance-heading">{t('Available to withdraw','Saldo tersedia')}</h3><strong>{new Intl.NumberFormat(language==='ID'?'id-ID':'en-US',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(payout.available)}</strong><small>{t('After Market fees, from delivered orders','Setelah biaya Market, dari pesanan yang diterima')}</small></div><span>{t('Processing','Diproses')}: {new Intl.NumberFormat(language==='ID'?'id-ID':'en-US',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(payout.reserved)}</span></div>{accounts.length>0&&payout.available>=payout.minimumPayout&&<form className="payout-request-form" onSubmit={event=>void requestPayout(event)}><label>{t('Withdrawal amount (IDR)','Jumlah pencairan (IDR)')}<input type="number" inputMode="numeric" min={payout.minimumPayout} max={payout.available} step={1000} value={payoutAmount} onChange={event=>setPayoutAmount(event.target.value)}/></label><label>{t('Send to','Kirim ke')}<Picker value={payoutBankId} onChange={setPayoutBankId} label={t('Payout bank account','Rekening tujuan')} options={accounts.map(account=>({value:account.id,label:`${account.bankName} ·•••• ${account.lastFour}${account.isDefault?` (${t('Default','Utama')})`:''}`}))}/></label><button type="submit" className="button" disabled={payoutBusy||!payoutBankId||Number(payoutAmount)<payout.minimumPayout||Number(payoutAmount)>payout.available}>{payoutBusy?t('Sending…','Mengirim…'):t('Request withdrawal','Ajukan pencairan')}</button></form>}{payout.available>0&&payout.available<payout.minimumPayout&&<p className="payout-minimum-note">{t(`Withdrawals start at IDR ${payout.minimumPayout.toLocaleString('en-US')}.`,`Pencairan minimum Rp${payout.minimumPayout.toLocaleString('id-ID')}.`)}</p>}<div className="payout-request-list"><h4>{t('Withdrawal history','Riwayat pencairan')}</h4>{payout.requests.length?payout.requests.map(request=><article key={request.id}><div><strong>{new Intl.NumberFormat(language==='ID'?'id-ID':'en-US',{style:'currency',currency:request.currency,maximumFractionDigits:0}).format(request.amount)}</strong><small>{new Date(request.createdAt.replace(' ','T')+'Z').toLocaleDateString(language==='ID'?'id-ID':'en-US')}</small>{request.transactionReference&&<small>{t('Transfer reference','Referensi transfer')}: {request.transactionReference}</small>}{request.failureReason&&<small>{t('Reason','Alasan')}: {request.failureReason}</small>}</div><span className={`payout-status is-${request.status.toLowerCase()}`}>{({REQUESTED:t('Requested','Diajukan'),PROCESSING:t('Processing','Diproses'),PAID:t('Paid','Dibayar'),FAILED:t('Failed','Gagal')} as Record<string,string>)[request.status]??request.status}</span></article>):<p>{t('No withdrawal requests yet','Belum ada permintaan pencairan')}</p>}</div></section>}
    {loading?<div className="shipping-options-skeleton" role="status" aria-label={t('Loading bank accounts','Memuat rekening bank')}>{[0,1].map(index=><div key={index}><span><i/><i/></span><i/></div>)}</div>:<>
      {error&&<div className="payout-error" role="alert"><p>{error}</p><button type="button" className="button secondary" disabled={busy} onClick={()=>void load()}>{t('Retry','Coba lagi')}</button></div>}
      {accounts.length>0?<ul className="payout-accounts">{accounts.map(account=><li key={account.id}>
        <div className="payout-account-info"><strong>{account.bankName}{account.isDefault&&<span className="payout-default">{t('Default','Utama')}</span>}</strong><span>{account.accountHolder}</span><small>•••• {account.lastFour} - {t('Not verified','Belum diverifikasi')}</small></div>
        <div className="payout-account-actions">{confirmDelete===account.id?<><span>{t('Remove this account?','Hapus rekening ini?')}</span><button type="button" className="button secondary" disabled={busy} onClick={()=>void update(account,'DELETE')}>{t('Remove','Hapus')}</button><button type="button" className="button secondary" disabled={busy} onClick={()=>setConfirmDelete(null)}>{t('Cancel','Batal')}</button></>:<>
          {!account.isDefault&&<button type="button" className="button secondary" disabled={busy} onClick={()=>void update(account,'PATCH')}>{t('Make default','Jadikan utama')}</button>}
          <button type="button" className="button secondary" disabled={busy} onClick={()=>startEdit(account)}><PencilSimpleIcon size={15}/>{t('Edit','Ubah')}</button>
          <button type="button" className="button secondary" disabled={busy} onClick={()=>setConfirmDelete(account.id)}><TrashIcon size={15}/>{t('Remove','Hapus')}</button>
        </>}</div>
      </li>)}</ul>:!error&&<p className="payout-empty">{t('No bank accounts saved','Belum ada rekening tersimpan')}</p>}
      {!showForm&&<button type="button" className="button secondary payout-add" disabled={busy||accounts.length>=5} onClick={()=>{setEditing(null);setForm({...empty,makeDefault:accounts.length===0});setShowForm(true);}}><PlusIcon size={16}/>{t('Add bank account','Tambah rekening bank')}</button>}
      {showForm&&<form className="form-stack payout-form" onSubmit={save}>
        <h3>{editing?t('Edit bank account','Ubah rekening bank'):t('Add bank account','Tambah rekening bank')}</h3>
        <div className="form-row"><label>{t('Bank name','Nama bank')}<Picker value={form.bankName} onChange={bankName=>setForm({...form,bankName})} label={t('Bank name','Nama bank')} options={['BCA','Mandiri','BRI','BNI','BSI','CIMB Niaga','Permata','Danamon','BTPN','SeaBank','Other'].map(name=>({value:name,label:name==='Other'?t('Other','Lainnya'):name}))}/>{form.bankName==='Other'&&<input aria-label={t('Enter bank name','Masukkan nama bank')} required minLength={2} maxLength={80} autoComplete="off" value={customBank} placeholder={t('Enter bank name','Masukkan nama bank')} onChange={event=>setCustomBank(event.target.value)}/>}</label><label>{t('Account holder','Nama pemilik rekening')}<input required minLength={2} maxLength={120} autoComplete="off" value={form.accountHolder} onChange={event=>setForm({...form,accountHolder:event.target.value})}/><small>{t('Enter the name as it appears on your bank account','Masukkan nama sesuai yang tercatat di bank')}</small></label></div>
        <label>{t('Account number','Nomor rekening')}<input required={!editing} inputMode="numeric" pattern="[0-9]{6,34}" maxLength={34} autoComplete="off" data-lpignore="true" value={form.accountNumber} onChange={event=>setForm({...form,accountNumber:event.target.value.replace(/\D/g,'')})}/>{editing&&<small>{t('Leave blank to keep the saved number','Kosongkan untuk mempertahankan nomor tersimpan')}</small>}</label>
        <label className="payout-default-option"><input type="checkbox" checked={form.makeDefault} disabled={accounts.length===0||accounts.some(account=>account.id===editing&&account.isDefault)} onChange={event=>setForm({...form,makeDefault:event.target.checked})}/><span>{t('Use as my default account','Jadikan rekening utama')}</span></label>
        <div className="payout-form-actions"><button type="submit" className="button" disabled={busy||!form.bankName||(form.bankName==='Other'&&customBank.trim().length<2)}><FloppyDiskIcon size={16}/>{busy?t('Saving…','Menyimpan…'):t('Save bank account','Simpan rekening')}</button><button type="button" className="button secondary" disabled={busy} onClick={()=>{setShowForm(false);setEditing(null);setForm(empty);setCustomBank('');}}>{t('Cancel','Batal')}</button></div>
      </form>}
    </>}
  </div>;
}
