import hashes from '@/packages/card-data/asset-hashes.json';
import {suppliedCardImage} from '@/packages/card-data/sources';
import {env} from 'cloudflare:workers';
import {getCurrentUser} from '@/lib/server/auth';
import {cards,printings,gameId} from '@/packages/card-data/catalog';
import type {CollectionItem,SavedDeck,Listing} from '@/packages/domain';
export function db(){if(!env.DB)throw new Error('Persistent storage is unavailable. Please retry shortly.');return env.DB;}
export async function seed(){const d=db();const stmts=[d.prepare('INSERT OR IGNORE INTO games (id,slug,name) VALUES (?,?,?)').bind(gameId,'one-piece','One Piece Card Game')];for(let i=0;i<6;i++)stmts.push(d.prepare('INSERT OR IGNORE INTO card_asset_sources (id,source_type,source_url,rights_status,hash,approved_for_display,approved_for_storage) VALUES (?,?,?,?,?,1,1)').bind(`30000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,'generated',`/art/card-${i}.webp`,'original-generated',hashes[String(i) as keyof typeof hashes]));stmts.push(d.prepare('INSERT OR IGNORE INTO card_asset_sources (id,source_type,source_url,rights_status,hash,approved_for_display,approved_for_storage) VALUES (?,?,?,?,?,?,?)').bind('30000000-0000-4000-8000-000000000007',suppliedCardImage.sourceType,suppliedCardImage.sourceUrl,suppliedCardImage.rightsStatus,'external-url-not-stored',1,0));for(const c of cards)stmts.push(d.prepare('INSERT OR IGNORE INTO card_identities (id,game_id,code,name,color,type,cost,power,effect) VALUES (?,?,?,?,?,?,?,?,?)').bind(c.id,gameId,c.code,c.name,c.color,c.type,c.cost,c.power,c.effect));for(const p of printings){const c=cards.find(c=>c.id===p.cardId)!;stmts.push(d.prepare('INSERT INTO card_printings (id,identity_id,language,set_code,rarity,variant,asset_source_id,image_url) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET asset_source_id=excluded.asset_source_id,image_url=excluded.image_url').bind(p.id,p.cardId,p.language,p.set,c.rarity,p.variant,p.assetSourceId,c.imageUrl??`/art/card-${c.art}.webp`));}await d.batch(stmts);}
function defaultUsername(email: string | undefined, id: string): string {
  if (!email) return `player-${id.slice(0, 8)}`;
  const prefix = (email.split('@')[0] || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!prefix) return `player-${id.slice(0, 8)}`;
  const clean = prefix.length < 3 ? `user-${prefix}` : prefix;
  return clean.slice(0, 24);
}

async function profileFor(auth:NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>){
  await seed();
  const d=db();
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
export function errorResponse(e:unknown){if(e instanceof HttpError)return Response.json({error:e.message},{status:e.status});if(e instanceof Error&&e.name==='ZodError')return Response.json({error:'Please check the form values.'},{status:400});console.error('request_failed',e instanceof Error?e.message:'Unknown error');return Response.json({error:'We could not save this change. Retry, and check for a duplicate certification or username.'},{status:500});}
export function guard(request:Request){const origin=request.headers.get('origin');if(origin&&new URL(request.url).origin!==origin)throw new HttpError(403,'Cross-site changes are not allowed.');if(Number(request.headers.get('content-length')||0)>100000)throw new HttpError(413,'Request is too large.');}
export async function collection(ownerId:string){const rows=(await db().prepare(`SELECT c.id,c.printing_id AS printingId,c.type,c.quantity,c.condition,c.visibility,c.acquisition_amount AS acquisitionAmount,c.currency,c.acquired_at AS acquiredAt,c.notes,p.name AS provider,g.grade,g.certification,g.subgrades,g.population,g.verification_status AS verificationStatus,g.verification_source AS verificationSource FROM collectible_instances c LEFT JOIN graded_cards g ON g.instance_id=c.id LEFT JOIN grading_providers p ON p.id=g.provider_id WHERE c.owner_id=? AND c.deleted_at IS NULL ORDER BY c.created_at DESC`).bind(ownerId).all<CollectionItem & {subgrades?:string|Record<string,unknown>;population?:string|Record<string,unknown>}>()).results;return rows.map(r=>({...r,subgrades:typeof r.subgrades==='string'?JSON.parse(r.subgrades):r.subgrades,population:typeof r.population==='string'?JSON.parse(r.population):r.population})) as CollectionItem[];}
export async function savedDecks(ownerId:string){const rows=(await db().prepare(`SELECT d.id,d.name,d.visibility,v.id AS versionId,v.number AS version,v.leader_id AS leaderId FROM decks d JOIN deck_versions v ON v.deck_id=d.id WHERE d.owner_id=? AND d.deleted_at IS NULL AND v.number=(SELECT MAX(number) FROM deck_versions WHERE deck_id=d.id) ORDER BY d.created_at DESC`).bind(ownerId).all<Omit<SavedDeck,'cards'>>()).results;return Promise.all(rows.map(async r=>({...r,cards:(await db().prepare('SELECT card_id AS cardId,quantity FROM deck_entries WHERE version_id=?').bind(r.versionId).all<{cardId:string;quantity:number}>()).results})));}
export async function market(){await seed();return (await db().prepare(`SELECT l.id,l.printing_id AS printingId,l.title,l.amount,l.currency,l.quantity,l.condition,l.type,l.city,l.created_at AS createdAt,p.display_name AS seller FROM listings l JOIN profiles p ON p.id=l.seller_id WHERE l.status='ACTIVE' ORDER BY l.created_at DESC LIMIT 100`).all<Listing>()).results;}
