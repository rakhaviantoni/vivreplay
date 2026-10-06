import {enabledShippingCouriers} from '@/lib/shipping/couriers';
import {env} from 'cloudflare:workers';
import {getCurrentUser} from '@/lib/server/auth';
import type {Card} from '@/packages/card-data/catalog';
import type {CollectionItem,SavedDeck,Listing} from '@/packages/domain';
import {supabaseAdmin} from '@/lib/server/supabase-storage';
type CatalogPrintingOption={id:string;language:string;variant:string;printing_code?:string;card_image_url?:string|null;rarity?:string;set_code?:string};
const catalogPrintingCache=new Map<string,{expiresAt:number;printings:CatalogPrintingOption[]}>();
async function catalogPrintingsFromSupabase(codes:string[]){
  const result=new Map<string,CatalogPrintingOption[]>();
  const missing=codes.filter(code=>{const cached=catalogPrintingCache.get(code);if(cached&&cached.expiresAt>Date.now()){result.set(code,cached.printings);return false;}return true;});
  const supabase=missing.length?supabaseAdmin():null;
  if(!supabase)return result;
  for(let offset=0;offset<missing.length;offset+=40){
    const chunk=missing.slice(offset,offset+40);
    const {data,error}=await supabase.from('tcg_card_printings').select('id,language,variant,printing_code,rarity,set_code,card_image_url,tcg_card_assets(kind,object_key),tcg_card_identities!inner(code)').in('tcg_card_identities.code',chunk);
    if(error)throw error;
    for(const row of (data??[]) as unknown as Array<Record<string,unknown>>){
      const identityValue=row.tcg_card_identities as {code?:string}|Array<{code?:string}>|null;
      const code=String(Array.isArray(identityValue)?identityValue[0]?.code:identityValue?.code??'').toUpperCase();
      const rawAssets=row.tcg_card_assets as Array<{kind?:string;object_key?:string}>|null;
      const objectKey=rawAssets?.find(asset=>asset.kind==='small')?.object_key;
      const setCode=String(row.set_code??'');
      const language=String(row.language??'EN');
      const printingCode=String(row.printing_code??code);
      const imageUrl=objectKey?`/${objectKey.replace(/^one-piece\/([^/]+)\//,(_match,set:string)=>`${set.replaceAll('-','')}/`)}`:String(row.card_image_url??`/${setCode.replaceAll('-','')}/${language.toLowerCase()}/${printingCode}.webp`);
      const values=result.get(code)??[];
      values.push({id:String(row.id),language,variant:String(row.variant??'Standard'),printing_code:printingCode,card_image_url:imageUrl,rarity:String(row.rarity??''),set_code:setCode});
      result.set(code,values);
    }
  }
  for(const code of missing){const values=result.get(code)??[];catalogPrintingCache.set(code,{expiresAt:Date.now()+10*60*1000,printings:values});}
  for(const code of codes){const cached=catalogPrintingCache.get(code);if(cached&&cached.expiresAt>Date.now())result.set(code,cached.printings);}
  return result;
}
export function db(){if(!env.DB)throw new Error('Persistent storage is unavailable. Please retry shortly.');return env.DB;}
function defaultUsername(email: string | undefined, id: string): string {
  if (!email) return `player-${id.slice(0, 8)}`;
  const prefix = (email.split('@')[0] || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!prefix) return `player-${id.slice(0, 8)}`;
  const clean = prefix.length < 3 ? `user-${prefix}` : prefix;
  return clean.slice(0, 24);
}

