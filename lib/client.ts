'use client';
import {useEffect,useState,useCallback,useRef} from 'react';
import {CollectionItem,SavedDeck} from '@/packages/domain';
import {authClient} from '@/lib/auth-client';
export type WishlistItem = {
  printingId: string;
  card?: {printingId:string;name:string;code:string;language:string;variant:string;rarity:string;setCode:string;imageUrl:string|null}|null;
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
  const [dataUserId,setDataUserId]=useState<string|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const requestSequence=useRef(0);

  const refresh=useCallback(async()=>{
    if(sessionPending)return;
    if(sessionError){
      setData(null);
      setDataUserId(null);
      setError('We could not check your sign-in status. Please try again.');
      setLoading(false);
      return;
    }
    if(!userId){
      setData(null);
      setDataUserId(null);
      setError('');
      setLoading(false);
      return;
    }
    const request=++requestSequence.current;
    setLoading(true);
    try{
      const result=await api<AccountState>('/api/state');
      if(request!==requestSequence.current)return;
      setData(result);
      setDataUserId(userId);
      setError('');
    }catch(e){
      if(request!==requestSequence.current)return;
      setData(null);
      setDataUserId(null);
      setError(e instanceof Error?e.message:'Unable to load account.');
    }finally{
      if(request===requestSequence.current)setLoading(false);
    }
  },[sessionPending,sessionError,userId]);

  useEffect(()=>{
    if(sessionPending)return;
    let active=true;
    const request=++requestSequence.current;
    if(sessionError){
      setData(null);
      setDataUserId(null);
      setError('We could not check your sign-in status. Please try again.');
      setLoading(false);
    }else if(!userId){
      setData(null);
      setDataUserId(null);
      setError('');
      setLoading(false);
    }else{
      setLoading(true);
      api<AccountState>('/api/state').then(result=>{
        if(active&&request===requestSequence.current){setData(result);setDataUserId(userId);setError('');setLoading(false);}
      }).catch(reason=>{
        if(active&&request===requestSequence.current){setData(null);setDataUserId(null);setError(reason instanceof Error?reason.message:'Unable to load account.');setLoading(false);}
      });
    }
    return()=>{active=false;requestSequence.current+=1;};
  },[sessionPending,sessionError,userId]);

  return {data:dataUserId===userId?data:null,error,loading,refresh};
}
