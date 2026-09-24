import {db,errorResponse} from '@/lib/server/store';

export async function GET(request:Request){
  try{
    const printingId=new URL(request.url).searchParams.get('printingId')?.trim();
    if(!printingId)return Response.json({benchmark:null});
    const benchmark=await db().prepare(`SELECT amount,currency,url,created_at AS observedAt,confidence FROM price_observations WHERE printing_id=? AND upper(source)='YUYUTEI' ORDER BY created_at DESC LIMIT 1`).bind(printingId).first<{amount:number;currency:string;url:string|null;observedAt:string;confidence:string}>();
    const rate=Number(process.env.JPY_TO_IDR_RATE??'');const normalizedAmount=benchmark&&benchmark.currency==='JPY'&&Number.isFinite(rate)&&rate>0?Math.round(benchmark.amount*rate):benchmark?.currency==='IDR'?benchmark.amount:null;return Response.json({benchmark:benchmark?{...benchmark,normalizedAmount,normalizedCurrency:normalizedAmount===null?null:'IDR'}:null});
  }catch(error){return errorResponse(error)}
}
