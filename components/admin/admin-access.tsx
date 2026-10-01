'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {LockKeyIcon as Lock,SignInIcon as SignIn} from '@phosphor-icons/react';

export function AdminAccess(){
  const router=useRouter();
  const [password,setPassword]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);

  const submit=async(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setError('');setBusy(true);
    try{
      const response=await fetch('/api/admin/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password})});
      const result=await response.json() as {error?:string};
      if(!response.ok)throw new Error(result.error??'Could not sign in.');
      setPassword('');router.refresh();
    }catch(cause){setError(cause instanceof Error?cause.message:'Could not sign in.')}finally{setBusy(false)}
  };

  return <main className="page admin-access-page"><section className="admin-access-card"><span className="admin-access-icon"><Lock size={22}/></span><p className="eyebrow">VIVREPLAY · ADMIN</p><h1>Admin access</h1><p>Enter the admin password to open the control panel.</p><form onSubmit={submit}><label htmlFor="admin-password">Password</label><input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} required maxLength={256}/>{error&&<p className="admin-access-error" role="alert">{error}</p>}<button className="button" type="submit" disabled={busy||!password}><SignIn size={16}/>{busy?'Checking…':'Continue'}</button></form></section></main>;
}
