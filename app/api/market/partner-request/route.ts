import {z} from 'zod';
import {db,errorResponse,guard,optionalUser} from '@/lib/server/store';
import {ensurePartnerRequestsSchema,getConnectedSocialSnapshot,runPartnerAiPrescreen} from '@/lib/server/partner-requests';

const schema=z.object({
  shopName:z.string().trim().min(2,'Enter your store or account name.').max(100),
  socialHandle:z.string().trim().min(2,'Enter your Instagram, TikTok, or social handle.').max(100),
  category:z.enum(['TCG_SINGLES_SLABS','SEALED_PRODUCTS','FIGURES_COLLECTIBLES','GAMING_TECH','MULTI_CATEGORY']),
  city:z.string().trim().min(2,'Enter your city.').max(80),
  monthlyVolume:z.string().trim().max(80).optional(),
  contactWhatsapp:z.string().trim().min(8,'Enter a valid WhatsApp number.').max(30),
  requestType:z.enum(['PARTNER_CONSIGN','SOCIAL_TESTER','BOTH']).default('BOTH'),
  notes:z.string().trim().max(1000).optional(),
});

export async function POST(request:Request){
  try{
    guard(request);
    const input=schema.parse(await request.json());
    const viewer=await optionalUser();
    const database=db();
    await ensurePartnerRequestsSchema(database);

    const connectedSocials=await getConnectedSocialSnapshot(database,viewer?.id);
    const aiReview=await runPartnerAiPrescreen({
      shopName:input.shopName,
      socialHandle:input.socialHandle,
      category:input.category,
      city:input.city,
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
      input.shopName,
      input.socialHandle,
      input.category,
      input.city,
      input.monthlyVolume?.trim()||null,
      input.contactWhatsapp,
      input.notes?.trim()||null,
      input.requestType,
      aiReview.score,
      aiReview.risk,
      aiReview.summary,
      connectedSocials?JSON.stringify(connectedSocials):null,
    ).run();

    return Response.json({id,ok:true},{status:201});
  }catch(error){
    return errorResponse(error);
  }
}
