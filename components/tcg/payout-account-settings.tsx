'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {BankIcon,FloppyDiskIcon,PlusIcon,TrashIcon,PencilSimpleIcon} from '@phosphor-icons/react';
import {toast} from 'sonner';
import {api} from '@/lib/client';
import {Picker} from './catalog';

type Account={id:string;bankName:string;accountHolder:string;lastFour:string;isDefault:boolean};
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

  const load=async()=>{
    setError('');
    try{const result=await api<{accounts:Account[]}>('/api/profile/bank-accounts');setAccounts(result.accounts);}
    catch{setError(t('Bank accounts could not load. Please try again.','Rekening bank belum dapat dimuat. Coba lagi.'));}
    finally{setLoading(false);}
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
    <div className="profile-section-header"><h2><BankIcon size={20}/>{t('Bank accounts','Rekening bank')}</h2><p>{t('Add the account you want to use for Market earnings. Your bank details stay private.','Tambahkan rekening untuk menerima hasil penjualan di Market. Data rekening Anda tetap pribadi.')}</p></div>
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
