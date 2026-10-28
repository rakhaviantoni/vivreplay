import {db,errorResponse,user} from '@/lib/server/store';
import {ipaymuExpiryTimestamp} from '@/lib/server/ipaymu';
import {sendMarketEmailOnce} from '@/lib/server/market-notifications';

type MembershipOrder={id:string;status:string;amount:number;currency:string;createdAt:string;paidAt:string|null;paymentId:string|null;details:string;expiresAt:string|null;updatedAt:string|null};

export async function GET(){
  try{
    const profile=await user();
    const database=db();
    const rows=(await database.prepare(`SELECT id,status,amount,currency,created_at AS createdAt,paid_at AS paidAt,
      payment_id AS paymentId,expires_at AS expiresAt,updated_at AS updatedAt,details
      FROM checkout_orders WHERE kind='PRO' AND buyer_id=? ORDER BY created_at DESC LIMIT 20`)
      .bind(profile.id).all<MembershipOrder&{paymentId:string|null;expiresAt:string|null;updatedAt:string|null;details:string}>()).results;
    const now=Date.now();
    for(const order of rows){
      if(order.status!=='PENDING_PAYMENT')continue;
      let details:Record<string,unknown>={};
      try{const parsed=JSON.parse(order.details) as unknown;if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))details=parsed as Record<string,unknown>}catch{}
      const paymentExpiry=details.ipaymuPaymentMethod
        ?ipaymuExpiryTimestamp(details.ipaymuPaymentExpiresAt,details.ipaymuPaymentCreatedAt,order.updatedAt)
        :null;
      const storedExpiry=order.expiresAt?Date.parse(`${order.expiresAt.replace(' ','T')}Z`):null;
      const expiry=paymentExpiry??(storedExpiry!==null&&Number.isFinite(storedExpiry)?storedExpiry:null);
      if(expiry!==null&&expiry<=now){
        if(paymentExpiry!==null){
          details.ipaymuExpiredByProviderAt??=new Date().toISOString();
          order.expiresAt=new Date(paymentExpiry).toISOString().slice(0,19).replace('T',' ');
        }
        const result=await database.prepare(`UPDATE checkout_orders SET status='EXPIRED',details=?,expires_at=COALESCE(?,expires_at),updated_at=CURRENT_TIMESTAMP
          WHERE id=? AND buyer_id=? AND kind='PRO' AND status='PENDING_PAYMENT'`).bind(JSON.stringify(details),paymentExpiry!==null?order.expiresAt:null,order.id,profile.id).run();
        if(result.meta.changes)order.status='EXPIRED';
      }
    }
    for(const order of rows){
      if(order.status==='EXPIRED')await sendMarketEmailOnce(profile.id,'pro-payment-expired','Market Pro',order.id,`payment-expired:${order.id}`);
      if(order.status==='FAILED')await sendMarketEmailOnce(profile.id,'pro-payment-failed','Market Pro',order.id,`payment-failed:${order.id}`);
      if(order.status==='PAYMENT_REVIEW')await sendMarketEmailOnce(profile.id,'pro-payment-review','Market Pro',order.id,`payment-review:${order.id}`);
    }
    const expiryValue=String(profile.pro_expires_at??'');
    const expiryDate=expiryValue?new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(expiryValue)?expiryValue:`${expiryValue.replace(' ','T')}Z`):null;
    const expiryTime=expiryDate&&!Number.isNaN(expiryDate.getTime())?expiryDate.getTime():null;
    const hasPaidMembership=rows.some(order=>order.status==='PAID'||order.status==='COMPLETED');
    const latestPaidMembership=rows.find(order=>order.status==='PAID'||order.status==='COMPLETED');
    if(latestPaidMembership&&expiryTime!==null&&expiryTime>now)await sendMarketEmailOnce(profile.id,'pro-activated','Market Pro',latestPaidMembership.id,`activated:${latestPaidMembership.id}`);
    if(hasPaidMembership&&expiryTime!==null){
      if(expiryTime>now&&expiryTime-now<=7*24*60*60*1000){
        await sendMarketEmailOnce(profile.id,'pro-expiring','Market Pro',expiryValue,`expiring:${expiryValue}`);
      }else if(expiryTime<=now){
        await sendMarketEmailOnce(profile.id,'pro-expired','Market Pro',expiryValue,`expired:${expiryValue}`);
      }
    }
    const orders=rows.map(({id,status,amount,currency,createdAt,paidAt,paymentId,details:rawDetails,expiresAt,updatedAt})=>{
      let details:Record<string,unknown>={};try{const parsed=JSON.parse(rawDetails) as unknown;if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))details=parsed as Record<string,unknown>}catch{}
      return {id,status,amount,currency,createdAt,paidAt,billingPeriod:details.billingPeriod==='yearly'?'yearly':'monthly',paymentMethod:typeof details.ipaymuPaymentMethod==='string'?details.ipaymuPaymentMethod:null,paymentChannel:typeof details.ipaymuPaymentChannel==='string'?details.ipaymuPaymentChannel:null,paymentName:typeof details.ipaymuPaymentName==='string'?details.ipaymuPaymentName:null,selectedMethod:typeof details.ipaymuSelectedMethod==='string'?details.ipaymuSelectedMethod:null,selectedChannel:typeof details.ipaymuSelectedChannel==='string'?details.ipaymuSelectedChannel:null,paymentCreated:Boolean(paymentId&&!paymentId.startsWith('CREATING:')&&details.ipaymuPaymentMethod),expiresAt:details.ipaymuPaymentExpiresAt??expiresAt};
    });
    return Response.json({orders},{headers:{'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie'}});
  }catch(error){return errorResponse(error)}
}