async function profileFor(auth:NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>){
  const d=db();
  await d.prepare("UPDATE profiles SET tier='free' WHERE auth_subject=? AND tier='pro' AND pro_expires_at IS NOT NULL AND pro_expires_at<=CURRENT_TIMESTAMP").bind(auth.id).run().catch(()=>undefined);
  let p=await d.prepare('SELECT * FROM profiles WHERE auth_subject=?').bind(auth.id).first<Record<string,string>>();
  if(!p){
    const id=crypto.randomUUID();
    let username=defaultUsername(auth.email, id);
    const existing=await d.prepare('SELECT id FROM profiles WHERE username=?').bind(username).first();
    if(existing){
      username=`${username.slice(0, 20)}-${id.slice(0, 4)}`;
    }
    await d.prepare('INSERT OR IGNORE INTO profiles (id,auth_subject,username,display_name) VALUES (?,?,?,?)').bind(id,auth.id,username,auth.name||username||'New collector').run();
    p=await d.prepare('SELECT * FROM profiles WHERE auth_subject=?').bind(auth.id).first<Record<string,string>>();
  }
  return p!;
}
export async function user(){const auth=await getCurrentUser();if(!auth)throw new HttpError(401,'Sign in to save to your account.');return profileFor(auth);}
export async function optionalUser(){const auth=await getCurrentUser();return auth?profileFor(auth):null;}
export class HttpError extends Error{constructor(public status:number,message:string){super(message)}}
export function errorResponse(e:unknown){
  if(e instanceof HttpError)return Response.json({error:e.message},{status:e.status});
  if(e instanceof Error&&e.name==='ZodError')return Response.json({error:'Please check the form values.'},{status:400});
  const message=e instanceof Error?e.message:'';
  if(/daily.*(?:(?:row|request)\s+)?(?:read|write).*limit|(?:read|write).*limit.*daily|exceed(?:ed|ing).*daily.*(?:read|write|row|request)|daily.*limit|too many requests.*database|database.*temporarily blocked|D1.*(?:row|request).*(?:limit|blocked|temporar)|(?:row|request).*(?:limit|blocked).*D1|maximum.*(?:rows|requests).*(?:day|daily)/i.test(message)){
    const now=new Date();
    const nextReset=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1);
    const retryAfter=Math.max(1,Math.ceil((nextReset-now.getTime())/1000));
    console.error('account_storage_daily_limit',message);
    return Response.json({error:'The Market data service has reached today’s database usage limit. Please try again after midnight UTC.'},{status:503,headers:{'Retry-After':String(retryAfter),'Cache-Control':'no-store'}});
  }
  console.error('request_failed',message||'Unknown error');
  return Response.json({error:'We could not save this change. Please try again.'},{status:500});
}
export function guard(request:Request){const origin=request.headers.get('origin');if(origin&&new URL(request.url).origin!==origin)throw new HttpError(403,'Cross-site changes are not allowed.');if(Number(request.headers.get('content-length')||0)>100000)throw new HttpError(413,'Request is too large.');}
async function consolidateRawStacks(ownerId:string){
  const rows=(await db().prepare(`SELECT c.id,c.printing_id AS printingId,c.condition,c.currency,c.quantity,c.acquisition_amount AS acquisitionAmount,c.visibility,c.acquired_at AS acquiredAt,c.notes
    FROM collectible_instances c WHERE c.owner_id=? AND c.type='RAW' AND c.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM listings l WHERE l.status IN ('ACTIVE','PAUSED') AND (l.instance_id=c.id OR EXISTS(SELECT 1 FROM json_each(l.items) entry WHERE json_extract(entry.value,'$.instanceId')=c.id))) ORDER BY c.created_at,c.id`).bind(ownerId).all<{id:string;printingId:string;condition:string;currency:string;quantity:number;acquisitionAmount:number;visibility:string;acquiredAt:string|null;notes:string|null}>()).results;
  const groups=new Map<string,typeof rows>();
  for(const row of rows){const key=`${row.printingId}\u0000${row.condition}\u0000${row.currency}`;const group=groups.get(key)??[];group.push(row);groups.set(key,group);}
  const statements=[];
  for(const group of groups.values()){
    if(group.length<2)continue;
    const [keeper,...duplicates]=group;
    const quantity=group.reduce((sum,row)=>sum+row.quantity,0);
    const acquisitionAmount=group.reduce((sum,row)=>sum+row.acquisitionAmount,0);
    const visibility=group.some(row=>row.visibility==='private')?'private':group.some(row=>row.visibility==='marketplace-only')?'marketplace-only':'public';
    const acquiredAt=group.map(row=>row.acquiredAt).filter((value):value is string=>Boolean(value)).sort()[0]??null;
    const notes=[...new Set(group.map(row=>row.notes?.trim()).filter((value):value is string=>Boolean(value)))].join('\n').slice(0,2000)||null;
    statements.push(db().prepare('UPDATE collectible_instances SET quantity=?,acquisition_amount=?,visibility=?,acquired_at=COALESCE(?,acquired_at),notes=? WHERE id=? AND owner_id=?').bind(quantity,acquisitionAmount,visibility,acquiredAt,notes,keeper.id,ownerId));
    for(const duplicate of duplicates)statements.push(db().prepare('UPDATE collectible_instances SET deleted_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=?').bind(duplicate.id,ownerId));
  }
  if(statements.length)await db().batch(statements);
}
export async function collection(ownerId:string){
  await consolidateRawStacks(ownerId);
  const rows=(await db().prepare(`
    SELECT c.id,c.printing_id AS printingId,c.type,c.quantity,c.condition,c.visibility,c.acquisition_amount AS acquisitionAmount,c.currency,c.acquired_at AS acquiredAt,c.notes,
      p.name AS provider,g.grade,g.certification,g.subgrades,g.population,g.verification_status AS verificationStatus,g.verification_source AS verificationSource,
      COALESCE((SELECT SUM(CASE WHEN l.items IS NULL THEN l.quantity ELSE 0 END) FROM listings l WHERE l.instance_id=c.id AND l.status='ACTIVE' AND (l.expires_at IS NULL OR l.expires_at>CURRENT_TIMESTAMP)),0)+COALESCE((SELECT SUM(CAST(json_extract(entry.value,'$.quantity') AS INTEGER)) FROM listings l,json_each(l.items) entry WHERE json_extract(entry.value,'$.instanceId')=c.id AND l.status='ACTIVE' AND (l.expires_at IS NULL OR l.expires_at>CURRENT_TIMESTAMP)),0) AS listedQuantity,
      COALESCE((SELECT l.id FROM listings l WHERE l.instance_id=c.id AND l.status='ACTIVE' AND (l.expires_at IS NULL OR l.expires_at>CURRENT_TIMESTAMP) ORDER BY l.created_at DESC LIMIT 1),(SELECT l.id FROM listings l,json_each(l.items) entry WHERE json_extract(entry.value,'$.instanceId')=c.id AND l.status='ACTIVE' AND (l.expires_at IS NULL OR l.expires_at>CURRENT_TIMESTAMP) ORDER BY l.created_at DESC LIMIT 1)) AS activeListingId,
      cp.language,cp.variant,cp.printing_code AS printingCode,cp.image_url AS imageUrl,cp.set_code AS setCode,cp.rarity,
      ci.id AS identityId,ci.code,ci.name AS cardName,ci.color,ci.type AS cardType,ci.cost,ci.power,ci.effect
    FROM collectible_instances c
    LEFT JOIN graded_cards g ON g.instance_id=c.id
    LEFT JOIN grading_providers p ON p.id=g.provider_id
    LEFT JOIN card_printings cp ON cp.id=c.printing_id
    LEFT JOIN card_identities ci ON ci.id=cp.identity_id
    WHERE c.owner_id=? AND c.deleted_at IS NULL ORDER BY c.created_at DESC
  `).bind(ownerId).all<CollectionItem & {subgrades?:string|Record<string,unknown>;population?:string|Record<string,unknown>;language?:string;variant?:string;printingCode?:string;imageUrl?:string;setCode?:string;rarity?:string;identityId?:string;code?:string;cardName?:string;color?:string;cardType?:string;cost?:number;power?:number;effect?:string}>()).results;
  const identityIds=[...new Set(rows.map(row=>(row as typeof row & {identityId?:string}).identityId).filter((id):id is string=>Boolean(id)))];
  const printingMap=new Map<string,Array<{id:string;language:string;variant:string;printing_code?:string;card_image_url?:string|null;rarity?:string;set_code?:string}>>();
  for(let offset=0;offset<identityIds.length;offset+=100){
    const chunk=identityIds.slice(offset,offset+100);
    const placeholders=chunk.map(()=>'?').join(',');
    const available=await db().prepare(`SELECT id,identity_id AS identityId,language,variant,printing_code AS printingCode,image_url AS imageUrl,rarity,set_code AS setCode FROM card_printings WHERE identity_id IN (${placeholders}) ORDER BY language,variant`).bind(...chunk).all<{id:string;identityId:string;language:string;variant:string;printingCode?:string;imageUrl?:string|null;rarity?:string;setCode?:string}>();
    for(const printing of available.results){const values=printingMap.get(printing.identityId)??[];values.push({id:printing.id,language:printing.language,variant:printing.variant,printing_code:printing.printingCode,card_image_url:printing.imageUrl,rarity:printing.rarity,set_code:printing.setCode});printingMap.set(printing.identityId,values);}
  }
  const codes=[...new Set(rows.map(row=>(row as typeof row & {code?:string}).code?.toUpperCase()).filter((code):code is string=>Boolean(code)))];
  const tcgPrintingMap=new Map<string,Array<{id:string;language:string;variant:string;printing_code?:string;card_image_url?:string|null;rarity?:string;set_code?:string}>>();
  try{
    for(let offset=0;offset<codes.length;offset+=100){
      const chunk=codes.slice(offset,offset+100);
      const placeholders=chunk.map(()=>'?').join(',');
      const available=await db().prepare(`SELECT p.id,i.code,p.language,p.variant,p.printing_code,p.rarity,p.set_code,p.card_image_url,a.object_key AS objectKey
        FROM tcg_card_printings p JOIN tcg_card_identities i ON i.id=p.identity_id
        LEFT JOIN tcg_card_assets a ON a.printing_id=p.id AND a.kind='small'
        WHERE upper(i.code) IN (${placeholders}) ORDER BY p.language,p.set_code,p.variant,p.printing_code`).bind(...chunk).all<{id:string;code:string;language:string;variant:string|null;printing_code:string|null;rarity:string|null;set_code:string|null;card_image_url:string|null;objectKey:string|null}>();
      for(const printing of available.results){
        const key=printing.code.toUpperCase();
        const values=tcgPrintingMap.get(key)??[];
        const objectKey=printing.objectKey;
        const imageUrl=objectKey?`/${objectKey.replace(/^one-piece\/([^/]+)\//,(_match,setCode:string)=>`${setCode.replaceAll('-','')}/`)}`:printing.card_image_url;
        values.push({id:printing.id,language:printing.language,variant:printing.variant??'Standard',printing_code:printing.printing_code??undefined,card_image_url:imageUrl,rarity:printing.rarity??undefined,set_code:printing.set_code??undefined});
        tcgPrintingMap.set(key,values);
      }
    }
  }catch{tcgPrintingMap.clear();}
  if(codes.length){
    try{
      const fallback=await catalogPrintingsFromSupabase(codes);
      for(const [code,values] of fallback){
        const combined=[...(tcgPrintingMap.get(code)??[]),...values];
        tcgPrintingMap.set(code,combined.filter((printing,index,all)=>all.findIndex(candidate=>`${candidate.language}|${candidate.set_code}|${candidate.variant}|${candidate.printing_code}`===`${printing.language}|${printing.set_code}|${printing.variant}|${printing.printing_code}`)===index));
      }
    }catch{}
  }
  return rows.map(row=>{
    const availablePrintings=[...(printingMap.get(row.identityId??'')??[]),...(tcgPrintingMap.get(row.code?.toUpperCase()??'')??[])].filter((printing,index,all)=>all.findIndex(candidate=>`${candidate.language}|${candidate.set_code}|${candidate.variant}|${candidate.printing_code}`===`${printing.language}|${printing.set_code}|${printing.variant}|${printing.printing_code}`)===index);
    if(!availablePrintings.length&&row.code)availablePrintings.push({id:row.printingId,language:row.language??'EN',variant:row.variant??'Standard',printing_code:row.printingCode??row.code,card_image_url:row.imageUrl,rarity:row.rarity,set_code:row.setCode});
    return {...row,
    subgrades:typeof row.subgrades==='string'?JSON.parse(row.subgrades):row.subgrades,
    population:typeof row.population==='string'?JSON.parse(row.population):row.population,
    card:row.code?{
      id:row.identityId??row.printingId,code:row.code,name:row.cardName??row.code,color:row.color??'Red',type:row.cardType??'Character',cost:row.cost??0,power:row.power??0,rarity:row.rarity??'',effect:row.effect??'',imageUrl:row.imageUrl,imageSource:'external',setCode:row.setCode,language:row.language,printingCode:row.printingCode??row.code,variant:row.variant,
      availablePrintings,
    }:undefined,
  }}) as CollectionItem[];
}
export async function savedDecks(ownerId:string){const rows=(await db().prepare(`SELECT d.id,d.name,d.visibility,v.id AS versionId,v.number AS version,v.leader_id AS leaderId FROM decks d JOIN deck_versions v ON v.deck_id=d.id WHERE d.owner_id=? AND d.deleted_at IS NULL AND v.number=(SELECT MAX(number) FROM deck_versions WHERE deck_id=d.id) ORDER BY d.created_at DESC`).bind(ownerId).all<Omit<SavedDeck,'cards'>>()).results;return Promise.all(rows.map(async r=>({...r,cards:(await db().prepare('SELECT card_id AS cardId,quantity FROM deck_entries WHERE version_id=?').bind(r.versionId).all<{cardId:string;quantity:number}>()).results})));}
export async function market(){
  const rows = (await db().prepare(`
    SELECT
      l.id,
      l.printing_id AS printingId,
      l.title,
      l.amount,
      l.currency,
      l.quantity,
      l.condition,
      l.type,
      l.negotiable,
      l.city,
      l.created_at AS createdAt,
      l.expires_at AS expiresAt,
      l.items AS itemsJson,
      o.label AS shippingOriginLabel,
      p.display_name AS seller,
      cp.image_url AS cardImageUrl,
      cp.language AS cardLanguage,
      cp.rarity AS cardRarity,
      cp.set_code AS cardSetCode,
      cp.variant AS cardVariant,
      ci.id AS cardIdentityId,
      ci.code AS cardCode,
      ci.name AS cardName,
      ci.color AS cardColor,
      ci.type AS cardType,
      ci.cost AS cardCost,
      ci.power AS cardPower,
      ci.effect AS cardEffect
    FROM listings l
    JOIN profiles p ON p.id=l.seller_id
    LEFT JOIN card_printings cp ON cp.id=l.printing_id
    LEFT JOIN card_identities ci ON ci.id=cp.identity_id
    LEFT JOIN seller_shipping_origins o ON o.owner_id=l.seller_id
    WHERE l.status='ACTIVE' AND (l.expires_at IS NULL OR l.expires_at > CURRENT_TIMESTAMP)
    ORDER BY l.created_at DESC
    LIMIT 100
  `).all<{
    id:string;
    printingId:string;
    title:string;
    amount:number;
    currency:string;
    quantity:number;
    condition:string;
    type:string;
    negotiable:number;
    city:string;
    createdAt:string;
    expiresAt?:string;
    seller:string;
    cardImageUrl?:string;
    cardLanguage?:string;
    cardRarity?:string;
    cardSetCode?:string;
    cardVariant?:string;
    cardIdentityId?:string;
    cardCode?:string;
    cardName?:string;
    cardColor?:string;
    cardType?:string;
    cardCost?:number;
    cardPower?:number;
    cardEffect?:string;
    itemsJson?:string;
    shippingOriginLabel?:string|null;
  }>()).results;

  const printingIds=[...new Set(rows.flatMap(row=>{
    try{
      const items=JSON.parse(row.itemsJson??'[]') as unknown;
      return Array.isArray(items)?items.map(item=>item&&typeof item.printingId==='string'?item.printingId:'').filter(Boolean):[];
    }catch{return []}
  }))];
  const bundleCards=new Map<string,Card>();
  for(let offset=0;offset<printingIds.length;offset+=80){
    const chunk=printingIds.slice(offset,offset+80);
    const printingRows=(await db().prepare(`SELECT p.id AS printingId,p.image_url AS imageUrl,p.language,p.variant,p.printing_code AS printingCode,p.rarity,p.set_code AS setCode,i.id AS identityId,i.code,i.name,i.color,i.type,i.cost,i.power,i.effect FROM card_printings p LEFT JOIN card_identities i ON i.id=p.identity_id WHERE p.id IN (${chunk.map(()=>'?').join(',')})`).bind(...chunk).all<{printingId:string;imageUrl:string|null;language:string;variant:string|null;printingCode:string|null;rarity:string|null;setCode:string|null;identityId:string|null;code:string|null;name:string|null;color:string|null;type:string|null;cost:number|null;power:number|null;effect:string|null}>()).results;
    for(const item of printingRows){
      bundleCards.set(item.printingId,{id:item.identityId??item.printingId,code:item.code??item.printingCode??item.printingId,name:item.name??item.code??item.printingCode??item.printingId,color:item.color??'Red',type:(item.type as Card['type'])??'Character',cost:item.cost??0,power:item.power??0,rarity:item.rarity??'',art:0,effect:item.effect??'',imageUrl:item.imageUrl??undefined,imageSource:'external',setCode:item.setCode??undefined,language:item.language,printingCode:item.printingCode??item.code??undefined,variant:item.variant??'Standard'});
    }
  }

  return rows.map(r => {
    const filenameCode = r.cardImageUrl ? r.cardImageUrl.split('?')[0].split('#')[0].split('/').pop()?.replace(/\.[^.]+$/, '') : undefined;
    const printingCode = filenameCode ?? r.cardCode;

    const card: Card | undefined = (r.cardCode || r.cardImageUrl) ? {
      id: r.cardIdentityId ?? r.printingId,
      code: r.cardCode ?? '',
      name: r.cardName ?? r.title,
      color: r.cardColor ?? 'Red',
      type: (r.cardType as Card['type']) ?? 'Character',
      cost: r.cardCost ?? 0,
      power: r.cardPower ?? 0,
      rarity: r.cardRarity ?? '',
      art: 0,
      effect: r.cardEffect ?? '',
      imageUrl: r.cardImageUrl,
      imageSource: 'external',
      setCode: r.cardSetCode,
      language: r.cardLanguage,
      printingCode,
      variant: r.cardVariant,
    } : undefined;

    const parsedItems = r.itemsJson ? (()=>{try{return JSON.parse(r.itemsJson);}catch{return undefined;}})() : undefined;
    const validItems=Array.isArray(parsedItems)?parsedItems.filter((item):item is {printingId:string;quantity:number;condition?:string;unitAmount?:number}=>Boolean(item&&typeof item.printingId==='string'&&Number.isInteger(item.quantity)&&item.quantity>0)):[];
    const itemQuantity=validItems.reduce((total,item)=>total+item.quantity,0)||r.quantity;
    const fallbackUnitAmount=Math.max(1,Math.floor(r.amount/Math.max(1,itemQuantity)));
    const items=validItems.length?validItems.map(item=>({...item,condition:item.condition||r.condition,unitAmount:Number.isSafeInteger(item.unitAmount)&&Number(item.unitAmount)>0?Number(item.unitAmount):fallbackUnitAmount,card:bundleCards.get(item.printingId)})):undefined;
    let methods:string[]=[];
    if(r.shippingOriginLabel){try{const parsed=JSON.parse(r.shippingOriginLabel);if(Array.isArray(parsed.methods))methods=parsed.methods.filter((value:unknown):value is string=>typeof value==='string')}catch{}}
    const couriers=new Set(enabledShippingCouriers(methods));

    return {
      id: r.id,
      printingId: r.printingId,
      title: r.title,
      amount: r.amount,
      currency: r.currency,
      quantity: r.quantity,
      condition: r.condition,
      type: r.type,
      negotiable: r.negotiable !== 0,
      city: r.city,
      createdAt: r.createdAt,
      expiresAt: r.expiresAt,
      seller: r.seller,
      language: r.cardLanguage ?? 'EN',
      card,
      items,
      shippingOptionCount:couriers.size,
    } satisfies Listing;
  });
}
