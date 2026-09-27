'use client';
import {useEffect,useState,useCallback} from 'react';
import {CollectionItem,SavedDeck} from '@/packages/domain';
export type WishlistItem = {
  printingId: string;
  targetCondition?: string;
  targetGrade?: string;
  targetPrice?: number;
  priority?: 'high' | 'medium' | 'low';
  currency?: string;
  notes?: string;
};
export type AccountState={profile:Record<string,any>;collection:CollectionItem[];decks:SavedDeck[];wishlist:WishlistItem[]};
export async function api<T>(url:string,body?:unknown,method='POST'):Promise<T>{const r=await fetch(url,{method:body===undefined?'GET':method,headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json().catch(()=>null) as {error?:string}|null;if(!r.ok)throw new Error(data?.error||'Unable to complete this request.');return data as T;}
export function useAccount(){const [data,setData]=useState<AccountState|null>(null);const [error,setError]=useState('');const [loading,setLoading]=useState(true);const refresh=useCallback(async()=>{setLoading(true);try{setData(await api<AccountState>('/api/state'));setError('')}catch(e){setError(e instanceof Error?e.message:'Unable to load account.')}finally{setLoading(false)}},[]);useEffect(()=>{let active=true;api<AccountState>('/api/state').then(result=>{if(active){setData(result);setLoading(false)}}).catch(e=>{if(active){setError(e instanceof Error?e.message:'Unable to load account.');setLoading(false)}});return()=>{active=false}},[]);return {data,error,loading,refresh};}
