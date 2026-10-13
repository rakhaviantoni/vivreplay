import {database} from '@/lib/server/database';
import {supabaseAdmin} from '@/lib/server/supabase-storage';

export async function GET(request:Request){
  const envRate=Number(process.env.JPY_TO_IDR_RATE??'');
  const rate=Number.isFinite(envRate)&&envRate>0?envRate:110;
  try{
    const printingId=new URL(request.url).searchParams.get('printingId')?.trim();
    if(!printingId)return Response.json({benchmark:null,history:[]});
    let history:{amount:number;currency:string;url:string|null;observedAt:string;confidence:string}[]=[];
    try{history=(await database().prepare(`
      SELECT p.amount,p.currency,p.source_kind AS confidence,p.observed_at AS observedAt,
        json_extract(s.payload,'$.card_url') AS url
      FROM tcg_price_observations p
      LEFT JOIN tcg_source_records s ON s.id=p.source_record_id
      WHERE p.printing_id=? AND p.source_record_id IS NOT NULL
        AND lower(p.source)='yuyutei' AND lower(p.source_kind)='market_price'
      ORDER BY p.observed_at DESC LIMIT 60
    `).bind(printingId).all<{amount:number;currency:string;url:string|null;observedAt:string;confidence:string}>()).results;}catch{/* Try the saved Supabase observations below. */}
    if(!history.length){
      const db=supabaseAdmin();
      if(db){
        const {data}=await db.from('tcg_price_observations').select('amount,currency,source_kind,observed_at,source_record:tcg_source_records(payload)').eq('printing_id',printingId).not('source_record_id','is',null).eq('source','yuyutei').eq('source_kind','market_price').order('observed_at',{ascending:false}).limit(60);
        history=(data??[]).map(row=>{const source=row.source_record as unknown as {payload?:{card_url?:string}}|null;return {amount:Number(row.amount),currency:String(row.currency),confidence:String(row.source_kind),observedAt:String(row.observed_at),url:source?.payload?.card_url??null}});
      }
    }
    type BenchmarkRow={amount:number;currency:string;url:string|null;observedAt:string;confidence:string};
    // A benchmark belongs to one printing. Reusing another printing's price can
    // make standard and alternate artwork look like they have the same value.
    const benchmark:BenchmarkRow|null=history[0]??null;
    const currency=benchmark?.currency.toUpperCase();
    const normalizedAmount=benchmark?(currency==='JPY'?Math.round(benchmark.amount*rate):currency==='IDR'?benchmark.amount:null):null;
    return Response.json({benchmark:benchmark?{...benchmark,normalizedAmount,normalizedCurrency:normalizedAmount===null?null:'IDR'}:null,history:[...history].reverse(),jpyToIdrRate:rate});
  }catch(error){
    console.error('market_benchmark_unavailable', error);
    return Response.json({benchmark:null,history:[],jpyToIdrRate:rate});
  }
}
