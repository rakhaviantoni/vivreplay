import {database} from '@/lib/server/database';
import {pokemonArtRoute} from '@/lib/pokemon-art-route';
import {pokemonLocalCardNumber} from '@/lib/pokemon-set-aliases';

const imagePath=(key:string|null,source:string|null)=>{
  if(key){
    const match=key.replace(/^\/+/, '').match(/^one-piece\/([^/]+)\/([^/]+)\/(?:small\/|thumb\/|large\/)?(.+)$/);
    if(match)return `/${encodeURIComponent(match[1].replaceAll('-',''))}/${encodeURIComponent(match[2].toLowerCase())}/${match[3].split('/').map(encodeURIComponent).join('/')}`;
  }
  return source??null;
};

export async function GET(_request:Request,{params}:{params:Promise<{printingId:string}>}){
  const {printingId}=await params;
  const normalized=decodeURIComponent(printingId).trim();
  const readable=normalized.match(/^(.+)--(en|jp|kr|cn)$/i);
  try{
    const row=await database().prepare(`SELECT p.id,p.identity_id AS identityId,p.language,p.variant,p.rarity,p.set_code AS setCode,p.set_name AS setName,p.printing_code AS printingCode,p.card_image_url AS imageUrl,p.source_payload AS sourcePayload,p.counter_amount AS counterAmount,p.attribute,p.life,p.sub_types AS subTypes,a.object_key AS objectKey,i.code,i.name,i.color,i.card_type AS cardType,i.cost,i.power,i.effect_text AS effect,g.slug AS gameSlug
      FROM tcg_card_printings p JOIN tcg_card_identities i ON i.id=p.identity_id JOIN tcg_games g ON g.id=i.game_id
      LEFT JOIN tcg_card_assets a ON a.printing_id=p.id AND a.kind='small'
      WHERE ${readable?'upper(coalesce(p.printing_code,i.code))=upper(?) AND upper(p.language)=upper(?)':'p.id=?'}
      ORDER BY CASE WHEN p.variant IS NULL OR p.variant='Standard' THEN 0 ELSE 1 END LIMIT 1`)
      .bind(...(readable?[readable[1],readable[2]]:[normalized]))
      .first<Record<string,unknown>>();
    if(!row)return Response.json({error:'Card printing not found.'},{status:404});
    let sourcePayload:unknown={};
    try{sourcePayload=typeof row.sourcePayload==='string'?JSON.parse(row.sourcePayload):row.sourcePayload??{}}catch{}
    const imageUrl=row.gameSlug==='pokemon'&&row.setCode&&row.printingCode
      ?pokemonArtRoute(String(row.language),String(row.setCode),pokemonLocalCardNumber(sourcePayload,String(row.printingCode)),String(row.id))
      :imagePath(typeof row.objectKey==='string'?row.objectKey:null,typeof row.imageUrl==='string'?row.imageUrl:null);
    return Response.json({...row,sourcePayload,imageUrl,objectKey:row.objectKey??null},{headers:{'Cache-Control':'public, max-age=300, stale-while-revalidate=86400','Cloudflare-CDN-Cache-Control':'public, max-age=86400'}});
  }catch{return Response.json({error:'Card printing is temporarily unavailable.'},{status:503})}
}
