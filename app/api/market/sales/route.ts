import {database} from '@/lib/server/database';

type SaleRow={unitAmount:number;quantity:number;soldAt:string};

export async function GET(request:Request){
  const printingId=new URL(request.url).searchParams.get('printingId')?.trim();
  if(!printingId||printingId.length>160)return Response.json({sales:[],summary:null},{status:200,headers:{'Cache-Control':'public, max-age=60, stale-while-revalidate=300'}});
  try{
    const history=await database().prepare(`SELECT CAST(json_extract(item.value,'$.unitAmount') AS INTEGER) AS unitAmount,
      CAST(json_extract(item.value,'$.quantity') AS INTEGER) AS quantity,
      COALESCE(o.fulfilled_at,o.updated_at,o.created_at) AS soldAt
      FROM checkout_orders o,json_each(o.items) item
      WHERE o.kind='MARKET' AND o.status IN ('PAID','RECEIVED')
        AND json_extract(item.value,'$.printingId')=?
        AND CAST(json_extract(item.value,'$.unitAmount') AS INTEGER)>0
        AND CAST(json_extract(item.value,'$.quantity') AS INTEGER)>0
      ORDER BY COALESCE(o.fulfilled_at,o.updated_at,o.created_at) DESC LIMIT 40`).bind(printingId).all<SaleRow>();
    const sales=history.results;
    const copies=sales.reduce((total,sale)=>total+sale.quantity,0);
    const gross=sales.reduce((total,sale)=>total+sale.unitAmount*sale.quantity,0);
    return Response.json({sales,summary:sales.length?{transactions:sales.length,copies,averageUnitAmount:Math.round(gross/copies),latestUnitAmount:sales[0].unitAmount,latestSoldAt:sales[0].soldAt}:null},{headers:{'Cache-Control':'public, max-age=60, stale-while-revalidate=300'}});
  }catch(error){
    console.error('market_sales_history_unavailable',error instanceof Error?error.message:error);
    return Response.json({sales:[],summary:null},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
