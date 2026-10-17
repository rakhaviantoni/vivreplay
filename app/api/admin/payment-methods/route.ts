import {z} from 'zod';
import {db,errorResponse} from '@/lib/server/store';
import {isCurrentUserAdmin} from '@/lib/server/admin-auth';
import {getIpaymuPaymentChannels,getIpaymuPaymentChannelSettings,hasIpaymuPaymentConfig,parseIpaymuPaymentChannelSettings} from '@/lib/server/ipaymu';

const settingsSchema=z.object({disabledChannels:z.array(z.string().regex(/^(va|cstore|qris|cc|paylater|ewallet):[a-z0-9_]{2,24}$/)).max(300)});

export async function GET(){
  try{
    if(!await isCurrentUserAdmin())return Response.json({error:'Admin access is required.'},{status:403});
    const database=db();
    const [settings]=await Promise.all([getIpaymuPaymentChannelSettings(database)]);
    let channels:Awaited<ReturnType<typeof getIpaymuPaymentChannels>>=[];
    const configured=hasIpaymuPaymentConfig();
    let providerAvailable=false;
    if(configured){
      try{channels=await getIpaymuPaymentChannels();providerAvailable=true}catch{}
    }
    return Response.json({channels,disabledChannels:settings.disabledChannels,configured,providerAvailable},{headers:{'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie'}});
  }catch(error){return errorResponse(error)}
}

export async function POST(request:Request){
  try{
    if(!await isCurrentUserAdmin())return Response.json({error:'Admin access is required.'},{status:403});
    const body=settingsSchema.parse(await request.json());
    const settings=parseIpaymuPaymentChannelSettings(body);
    const database=db();
    await database.prepare(`INSERT INTO app_settings (key,value,updated_at) VALUES ('ipaymu_payment_channels',?,CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP`).bind(JSON.stringify(settings)).run();
    return Response.json({success:true,disabledChannels:settings.disabledChannels},{headers:{'Cache-Control':'private, no-store, max-age=0'}});
  }catch(error){return errorResponse(error)}
}
