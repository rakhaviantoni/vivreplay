'use client';
import {useEffect,useState,useCallback} from 'react';
import {CollectionItem,SavedDeck} from '@/packages/domain';
import {authClient} from '@/lib/auth-client';
export type WishlistItem = {
  printingId: string;
  alerts?: boolean | number;
  targetCondition?: string;
  targetGrade?: string;
  targetPrice?: number;
  priority?: 'high' | 'medium' | 'low';
  currency?: string;
  notes?: string;
};
export type AccountState={profile:Record<string,any>;collection:CollectionItem[];decks:SavedDeck[];wishlist:WishlistItem[]};
export async function api<T>(url:string,body?:unknown,method='POST',extraHeaders:Record<string,string>={}):Promise<T>{const r=await fetch(url,{method:body===undefined?'GET':method,headers:body===undefined?undefined:{'Content-Type':'application/json',...extraHeaders},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json().catch(()=>null) as {error?:string}|null;if(!r.ok)throw new Error(data?.error||'Unable to complete this request.');return data as T;}
export function useAccount(){
  const sessionState=authClient.useSession();
  const userId=sessionState.data?.user?.id??null;
  const sessionPending=sessionState.isPending;
  const sessionError=sessionState.error;
  const [data,setData]=useState<AccountState|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);

  const refresh=useCallback(async()=>{
    if(sessionPending)return;
    if(sessionError){
      setData(null);
      setError('We could not check your sign-in status. Please try again.');
      setLoading(false);
      return;
    }
    if(!userId){
      setData(null);
      setError('');
      setLoading(false);
      return;
    }
    setLoading(true);
    try{
      setData(await api<AccountState>('/api/state'));
      setError('');
    }catch(e){
      setError(e instanceof Error?e.message:'Unable to load account.');
    }finally{
      setLoading(false);
    }
  },[sessionPending,sessionError,userId]);

  useEffect(()=>{
    if(sessionPending)return;
    let active=true;
    if(sessionError){
      setData(null);
      setError('We could not check your sign-in status. Please try again.');
      setLoading(false);
    }else if(!userId){
      setData(null);
      setError('');
      setLoading(false);
    }else{
      setLoading(true);
      api<AccountState>('/api/state').then(result=>{
        if(active){setData(result);setError('');setLoading(false);}
      }).catch(reason=>{
        if(active){setData(null);setError(reason instanceof Error?reason.message:'Unable to load account.');setLoading(false);}
      });
    }
    return()=>{active=false;};
  },[sessionPending,sessionError,userId]);

  return {data,error,loading,refresh};
}
