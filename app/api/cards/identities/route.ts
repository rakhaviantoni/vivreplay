import {database} from '@/lib/server/database';
import {supabaseAdmin} from '@/lib/server/supabase-storage';
import {isPlayableSet,PREVIEW_CARD_CODES} from '@/packages/domain/release-availability';

type IdentityRow={id:string;code:string;name:string;color:string;card_type:string;cost:number;power:number;effect_text:string;rarity?:string|null;imageUrl?:string;set_code?:string|null;tcg_card_printings?:Array<{language:string;rarity:string|null;set_code:string|null;card_image_url:string|null;tcg_card_assets?:Array<{kind:string;object_key:string}>}>};
type SearchFilters={tokens:string[];cardType:string|null;cost:number|null;power:number|null;colors:string[];rarity:string|null};

function parseSearch(raw:string):SearchFilters{
  let query=raw;
  const colors:string[]=[];
  const colorNames:Record<string,string>={red:'RED',green:'GREEN',blue:'BLUE',purple:'PURPLE',black:'BLACK',yellow:'YELLOW'};
  const codeColors:Record<string,string>={R:'RED',G:'GREEN',U:'BLUE',P:'PURPLE',B:'BLACK',Y:'YELLOW'};
  const codeExpression=/(?:^|\s)(?:color\s+)?([RGUPBY](?:\s*[\/+]\s*[RGUPBY])+)(?=\s|$)/gi;
  for(const match of query.matchAll(codeExpression)){
    colors.push(...match[1].toUpperCase().split(/[\/+\s]+/).filter(Boolean).map(code=>codeColors[code]));
    query=query.replace(match[0],' ');
  }
  const costMatch=query.match(/(?:\b(\d+)\s*c\b|\bcost\s*(\d+)\b|\b(\d+)\s*cost\b)/i);
  const cost=costMatch?Number(costMatch[1]??costMatch[2]??costMatch[3]):null;
  if(costMatch)query=query.replace(costMatch[0],' ');
  const powerMatch=query.match(/(?:\b(\d+(?:\.\d+)?)\s*k\b|\bpower\s*(\d+)\b)/i);
  const power=powerMatch?Math.round(Number(powerMatch[1])*1000||Number(powerMatch[2])):null;
  if(powerMatch)query=query.replace(powerMatch[0],' ');

  const colorWords=new RegExp(`\\b(${Object.keys(colorNames).join('|')})\\b`,'gi');
  for(const match of query.matchAll(colorWords))colors.push(colorNames[match[1].toLowerCase()]);
  query=query.replace(colorWords,' ');
  const namedColorCode=query.match(/\bcolor\s+([RGUPBY])\b/i);
  if(namedColorCode){colors.push(codeColors[namedColorCode[1].toUpperCase()]);query=query.replace(namedColorCode[0],' ')}

  const typeAliases:Record<string,string>={leader:'LEADER',leaders:'LEADER',character:'CHARACTER',characters:'CHARACTER',event:'EVENT',events:'EVENT',stage:'STAGE',stages:'STAGE',don:'DON',dons:'DON'};
  const rarityNames=new Set(['SEC','PSEC','SR','SP','UC','R','C','L','TR']);
  let cardType:string|null=null;let rarity:string|null=null;
  const rawTokens=query.replace(/[^\p{L}\p{N}\s-]/gu,'').replace(/\s+/g,' ').trim().split(' ').filter(Boolean);
  const tokens:string[]=[];
  for(const token of rawTokens){
    const upper=token.toUpperCase();
    if(typeAliases[upper.toLowerCase()]){cardType=typeAliases[upper.toLowerCase()];continue}
    if(rarityNames.has(upper)){rarity=upper;continue}
    if(token.length>=2)tokens.push(token);
  }
  return{tokens:[...new Set(tokens)].slice(0,8),cardType,cost,power,colors:[...new Set(colors)],rarity};
}

async function fromD1(filters:SearchFilters){
  const conditions:string[]=[];const values:(string|number)[]=[];
  for(const token of filters.tokens){
    const pattern=`%${token}%`;
    conditions.push(`(UPPER(i.code) LIKE ? OR LOWER(i.name) LIKE ? OR LOWER(i.effect_text) LIKE ? OR UPPER(i.color) LIKE ? OR UPPER(i.card_type) LIKE ? OR CAST(i.cost AS TEXT)=? OR CAST(i.power AS TEXT)=? OR EXISTS(SELECT 1 FROM tcg_card_printings fp WHERE fp.identity_id=i.id AND (UPPER(fp.set_code) LIKE ? OR UPPER(fp.rarity) LIKE ? OR LOWER(CAST(fp.sub_types AS TEXT)) LIKE ?)))`);
    values.push(pattern,pattern,pattern,pattern,pattern,token,token,pattern,pattern,pattern);
  }
  if(filters.cardType){conditions.push('UPPER(i.card_type) LIKE ?');values.push(`%${filters.cardType}%`)}
  if(filters.cost!==null){conditions.push('i.cost=?');values.push(filters.cost)}
  if(filters.power!==null){conditions.push('i.power=?');values.push(filters.power)}
  for(const color of filters.colors){conditions.push('UPPER(i.color) LIKE ?');values.push(`%${color}%`)}
  if(filters.rarity){conditions.push('EXISTS(SELECT 1 FROM tcg_card_printings rp WHERE rp.identity_id=i.id AND UPPER(rp.rarity) LIKE ?)');values.push(`%${filters.rarity}%`)}
  if(!conditions.length)return[];
  const result=await database().prepare(`
    SELECT i.id,i.code,i.name,i.color,i.card_type,i.cost,i.power,i.effect_text,
      (SELECT p.rarity FROM tcg_card_printings p WHERE p.identity_id=i.id AND p.language='EN' ORDER BY p.set_code,p.id LIMIT 1) AS rarity,
      (SELECT p.set_code FROM tcg_card_printings p WHERE p.identity_id=i.id ORDER BY CASE WHEN p.language='EN' THEN 0 ELSE 1 END,p.set_code,p.id LIMIT 1) AS set_code,
      (SELECT COALESCE(NULLIF(a.object_key,''),NULLIF(p.card_image_url,'')) FROM tcg_card_printings p LEFT JOIN tcg_card_assets a ON a.printing_id=p.id AND a.kind='small' WHERE p.identity_id=i.id ORDER BY CASE WHEN p.language='EN' THEN 0 ELSE 1 END,p.set_code,p.id LIMIT 1) AS imageUrl
    FROM tcg_card_identities i WHERE ${conditions.join(' AND ')} ORDER BY CASE WHEN ${filters.tokens.length?'LOWER(i.name) LIKE ?':'1=1'} THEN 0 ELSE 1 END,i.code LIMIT 30
  `).bind(...values,...(filters.tokens.length?[`${filters.tokens[0].toLowerCase()}%`]:[])).all<IdentityRow>();
  return result.results;
}

