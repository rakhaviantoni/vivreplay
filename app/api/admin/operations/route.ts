import {db,errorResponse} from '@/lib/server/store';
import {isCurrentUserAdmin} from '@/lib/server/admin-auth';
import {getIpaymuMerchantBalance,hasIpaymuPaymentConfig} from '@/lib/server/ipaymu';

const SETTINGS_KEY='provider_operations_settings';
const DEFAULT_THRESHOLD=500_000;
type Settings={ipaymuWarningBalance:number};
function parseSettings(value:string|null|undefined):Settings{
  try{const parsed=JSON.parse(value??'{}') as {ipaymuWarningBalance?:unknown};const number=Number(parsed.ipaymuWarningBalance);return{ipaymuWarningBalance:Number.isSafeInteger(number)&&number>=0&&number<=1_000_000_000?number:DEFAULT_THRESHOLD}}catch{return{ipaymuWarningBalance:DEFAULT_THRESHOLD}}
}

export async function GET(){
  if(!await isCurrentUserAdmin())return Response.json({error:'Admin access is required.'},{status:403});
  try{
    const database=db();
    const settingsRow=await database.prepare('SELECT value FROM app_settings WHERE key=?').bind(SETTINGS_KEY).first<{value:string}>();
    const settings=parseSettings(settingsRow?.value);
    const [recentOrders,shippingIssues,unshipped,shippingTrend,balanceHistory]=await Promise.all([
      database.prepare(`SELECT COUNT(*) AS orders,COALESCE(SUM(amount),0) AS volume,
        SUM(CASE WHEN status IN ('FAILED','EXPIRED') THEN 1 ELSE 0 END) AS unsuccessful
        FROM checkout_orders WHERE kind='MARKET' AND created_at>=datetime('now','-29 days')`).first<{orders:number;volume:number;unsuccessful:number}>(),
      database.prepare(`SELECT COUNT(*) AS total FROM checkout_orders WHERE kind='MARKET' AND created_at>=datetime('now','-29 days')
        AND (shipping_status='FAILED' OR json_extract(details,'$.trackingStatus') IN ('courier_not_found','cancelled','rejected','returned','disposed'))`).first<{total:number}>(),
      database.prepare(`SELECT COUNT(*) AS total FROM checkout_orders WHERE kind='MARKET' AND status='PAID'
        AND COALESCE(shipping_status,'') NOT IN ('SHIPPED','DELIVERED') AND biteship_order_id IS NULL
        AND created_at>=datetime('now','-29 days')`).first<{total:number}>(),
      database.prepare(`SELECT substr(created_at,1,10) AS day,COUNT(*) AS shipments,
        COALESCE(SUM(CASE WHEN CAST(json_extract(details,'$.shippingPrice') AS INTEGER)>0 THEN CAST(json_extract(details,'$.shippingPrice') AS INTEGER) ELSE 0 END),0) AS reportedCost
        FROM checkout_orders WHERE kind='MARKET' AND biteship_order_id IS NOT NULL AND created_at>=datetime('now','-29 days')
        GROUP BY substr(created_at,1,10) ORDER BY day`).all<{day:string;shipments:number;reportedCost:number}>(),
      database.prepare(`SELECT balance,mode,recorded_at AS recordedAt FROM provider_balance_snapshots
        WHERE provider='ipaymu' AND recorded_at>=datetime('now','-89 days') ORDER BY recorded_at`).all<{balance:number;mode:string;recordedAt:string}>(),
    ]);
    let balance:{merchantBalance:number;memberBalance:number;mode:string;checkedAt:string}|null=null;
    let balanceError:string|null=null;
    if(hasIpaymuPaymentConfig()){
      try{
        balance=await getIpaymuMerchantBalance();
        const previous=await database.prepare(`SELECT recorded_at AS recordedAt FROM provider_balance_snapshots WHERE provider='ipaymu' ORDER BY recorded_at DESC LIMIT 1`).first<{recordedAt:string}>();
        if(!previous||Date.now()-Date.parse(`${previous.recordedAt.replace(' ','T')}Z`)>4*60*60*1000){
          await database.prepare(`INSERT INTO provider_balance_snapshots(id,provider,balance,currency,mode) VALUES(?, 'ipaymu', ?, 'IDR', ?)`).bind(crypto.randomUUID(),balance.merchantBalance,balance.mode).run();
        }
      }catch{balanceError='Balance check failed. The last saved reading is shown below.';}
    }else balanceError='iPaymu credentials are not configured.';
    const lastBalance=balance??(balanceHistory.results.length?{merchantBalance:balanceHistory.results.at(-1)!.balance,memberBalance:0,mode:balanceHistory.results.at(-1)!.mode,checkedAt:balanceHistory.results.at(-1)!.recordedAt}:null);
    const days=new Map<string,{day:string;shipments:number;reportedCost:number}>();
    const now=new Date();
    for(let offset=29;offset>=0;offset--){const day=new Date(now.getTime()-offset*86_400_000).toISOString().slice(0,10);days.set(day,{day,shipments:0,reportedCost:0});}
    for(const row of shippingTrend.results){const day=days.get(row.day);if(day){day.shipments=row.shipments;day.reportedCost=row.reportedCost}}
    const result={generatedAt:new Date().toISOString(),settings,ipaymu:{available:Boolean(balance),current:lastBalance,error:balanceError,history:balanceHistory.results},biteship:{balanceAvailable:false,historyAvailable:true,shipmentIssues:shippingIssues?.total??0,paidOrdersAwaitingShipment:unshipped?.total??0,daily:[...days.values()]},market:{orders:recentOrders?.orders??0,volume:recentOrders?.volume??0,unsuccessful:recentOrders?.unsuccessful??0}};
    return Response.json(result,{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return errorResponse(error)}
}

export async function POST(request:Request){
  if(!await isCurrentUserAdmin())return Response.json({error:'Admin access is required.'},{status:403});
  try{
    const input=await request.json() as {ipaymuWarningBalance?:unknown};
    const threshold=Number(input.ipaymuWarningBalance);
    if(!Number.isSafeInteger(threshold)||threshold<0||threshold>1_000_000_000)return Response.json({error:'Enter a valid balance threshold.'},{status:400});
    await db().prepare(`INSERT INTO app_settings(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP`).bind(SETTINGS_KEY,JSON.stringify({ipaymuWarningBalance:threshold})).run();
    return Response.json({settings:{ipaymuWarningBalance:threshold}},{headers:{'Cache-Control':'no-store'}});
  }catch(error){return errorResponse(error)}
}
