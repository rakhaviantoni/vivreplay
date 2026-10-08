import { database } from '@/lib/server/database';
import { supabaseAdmin } from '@/lib/server/supabase-storage';
import { isPlayableSet, PREVIEW_CARD_CODES } from '@/packages/domain/release-availability';

type IdentityRow = {id:string;code:string;name:string;color:string;card_type:string;cost:number;power:number;effect_text:string;rarity?:string|null;imageUrl?:string;set_code?:string|null;tcg_card_printings?:Array<{language:string;rarity:string|null;set_code:string|null;card_image_url:string|null;tcg_card_assets?:Array<{kind:string;object_key:string}>}>};

function publicCardPath(objectKey:string) {
  return `/${objectKey.replace(/^\/+/, '').replace(/^one-piece\/([^/]+)\//,(_,setCode:string)=>`${setCode.replaceAll('-','')}/`)}`;
}

async function fromD1(tokens:string[]) {
  const conditions=tokens.map(()=>`(UPPER(i.code) LIKE ? OR LOWER(i.name) LIKE ? OR EXISTS (SELECT 1 FROM tcg_card_printings fp WHERE fp.identity_id=i.id AND UPPER(fp.set_code) LIKE ?))`);
  const values=tokens.flatMap(token=>{const pattern=`%${token}%`;return [pattern,pattern,pattern]});
  const {results} = await database().prepare(`
    SELECT i.id,i.code,i.name,i.color,i.card_type,i.cost,i.power,i.effect_text,
      (SELECT p.rarity FROM tcg_card_printings p WHERE p.identity_id=i.id AND p.language='EN' ORDER BY p.set_code,p.id LIMIT 1) AS rarity,
      (SELECT p.set_code FROM tcg_card_printings p WHERE p.identity_id=i.id ORDER BY CASE WHEN p.language='EN' THEN 0 ELSE 1 END,p.set_code,p.id LIMIT 1) AS set_code,
      (SELECT COALESCE(NULLIF(a.object_key,''),NULLIF(p.card_image_url,'')) FROM tcg_card_printings p LEFT JOIN tcg_card_assets a ON a.printing_id=p.id AND a.kind='small' WHERE p.identity_id=i.id ORDER BY CASE WHEN p.language='EN' THEN 0 ELSE 1 END,p.set_code,p.id LIMIT 1) AS imageUrl
    FROM tcg_card_identities i
    WHERE ${conditions.join(' AND ')}
    ORDER BY i.code LIMIT 30
  `).bind(...values).all<IdentityRow>();
  return results;
}

async function fromSupabase(tokens:string[]) {
  const db = supabaseAdmin();
  if (!db) throw new Error('Card catalog is unavailable.');
  let matchedIds:Set<string>|null=null;
  for(const token of tokens){
    const pattern=`%${token}%`;
    const [identities,printings]=await Promise.all([
      db.from('tcg_card_identities').select('id').or(`code.ilike.${pattern},name.ilike.${pattern}`).limit(250),
      db.from('tcg_card_printings').select('identity_id').ilike('set_code',pattern).limit(1000),
    ]);
    if(identities.error)throw identities.error;
    if(printings.error)throw printings.error;
    const tokenIds=new Set<string>([
      ...((identities.data??[]) as Array<{id:string}>).map(row=>row.id),
      ...((printings.data??[]) as Array<{identity_id:string}>).map(row=>row.identity_id),
    ]);
    if(matchedIds===null)matchedIds=tokenIds;
    else{const intersection=new Set<string>();for(const id of matchedIds)if(tokenIds.has(id))intersection.add(id);matchedIds=intersection;}
    if(!matchedIds.size)return [];
  }
  const ids=[...(matchedIds??[])].slice(0,100);
  if(!ids.length)return [];
  const {data,error} = await db.from('tcg_card_identities')
    .select('id,code,name,color,card_type,cost,power,effect_text,tcg_card_printings(language,rarity,set_code,card_image_url,tcg_card_assets(kind,object_key))')
    .in('id',ids)
    .limit(100);
  if (error) throw error;
  return ((data ?? []) as unknown as IdentityRow[]).map(row => {
    const printing=row.tcg_card_printings?.find(item=>item.language==='EN') ?? row.tcg_card_printings?.[0];
    const imageKey=printing?.tcg_card_assets?.find(asset=>asset.kind==='small')?.object_key ?? printing?.card_image_url ?? '';
    return {...row,rarity:printing?.rarity ?? null,set_code:printing?.set_code ?? null,imageUrl:imageKey.startsWith('http')?imageKey:imageKey?publicCardPath(imageKey):undefined};
  });
}

export async function GET(request:Request) {
  const raw = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  const query = raw.replace(/[^\p{L}\p{N}\s-]/gu,'').replace(/\s+/g,' ');
  if (query.length < 2) return Response.json({cards:[]});
  const tokens=[...new Set(query.split(/\s+/).map(token=>token.trim()).filter(token=>token.length>=2))].slice(0,8);
  if(!tokens.length)return Response.json({cards:[]});
  let cards:IdentityRow[];
  try { cards = await fromD1(tokens); }
  catch {
    try { cards = await fromSupabase(tokens); }
    catch { return Response.json({error:'Card catalog is temporarily unavailable.'},{status:503}); }
  }
  cards=cards.filter(card=>isPlayableSet(card.set_code??'')||PREVIEW_CARD_CODES.has(card.code.toUpperCase()));
  return Response.json({cards:cards.map(card=>({...card,imageUrl:card.imageUrl?.startsWith('http')||card.imageUrl?.startsWith('/')?card.imageUrl:card.imageUrl?publicCardPath(card.imageUrl):undefined}))},{headers:{'Cache-Control':'public, max-age=300, stale-while-revalidate=86400','Cloudflare-CDN-Cache-Control':'public, max-age=86400'}});
}
