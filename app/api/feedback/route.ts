import {z} from 'zod';
import {db,errorResponse,guard} from '@/lib/server/store';
import {verifyTurnstile} from '@/lib/server/turnstile';

const schema=z.object({
  category:z.enum(['bug','missing-card','missing-printing','card-data','rules','market-report','feedback']),
  summary:z.string().trim().min(4).max(120),
  details:z.string().trim().min(10).max(4000),
  cardCode:z.string().trim().max(40).optional().default(''),
  printingId:z.string().trim().max(80).optional().default(''),
  listingId:z.string().trim().max(80).optional().default(''),
  pagePath:z.string().trim().max(500),
  email:z.union([z.literal(''),z.string().trim().email().max(254)]).optional().default(''),
  website:z.string().max(500).optional().default(''),
});

export async function POST(request:Request){
  try{
    guard(request);
    const rejected=await verifyTurnstile(request);if(rejected)return rejected;
    const input=schema.parse(await request.json());
    if(input.website)return Response.json({ok:true});
    await db().prepare(`INSERT INTO feedback_reports(id,category,summary,details,card_code,printing_id,listing_id,page_path,contact_email) VALUES(?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),input.category,input.summary,input.details,input.cardCode||null,input.printingId||null,input.listingId||null,input.pagePath,input.email||null).run();
    return Response.json({ok:true});
  }catch(error){return errorResponse(error)}
}
