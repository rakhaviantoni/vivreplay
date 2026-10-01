import {env} from 'cloudflare:workers';
import {getCurrentUser} from '@/lib/server/auth';
import type {Card} from '@/packages/card-data/catalog';
import type {CollectionItem,SavedDeck,Listing} from '@/packages/domain';
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
  if(/daily.*row\s+(?:read|write)\s+limit|exceeded.*(?:read|write) limit/i.test(message)){
    const now=new Date();
    const nextReset=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1);
    const retryAfter=Math.max(1,Math.ceil((nextReset-now.getTime())/1000));
    console.error('account_storage_daily_limit',message);
    return Response.json({error:'Account storage has reached today’s usage limit. Please try again after midnight UTC.'},{status:503,headers:{'Retry-After':String(retryAfter),'Cache-Control':'no-store'}});
  }
  console.error('request_failed',message||'Unknown error');
  return Response.json({error:'We could not save this change. Please try again.'},{status:500});
}
export function guard(request:Request){const origin=request.headers.get('origin');if(origin&&new URL(request.url).origin!==origin)throw new HttpError(403,'Cross-site changes are not allowed.');if(Number(request.headers.get('content-length')||0)>100000)throw new HttpError(413,'Request is too large.');}
export async function collection(ownerId:string){
  const rows=(await db().prepare(`
    SELECT c.id,c.printing_id AS printingId,c.type,c.quantity,c.condition,c.visibility,c.acquisition_amount AS acquisitionAmount,c.currency,c.acquired_at AS acquiredAt,c.notes,
      p.name AS provider,g.grade,g.certification,g.subgrades,g.population,g.verification_status AS verificationStatus,g.verification_source AS verificationSource,
      COALESCE((SELECT SUM(l.quantity) FROM listings l WHERE l.instance_id=c.id AND l.status='ACTIVE' AND (l.expires_at IS NULL OR l.expires_at>CURRENT_TIMESTAMP)),0) AS listedQuantity,
      cp.language,cp.variant,cp.printing_code AS printingCode,cp.image_url AS imageUrl,cp.set_code AS setCode,cp.rarity,
      ci.id AS identityId,ci.code,ci.name AS cardName,ci.color,ci.type AS cardType,ci.cost,ci.power,ci.effect
    FROM collectible_instances c
    LEFT JOIN graded_cards g ON g.instance_id=c.id
    LEFT JOIN grading_providers p ON p.id=g.provider_id
    LEFT JOIN card_printings cp ON cp.id=c.printing_id
    LEFT JOIN card_identities ci ON ci.id=cp.identity_id
    WHERE c.owner_id=? AND c.deleted_at IS NULL ORDER BY c.created_at DESC
  `).bind(ownerId).all<CollectionItem & {subgrades?:string|Record<string,unknown>;population?:string|Record<string,unknown>;language?:string;variant?:string;printingCode?:string;imageUrl?:string;setCode?:string;rarity?:string;identityId?:string;code?:string;cardName?:string;color?:string;cardType?:string;cost?:number;power?:number;effect?:string}>()).results;
  return rows.map(row=>({...row,
    subgrades:typeof row.subgrades==='string'?JSON.parse(row.subgrades):row.subgrades,
    population:typeof row.population==='string'?JSON.parse(row.population):row.population,
    card:row.code?{
      id:row.identityId??row.printingId,code:row.code,name:row.cardName??row.code,color:row.color??'Red',type:row.cardType??'Character',cost:row.cost??0,power:row.power??0,rarity:row.rarity??'',effect:row.effect??'',imageUrl:row.imageUrl,imageSource:'external',setCode:row.setCode,language:row.language,printingCode:row.printingCode??row.code,variant:row.variant,
      availablePrintings:[{id:row.printingId,language:row.language??'EN',variant:row.variant??'Standard',printing_code:row.printingCode??row.code,card_image_url:row.imageUrl,rarity:row.rarity,set_code:row.setCode}],
    }:undefined,
  })) as CollectionItem[];
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

    const items = r.itemsJson ? (()=>{try{return JSON.parse(r.itemsJson);}catch{return undefined;}})() : undefined;
    let methods:string[]=[];
    if(r.shippingOriginLabel){try{const parsed=JSON.parse(r.shippingOriginLabel);if(Array.isArray(parsed.methods))methods=parsed.methods.filter((value:unknown):value is string=>typeof value==='string')}catch{}}
    const couriers=new Set<string>();
    const regular=['jnt','jne','sicepat','anteraja','tiki','pos','lion','ninja','wahana'];
    const instant=['grab','gojek'];
    for(const method of methods){if(method==='regular')regular.forEach(value=>couriers.add(value));else if(method==='instant')instant.forEach(value=>couriers.add(value));else if([...regular,...instant].includes(method))couriers.add(method)}

    return {
      id: r.id,
      printingId: r.printingId,
      title: r.title,
      amount: r.amount,
      currency: r.currency,
      quantity: r.quantity,
      condition: r.condition,
      type: r.type,
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
