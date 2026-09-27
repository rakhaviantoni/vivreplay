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
export async function POST(req:Request){
  try{
    guard(req);
    const p=await user();
    const v=collectionInput.parse(await req.json());
    await ensureCatalogPrinting(v);
    const id=v.id??crypto.randomUUID();
    const d=db();
    const stmts=[d.prepare('INSERT INTO collectible_instances (id,owner_id,printing_id,type,quantity,condition,visibility,acquisition_amount,currency,acquired_at,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id,p.id,v.printingId,v.type,v.quantity,v.condition,v.visibility,v.acquisitionAmount,v.currency,v.acquiredAt??null,v.notes??null)];
    if(v.type==='GRADED'){
      const providerId=crypto.randomUUID();
      stmts.unshift(d.prepare('INSERT OR IGNORE INTO grading_providers (id,name,short_name) VALUES (?,?,?)').bind(providerId,v.provider,v.provider));
      const subgradesJson=v.subgrades?JSON.stringify(v.subgrades):null;
      stmts.push(d.prepare('INSERT INTO graded_cards (instance_id,provider_id,grade,certification,subgrades,verification_status,verification_source) VALUES (?,(SELECT id FROM grading_providers WHERE name=?),?,?,?,?,?)').bind(id,v.provider,v.grade,v.certification,subgradesJson,'user-entered','user-entered'));
    }
    stmts.push(d.prepare('INSERT INTO audit_logs (id,actor_id,action,entity_id) VALUES (?,?,?,?)').bind(crypto.randomUUID(),p.id,'COLLECTIBLE_CREATED',id));
    await d.batch(stmts);
    return Response.json({id},{status:201});
  }catch(e){return errorResponse(e)}
}

export async function PATCH(req:Request){
  try{
    guard(req);
    const p=await user();
    const body=await req.json() as Record<string,any>;
    const {id,...fields}=body;
    if(!id)throw new HttpError(400,'Missing item ID');
    const d=db();
    const existing=await d.prepare('SELECT id,type FROM collectible_instances WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(id,p.id).first<{id:string;type:string}>();
    if(!existing)throw new HttpError(404,'Item not found in your vault');
    const stmts=[];
    stmts.push(d.prepare(`UPDATE collectible_instances SET 
      quantity=COALESCE(?,quantity),
      condition=COALESCE(?,condition),
      visibility=COALESCE(?,visibility),
      acquisition_amount=COALESCE(?,acquisition_amount),
      currency=COALESCE(?,currency),
      notes=COALESCE(?,notes),
      acquired_at=COALESCE(?,acquired_at)
      WHERE id=? AND owner_id=?`).bind(
        fields.quantity!==undefined?fields.quantity:null,
        fields.condition!==undefined?fields.condition:null,
        fields.visibility!==undefined?fields.visibility:null,
        fields.acquisitionAmount!==undefined?fields.acquisitionAmount:null,
        fields.currency!==undefined?fields.currency:null,
        fields.notes!==undefined?fields.notes:null,
        fields.acquiredAt!==undefined?fields.acquiredAt:null,
        id,p.id
      ));
    if(existing.type==='GRADED'&&(fields.grade!==undefined||fields.certification!==undefined||fields.subgrades!==undefined||fields.provider!==undefined)){
      if(fields.provider){
        stmts.push(d.prepare('INSERT OR IGNORE INTO grading_providers (id,name,short_name) VALUES (?,?,?)').bind(crypto.randomUUID(),fields.provider,fields.provider));
      }
      stmts.push(d.prepare(`UPDATE graded_cards SET 
        grade=COALESCE(?,grade),
        certification=COALESCE(?,certification),
        subgrades=COALESCE(?,subgrades),
        provider_id=CASE WHEN ? IS NOT NULL THEN (SELECT id FROM grading_providers WHERE name=?) ELSE provider_id END
        WHERE instance_id=?`).bind(
          fields.grade!==undefined?fields.grade:null,
          fields.certification!==undefined?fields.certification:null,
          fields.subgrades!==undefined?(typeof fields.subgrades==='string'?fields.subgrades:JSON.stringify(fields.subgrades)):null,
          fields.provider||null,fields.provider||null,
          id
        ));
    }
    stmts.push(d.prepare('INSERT INTO audit_logs (id,actor_id,action,entity_id) VALUES (?,?,?,?)').bind(crypto.randomUUID(),p.id,'COLLECTIBLE_UPDATED',id));
    await d.batch(stmts);
    return Response.json({ok:true});
  }catch(e){return errorResponse(e)}
}

export async function DELETE(req:Request){try{guard(req);const p=await user();const {id}=await req.json() as {id:string};await db().prepare('UPDATE collectible_instances SET deleted_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=? AND NOT EXISTS (SELECT 1 FROM listings WHERE instance_id=? AND status=\'ACTIVE\')').bind(id,p.id,id).run();return Response.json({ok:true})}catch(e){return errorResponse(e)}}

