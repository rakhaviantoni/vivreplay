import {user,db,errorResponse,guard,HttpError} from '@/lib/server/store';
import {collectionInput} from '@/packages/domain';
import {printings,gameId} from '@/packages/card-data/catalog';

const liveAssetSourceId='30000000-0000-4000-8000-000000000008';
async function ensureCatalogPrinting(input:Awaited<ReturnType<typeof collectionInput.parse>>){
  if(printings.some(item=>item.id===input.printingId))return;
  const card=input.catalogCard;
  if(!card)throw new HttpError(400,'This card is not available for Vault yet.');
  const d=db();
  const identity=await d.prepare('SELECT id FROM card_identities WHERE game_id=? AND code=?').bind(gameId,card.code).first<{id:string}>();
  const identityId=identity?.id??crypto.randomUUID();
  const assetUrl=card.imageUrl??`catalog://${card.code}`;
  await d.batch([
    d.prepare('INSERT OR IGNORE INTO card_asset_sources (id,source_type,source_url,rights_status,hash,approved_for_display,approved_for_storage) VALUES (?,?,?,?,?,?,?)').bind(liveAssetSourceId,'catalog','catalog://supabase','catalog-import','catalog-live',1,0),
    d.prepare('INSERT OR IGNORE INTO card_identities (id,game_id,code,name,color,type,cost,power,effect) VALUES (?,?,?,?,?,?,?,?,?)').bind(identityId,gameId,card.code,card.name,card.color,card.type,card.cost,card.power,card.effect),
    d.prepare('INSERT OR IGNORE INTO card_printings (id,identity_id,language,set_code,rarity,variant,asset_source_id,image_url) VALUES (?,?,?,?,?,?,?,?)').bind(input.printingId,identityId,card.language??'EN',card.setCode??card.code.split('-')[0]??'UNASSIGNED',card.rarity,'Standard',liveAssetSourceId,assetUrl),
  ]);
  const saved=await d.prepare('SELECT id FROM card_printings WHERE id=?').bind(input.printingId).first<{id:string}>();
  if(!saved)throw new HttpError(400,'This card could not be prepared for Vault.');
}
export async function POST(req:Request){try{guard(req);const p=await user();const v=collectionInput.parse(await req.json());await ensureCatalogPrinting(v);const id=crypto.randomUUID();const d=db();const stmts=[d.prepare('INSERT INTO collectible_instances (id,owner_id,printing_id,type,quantity,condition,visibility,acquisition_amount,currency) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,p.id,v.printingId,v.type,v.quantity,v.condition,v.visibility,v.acquisitionAmount,v.currency)];if(v.type==='GRADED'){const providerId=crypto.randomUUID();stmts.unshift(d.prepare('INSERT OR IGNORE INTO grading_providers (id,name,short_name) VALUES (?,?,?)').bind(providerId,v.provider,v.provider));stmts.push(d.prepare('INSERT INTO graded_cards (instance_id,provider_id,grade,certification) VALUES (?,(SELECT id FROM grading_providers WHERE name=?),?,?)').bind(id,v.provider,v.grade,v.certification));}stmts.push(d.prepare('INSERT INTO audit_logs (id,actor_id,action,entity_id) VALUES (?,?,?,?)').bind(crypto.randomUUID(),p.id,'COLLECTIBLE_CREATED',id));await d.batch(stmts);return Response.json({id},{status:201})}catch(e){return errorResponse(e)}}
export async function DELETE(req:Request){try{guard(req);const p=await user();const {id}=await req.json() as {id:string};await db().prepare('UPDATE collectible_instances SET deleted_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=? AND NOT EXISTS (SELECT 1 FROM listings WHERE instance_id=? AND status=\'ACTIVE\')').bind(id,p.id,id).run();return Response.json({ok:true})}catch(e){return errorResponse(e)}}
