import {z} from 'zod';
import {db,errorResponse,guard,optionalUser} from '@/lib/server/store';

const schema=z.object({
  shopName:z.string().trim().min(2,'Enter your store or account name.').max(100),
  socialHandle:z.string().trim().min(2,'Enter your Instagram, TikTok, or social handle.').max(100),
  category:z.enum(['TCG_SINGLES_SLABS','SEALED_PRODUCTS','FIGURES_COLLECTIBLES','GAMING_TECH','MULTI_CATEGORY']),
  city:z.string().trim().min(2,'Enter your city.').max(80),
  monthlyVolume:z.string().trim().max(80).optional(),
  contactWhatsapp:z.string().trim().min(8,'Enter a valid WhatsApp number.').max(30),
  notes:z.string().trim().max(1000).optional(),
});

export async function POST(request:Request){
  try{
    guard(request);
    const input=schema.parse(await request.json());
    const viewer=await optionalUser();
    const database=db();

    await database.prepare(`CREATE TABLE IF NOT EXISTS market_partner_requests (
      id TEXT PRIMARY KEY,
      profile_id TEXT,
      shop_name TEXT NOT NULL,
      social_handle TEXT NOT NULL,
      category TEXT NOT NULL,
      city TEXT NOT NULL,
      monthly_volume TEXT,
      contact_whatsapp TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`).run();

    const id=crypto.randomUUID();
    await database.prepare(`INSERT INTO market_partner_requests (id,profile_id,shop_name,social_handle,category,city,monthly_volume,contact_whatsapp,notes)
      VALUES (?,?,?,?,?,?,?,?,?)`).bind(
      id,
      viewer?.id??null,
      input.shopName,
      input.socialHandle,
      input.category,
      input.city,
      input.monthlyVolume?.trim()||null,
      input.contactWhatsapp,
      input.notes?.trim()||null,
    ).run();

    return Response.json({id,ok:true},{status:201});
  }catch(error){
    return errorResponse(error);
  }
}
