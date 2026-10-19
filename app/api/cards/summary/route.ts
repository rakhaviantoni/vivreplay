import {database} from '@/lib/server/database';
import {readPublicEdgeCache,storePublicEdgeCache} from '@/lib/server/public-edge-cache';

export async function GET(request:Request){
  const cached=await readPublicEdgeCache(request);if(cached)return cached;
  try{
    const game=new URL(request.url).searchParams.get('game')?.toLowerCase()==='pokemon'?'pokemon':'one-piece';
    const row=await database().prepare(`SELECT (SELECT COUNT(*) FROM tcg_card_identities WHERE game_id=(SELECT id FROM tcg_games WHERE slug=?)) AS identities,(SELECT COUNT(*) FROM tcg_card_printings p JOIN tcg_card_identities i ON i.id=p.identity_id WHERE i.game_id=(SELECT id FROM tcg_games WHERE slug=?)) AS printings`).bind(game,game).first<{identities:number;printings:number}>();
    return storePublicEdgeCache(request,Response.json({identities:Number(row?.identities)||0,printings:Number(row?.printings)||0},{headers:{'Cache-Control':'public, max-age=300, stale-while-revalidate=3600'}}));
  }catch{return Response.json({error:'Catalog counts are temporarily unavailable.'},{status:503})}
}
