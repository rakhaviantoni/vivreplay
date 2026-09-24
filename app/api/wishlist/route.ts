import {z} from 'zod';
import {user,db,errorResponse,guard} from '@/lib/server/store';
export async function POST(req:Request){try{guard(req);const p=await user();const v=z.object({printingId:z.string().uuid(),saved:z.boolean()}).parse(await req.json());await db().prepare(v.saved?'INSERT OR IGNORE INTO wishlists (owner_id,printing_id) VALUES (?,?)':'DELETE FROM wishlists WHERE owner_id=? AND printing_id=?').bind(p.id,v.printingId).run();return Response.json({ok:true})}catch(e){return errorResponse(e)}}
