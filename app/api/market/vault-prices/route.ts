import {z} from 'zod';
import {database} from '@/lib/server/database';
import {supabaseAdmin} from '@/lib/server/supabase-storage';
import {guard} from '@/lib/server/store';

const requestSchema=z.object({printingIds:z.array(z.string().uuid()).max(500)});
type Observation={printing_id:string;amount:number;currency:string;observed_at:string;observationCount:number;position:number};

async function loadObservations(ids:string[]):Promise<Observation[]>{
  try{
    const rows:Observation[]=[];
    for(let offset=0;offset<ids.length;offset+=80){
      const chunk=ids.slice(offset,offset+80);
      const placeholders=chunk.map(()=>'?').join(',');
      const result=await database().prepare(`WITH ranked AS (
        SELECT printing_id,amount,currency,observed_at,
          COUNT(*) OVER(PARTITION BY printing_id) AS observation_count,
          ROW_NUMBER() OVER(PARTITION BY printing_id ORDER BY julianday(observed_at) DESC) AS position
        FROM tcg_price_observations
        WHERE source='yuyutei' AND source_kind='market_price' AND printing_id IN (${placeholders})
      ) SELECT printing_id,amount,currency,observed_at,observation_count AS observationCount,position FROM ranked WHERE position<=90 ORDER BY printing_id,position`).bind(...chunk).all<Observation>();
      rows.push(...result.results);
    }
    return rows;
  }catch(d1Error){
    const db=supabaseAdmin();
    if(!db)throw d1Error;
    const rows:Observation[]=[];
    for(let offset=0;offset<ids.length;offset+=20){
      const chunk=ids.slice(offset,offset+20);
      const groups=await Promise.all(chunk.map(async printingId=>{
        const {data,count,error}=await db.from('tcg_price_observations').select('amount,currency,observed_at',{count:'exact'}).eq('printing_id',printingId).eq('source','yuyutei').eq('source_kind','market_price').order('observed_at',{ascending:false}).limit(90);
        if(error)throw error;
        return (data??[]).map((row,index)=>({printing_id:printingId,amount:Number(row.amount),currency:String(row.currency),observed_at:String(row.observed_at),observationCount:count??data.length,position:index+1}));
      }));
      rows.push(...groups.flat());
    }
    return rows;
  }
}

export async function POST(request:Request){
  try{
    guard(request);
    const input=requestSchema.parse(await request.json());
    const ids=[...new Set(input.printingIds)];
    if(!ids.length)return Response.json({prices:{},jpyToIdrRate:110});
    const rateValue=Number(process.env.JPY_TO_IDR_RATE??'');
    const jpyToIdrRate=Number.isFinite(rateValue)&&rateValue>0?rateValue:110;
    const prices:Record<string,{amount:number;currency:string;observedAt:string;observationCount:number;previousAmount:number|null;previousCurrency:string|null;previousObservedAt:string|null}>={};
    const now=Date.now();
    const target=now-30*24*60*60*1000;
    const tolerance=5*24*60*60*1000;
    const grouped=new Map<string,Observation[]>();
    for(const row of await loadObservations(ids)){const list=grouped.get(row.printing_id)??[];list.push(row);grouped.set(row.printing_id,list)}
    for(const [printingId,history] of grouped){
        const latest=history[0];
        const latestAt=Date.parse(latest.observed_at);
        if(!Number.isFinite(latestAt)||now-latestAt>90*24*60*60*1000||latest.amount<=0)continue;
        const previous=history.filter(row=>{
          const at=Date.parse(row.observed_at);
          return Number.isFinite(at)&&Math.abs(at-target)<=tolerance&&row.amount>0;
        }).sort((a,b)=>Math.abs(Date.parse(a.observed_at)-target)-Math.abs(Date.parse(b.observed_at)-target))[0];
        prices[printingId]={amount:latest.amount,currency:latest.currency.toUpperCase(),observedAt:latest.observed_at,observationCount:latest.observationCount,previousAmount:previous?.amount??null,previousCurrency:previous?.currency.toUpperCase()??null,previousObservedAt:previous?.observed_at??null};
    }
    return Response.json({prices,jpyToIdrRate},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){
    console.error('vault_market_prices_unavailable',error);
    return Response.json({error:'Vault market prices are temporarily unavailable.'},{status:503});
  }
}
