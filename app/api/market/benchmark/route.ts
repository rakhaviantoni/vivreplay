import {database} from '@/lib/server/database';

export async function GET(request:Request){
  try{
    const printingId=new URL(request.url).searchParams.get('printingId')?.trim();
    if(!printingId)return Response.json({benchmark:null,history:[]});
    const history=await database().prepare(`SELECT amount,currency,url,created_at AS observedAt,confidence FROM price_observations WHERE printing_id=? AND upper(source)='YUYUTEI' ORDER BY created_at DESC LIMIT 60`).bind(printingId).all<{amount:number;currency:string;url:string|null;observedAt:string;confidence:string}>();
    const benchmark=history.results[0]??null;
    const envRate=Number(process.env.JPY_TO_IDR_RATE??'');
    const rate=Number.isFinite(envRate)&&envRate>0?envRate:110;
    const normalizedAmount=benchmark&&benchmark.currency==='JPY'?Math.round(benchmark.amount*rate):benchmark?.currency==='IDR'?benchmark.amount:null;
    return Response.json({benchmark:benchmark?{...benchmark,normalizedAmount,normalizedCurrency:normalizedAmount===null?null:'IDR'}:null,history:[...history.results].reverse()});
  }catch(error){
    console.error('market_benchmark_unavailable', error);
    return Response.json({benchmark:null,history:[]});
  }
}
