import {z} from 'zod';
import {db,errorResponse,guard,HttpError,optionalUser} from '@/lib/server/store';
import {ensurePartnerRequestsSchema,getConnectedSocialSnapshot,runPartnerAiPrescreen} from '@/lib/server/partner-requests';
import {sendMarketEmail} from '@/lib/server/market-notifications';

const schema=z.object({
  shopName:z.string().trim().max(100).optional().default(''),
  socialHandle:z.string().trim().min(2,'Enter your Instagram, TikTok, or social handle.').max(100),
  category:z.enum(['TCG_SINGLES_SLABS','SEALED_PRODUCTS','FIGURES_COLLECTIBLES','GAMING_TECH','MULTI_CATEGORY']).default('TCG_SINGLES_SLABS'),
  city:z.string().trim().max(80).optional().default(''),
  monthlyVolume:z.string().trim().max(80).optional(),
  contactWhatsapp:z.string().trim().min(8,'Enter a valid WhatsApp number.').max(30),
  requestType:z.enum(['PARTNER_CONSIGN','SOCIAL_TESTER','BOTH']).default('BOTH'),
  notes:z.string().trim().max(1000).optional(),
});

export async function POST(request:Request){
  try{
    guard(request);
    const input=schema.parse(await request.json());
    const shopName=input.shopName.trim()||(input.requestType==='SOCIAL_TESTER'?input.socialHandle:'');
    const city=input.city.trim()||(input.requestType==='SOCIAL_TESTER'?'Indonesia':'');
    if(shopName.length<2)throw new HttpError(400,'Enter your store or account name.');
    if(city.length<2)throw new HttpError(400,'Enter your city.');

    const viewer=await optionalUser();
    const database=db();
    await ensurePartnerRequestsSchema(database);

    const existing=await database.prepare(`SELECT id FROM market_partner_requests
      WHERE status='PENDING' AND created_at>=datetime('now','-24 hours')
        AND (lower(social_handle)=lower(?) OR contact_whatsapp=?)
      LIMIT 1`).bind(input.socialHandle,input.contactWhatsapp).first<{id:string}>();
    if(existing){
      throw new HttpError(409,'An application for this handle or WhatsApp number is already under review.');
    }

    const connectedSocials=await getConnectedSocialSnapshot(database,viewer?.id);
    const aiReview=await runPartnerAiPrescreen({
      shopName,
      socialHandle:input.socialHandle,
      category:input.category,
      city,
      monthlyVolume:input.monthlyVolume,
      contactWhatsapp:input.contactWhatsapp,
      notes:input.notes,
      requestType:input.requestType,
      connectedSocials,
    });

    const id=crypto.randomUUID();
    await database.prepare(`INSERT INTO market_partner_requests (id,profile_id,shop_name,social_handle,category,city,monthly_volume,contact_whatsapp,notes,request_type,ai_score,ai_risk,ai_summary,social_metrics)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      id,
      viewer?.id??null,
      shopName,
      input.socialHandle,
      input.category,
      city,
      input.requestType==='SOCIAL_TESTER'?null:(input.monthlyVolume?.trim()||null),
      input.contactWhatsapp,
      input.notes?.trim()||null,
      input.requestType,
      aiReview.score,
      aiReview.risk,
      aiReview.summary,
      connectedSocials?JSON.stringify(connectedSocials):null,
    ).run();

    if(viewer?.id){
      await sendMarketEmail(viewer.id,'partner-application-received',shopName,id).catch(()=>{});
    }
    const { notifyAdminsPush } = await import('@/lib/server/admin-push');
    await notifyAdminsPush({
      title: 'New Partner Application',
      body: `${shopName} (${input.socialHandle}) applied for ${input.requestType}`,
      url: '/admin?section=partners',
      tag: `admin-partner-${id}`,
    });

    return Response.json({id,ok:true},{status:201});
  }catch(error){
    return errorResponse(error);
  }
}