async function fromSupabase(filters:SearchFilters){
  const client=supabaseAdmin();if(!client)throw new Error('Card catalog is unavailable.');
  let matchedIds:Set<string>|null=null;
  const intersect=(next:Set<string>)=>{if(matchedIds===null)matchedIds=next;else matchedIds=new Set([...matchedIds].filter(id=>next.has(id)))};
  for(const token of filters.tokens){
    const pattern=`%${token}%`;
    const [identities,printings]=await Promise.all([
      client.from('tcg_card_identities').select('id').or(`code.ilike.${pattern},name.ilike.${pattern},effect_text.ilike.${pattern},card_type.ilike.${pattern}`).limit(1000),
      client.from('tcg_card_printings').select('identity_id').or(`set_code.ilike.${pattern},rarity.ilike.${pattern}`).limit(2000),
    ]);
    if(identities.error)throw identities.error;if(printings.error)throw printings.error;
    intersect(new Set([...((identities.data??[]) as Array<{id:string}>).map(row=>row.id),...((printings.data??[]) as Array<{identity_id:string}>).map(row=>row.identity_id)]));
  }
  let structured=client.from('tcg_card_identities').select('id');
  if(filters.cardType)structured=structured.ilike('card_type',`%${filters.cardType}%`);
  if(filters.cost!==null)structured=structured.eq('cost',filters.cost);
  if(filters.power!==null)structured=structured.eq('power',filters.power);
  for(const color of filters.colors)structured=structured.ilike('color',`%${color}%`);
  if(filters.cardType||filters.cost!==null||filters.power!==null||filters.colors.length){
    const {data,error}=await structured.limit(2000);if(error)throw error;intersect(new Set((data??[]).map(row=>(row as {id:string}).id)));
  }
  if(filters.rarity){const {data,error}=await client.from('tcg_card_printings').select('identity_id').ilike('rarity',`%${filters.rarity}%`).limit(2000);if(error)throw error;intersect(new Set((data??[]).map(row=>(row as {identity_id:string}).identity_id)))}
  const ids=[...(matchedIds??[])].slice(0,250);if(!ids.length)return[];
  const {data,error}=await client.from('tcg_card_identities').select('id,code,name,color,card_type,cost,power,effect_text,tcg_card_printings(language,rarity,set_code,card_image_url,tcg_card_assets(kind,object_key))').in('id',ids).limit(250);
  if(error)throw error;
  return ((data??[]) as unknown as IdentityRow[]).filter(row=>row.tcg_card_printings?.some(printing=>isPlayableSet(printing.set_code))).map(row=>{
    const printing=row.tcg_card_printings?.find(item=>item.language==='EN')??row.tcg_card_printings?.[0];
    const asset=printing?.tcg_card_assets?.find(item=>item.kind==='small');
    return{...row,rarity:printing?.rarity??null,set_code:printing?.set_code??null,imageUrl:asset?.object_key??printing?.card_image_url??undefined};
  }).slice(0,30);
}

export async function GET(request:Request){
  const raw=new URL(request.url).searchParams.get('q')?.trim()??'';
  if(raw.length<2)return Response.json({cards:[]});
  const filters=parseSearch(raw);
  if(!filters.tokens.length&&!filters.cardType&&filters.cost===null&&filters.power===null&&!filters.colors.length&&!filters.rarity)return Response.json({cards:[]});
  let cards:IdentityRow[];
  try{cards=await fromD1(filters)}catch{try{cards=await fromSupabase(filters)}catch{return Response.json({error:'Card catalog is temporarily unavailable.'},{status:503})}}
  cards=cards.filter(card=>isPlayableSet(card.set_code??'')||PREVIEW_CARD_CODES.has(card.code.toUpperCase()));
  return Response.json({cards:cards.map(card=>({...card,imageUrl:card.imageUrl?.startsWith('http')||card.imageUrl?.startsWith('/')?card.imageUrl:card.imageUrl?`/${card.imageUrl.replace(/^\/+/, '').replace(/^one-piece\/([^/]+)\//,(_,setCode:string)=>`${setCode.replaceAll('-','')}/`)}`:undefined}))},{headers:{'Cache-Control':'public, max-age=300, stale-while-revalidate=86400','Cloudflare-CDN-Cache-Control':'public, max-age=86400'}});
}
