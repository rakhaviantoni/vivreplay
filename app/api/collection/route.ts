import {user,db,errorResponse,guard,HttpError} from '@/lib/server/store';
import {collectionInput} from '@/packages/domain';
import {gameId} from '@/packages/card-data/catalog';

const liveAssetSourceId='30000000-0000-4000-8000-000000000008';
async function ensureCatalogPrinting(input:Awaited<ReturnType<typeof collectionInput.parse>>){
  const existingPrinting=await db().prepare('SELECT id,image_url AS imageUrl FROM card_printings WHERE id=?').bind(input.printingId).first<{id:string;imageUrl:string|null}>();
  const card=input.catalogCard;
  if(!card)throw new HttpError(400,'This card is not available for Vault yet.');
  const d=db();
  const identity=await d.prepare('SELECT id FROM card_identities WHERE game_id=? AND code=?').bind(gameId,card.code).first<{id:string}>();
  const requestedIdentityId=identity?.id??crypto.randomUUID();
  const assetUrl=card.imageUrl??`catalog://${card.code}`;
  await d.batch([
    d.prepare('INSERT OR IGNORE INTO games (id,slug,name) VALUES (?,?,?)').bind(gameId,'one-piece','One Piece Card Game'),
    d.prepare('INSERT OR IGNORE INTO card_asset_sources (id,source_type,source_url,rights_status,hash,approved_for_display,approved_for_storage) VALUES (?,?,?,?,?,?,?)').bind(liveAssetSourceId,'catalog','catalog://supabase','catalog-import','catalog-live',1,0),
    d.prepare('INSERT OR IGNORE INTO card_identities (id,game_id,code,name,color,type,cost,power,effect) VALUES (?,?,?,?,?,?,?,?,?)').bind(requestedIdentityId,gameId,card.code,card.name,card.color,card.type,card.cost,card.power,card.effect),
  ]);
  const savedIdentity=await d.prepare('SELECT id FROM card_identities WHERE game_id=? AND code=?').bind(gameId,card.code).first<{id:string}>();
  if(!savedIdentity)throw new HttpError(400,'This card could not be prepared for Vault.');
  await d.prepare('UPDATE card_identities SET name=?,color=?,type=?,cost=?,power=?,effect=? WHERE id=?').bind(card.name,card.color,card.type,card.cost,card.power,card.effect,savedIdentity.id).run();
  const language=card.language??'EN';
  const setCode=card.setCode??card.code.split('-')[0]??'UNASSIGNED';
  const baseVariant=card.variant??'Standard';
  const collision=await d.prepare('SELECT id FROM card_printings WHERE identity_id=? AND language=? AND set_code=? AND variant=? AND id<>?').bind(savedIdentity.id,language,setCode,baseVariant,input.printingId).first<{id:string}>();
  const suffix=(card.printingCode??input.printingId).replace(/[^a-zA-Z0-9-]/g,'').slice(-14);
  let variant=collision?`${baseVariant} · ${suffix}`:baseVariant;
  const variantCollision=await d.prepare('SELECT id FROM card_printings WHERE identity_id=? AND language=? AND set_code=? AND variant=? AND id<>?').bind(savedIdentity.id,language,setCode,variant,input.printingId).first<{id:string}>();
  if(variantCollision)variant=`${baseVariant} · ${suffix} · ${input.printingId.replace(/-/g,'')}`;
  await d.prepare('INSERT OR IGNORE INTO card_printings (id,identity_id,language,set_code,printing_code,rarity,variant,asset_source_id,image_url) VALUES (?,?,?,?,?,?,?,?,?)').bind(input.printingId,savedIdentity.id,language,setCode,card.printingCode??card.code,card.rarity,variant,liveAssetSourceId,card.imageUrl??existingPrinting?.imageUrl??assetUrl).run();
  await d.prepare('UPDATE card_printings SET identity_id=?,language=?,set_code=?,printing_code=?,rarity=?,variant=?,asset_source_id=?,image_url=? WHERE id=?').bind(savedIdentity.id,language,setCode,card.printingCode??card.code,card.rarity,variant,liveAssetSourceId,card.imageUrl??existingPrinting?.imageUrl??assetUrl,input.printingId).run();
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
    if(v.type==='RAW'){
      const stack=await d.prepare(`SELECT c.id,c.quantity,c.acquisition_amount AS acquisitionAmount,c.visibility,c.acquired_at AS acquiredAt,c.notes
        FROM collectible_instances c WHERE c.owner_id=? AND c.printing_id=? AND c.type='RAW' AND c.condition=? AND c.currency=? AND c.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM listings l WHERE l.status IN ('ACTIVE','PAUSED') AND (l.instance_id=c.id OR EXISTS(SELECT 1 FROM json_each(l.items) entry WHERE json_extract(entry.value,'$.instanceId')=c.id))) LIMIT 1`)
        .bind(p.id,v.printingId,v.condition,v.currency).first<{id:string;quantity:number;acquisitionAmount:number;visibility:string;acquiredAt:string|null;notes:string|null}>();
      if(stack){
        const quantity=stack.quantity+v.quantity;
        const acquisitionAmount=stack.acquisitionAmount+v.acquisitionAmount;
        const visibility=stack.visibility==='private'||v.visibility==='private'?'private':stack.visibility==='marketplace-only'||v.visibility==='marketplace-only'?'marketplace-only':'public';
        const notes=[...new Set([stack.notes?.trim(),v.notes?.trim()].filter((value):value is string=>Boolean(value)))].join(String.fromCharCode(10)).slice(0,2000)||null;
        await d.batch([
          d.prepare('UPDATE collectible_instances SET quantity=?,acquisition_amount=?,visibility=?,acquired_at=COALESCE(?,acquired_at),notes=? WHERE id=? AND owner_id=?').bind(quantity,acquisitionAmount,visibility,v.acquiredAt??stack.acquiredAt,notes,stack.id,p.id),
          d.prepare('INSERT INTO audit_logs (id,actor_id,action,entity_id) VALUES (?,?,?,?)').bind(crypto.randomUUID(),p.id,'COLLECTIBLE_UPDATED',stack.id),
        ]);
        return Response.json({id:stack.id,merged:true,quantity});
      }
    }
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
  }catch(e){
    if(e instanceof Error&&/UNIQUE constraint failed: card_printings\./i.test(e.message))return Response.json({error:'This exact printing is already in your Vault catalog. Refresh the card and try again.'},{status:409});
    return errorResponse(e);
  }
}

export async function PATCH(req:Request){
  try{
    guard(req);
    const p=await user();
    const body=await req.json() as Record<string,unknown>;
    const {id,...fields}=body;
    if(!id)throw new HttpError(400,'Missing item ID');
    const d=db();
    const existing=await d.prepare(`SELECT c.id,c.type,c.printing_id AS printingId,c.quantity,c.condition,c.acquisition_amount AS acquisitionAmount,c.currency,c.visibility,c.acquired_at AS acquiredAt,c.notes,
      (SELECT identity_id FROM card_printings WHERE id=c.printing_id) AS identityId,
      EXISTS(SELECT 1 FROM listings l WHERE l.status IN ('ACTIVE','PAUSED') AND (l.instance_id=c.id OR EXISTS(SELECT 1 FROM json_each(l.items) entry WHERE json_extract(entry.value,'$.instanceId')=c.id))) AS hasActiveListing,
      COALESCE((SELECT SUM(CASE WHEN l.items IS NULL THEN l.quantity ELSE 0 END) FROM listings l WHERE l.instance_id=c.id AND l.status='ACTIVE' AND (l.expires_at IS NULL OR l.expires_at>CURRENT_TIMESTAMP)),0)+COALESCE((SELECT SUM(CAST(json_extract(entry.value,'$.quantity') AS INTEGER)) FROM listings l,json_each(l.items) entry WHERE json_extract(entry.value,'$.instanceId')=c.id AND l.status='ACTIVE' AND (l.expires_at IS NULL OR l.expires_at>CURRENT_TIMESTAMP)),0) AS activeListedQuantity
    FROM collectible_instances c WHERE c.id=? AND c.owner_id=? AND c.deleted_at IS NULL`).bind(id,p.id).first<{id:string;type:string;printingId:string;quantity:number;condition:string;acquisitionAmount:number;currency:string;visibility:string;acquiredAt:string|null;notes:string|null;identityId:string|null;hasActiveListing:number;activeListedQuantity:number}>();
    if(!existing)throw new HttpError(404,'Item not found in your vault');
    if(fields.printingId&&fields.catalogCard)await ensureCatalogPrinting(collectionInput.parse({
      printingId:fields.printingId,catalogCard:fields.catalogCard,type:'RAW',quantity:1,condition:'NM',
      provider:null,grade:null,certification:null,visibility:'private',acquisitionAmount:0,currency:'IDR',
    }));
    const stmts=[];
    const nextType=fields.type==='RAW'||fields.type==='GRADED'?fields.type:existing.type;
    const nextPrintingId=typeof fields.printingId==='string'?fields.printingId:existing.printingId;
    const nextCondition=typeof fields.condition==='string'?fields.condition:existing.condition;
    const nextQuantity=typeof fields.quantity==='number'?fields.quantity:existing.quantity;
    const nextVisibility=typeof fields.visibility==='string'?fields.visibility:existing.visibility;
    const nextAmount=typeof fields.acquisitionAmount==='number'?fields.acquisitionAmount:existing.acquisitionAmount;
    const nextCurrency=typeof fields.currency==='string'?fields.currency:existing.currency;
    const nextAcquiredAt=typeof fields.acquiredAt==='string'?fields.acquiredAt:existing.acquiredAt;
    const nextNotes=typeof fields.notes==='string'?fields.notes:existing.notes;
    if(typeof fields.printingId==='string'&&fields.printingId!==existing.printingId){
      const destination=await d.prepare('SELECT identity_id AS identityId FROM card_printings WHERE id=?').bind(fields.printingId).first<{identityId:string}>();
      if(!destination||destination.identityId!==existing.identityId)throw new HttpError(400,'Choose a printing of the same card.');
    }
    if(existing.hasActiveListing&&nextPrintingId!==existing.printingId)throw new HttpError(409,'Remove the active listing before changing this printing.');
    if(nextType==='RAW'&&!existing.hasActiveListing){
      const duplicate=await d.prepare(`SELECT id,quantity,acquisition_amount AS acquisitionAmount,currency,visibility,acquired_at AS acquiredAt,notes
        FROM collectible_instances WHERE owner_id=? AND id<>? AND printing_id=? AND type='RAW' AND condition=? AND currency=? AND deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM listings l WHERE l.status IN ('ACTIVE','PAUSED') AND (l.instance_id=collectible_instances.id OR EXISTS(SELECT 1 FROM json_each(l.items) entry WHERE json_extract(entry.value,'$.instanceId')=collectible_instances.id))) LIMIT 1`)
        .bind(p.id,id,nextPrintingId,nextCondition,nextCurrency).first<{id:string;quantity:number;acquisitionAmount:number;currency:string;visibility:string;acquiredAt:string|null;notes:string|null}>();
      if(duplicate){
        const combinedQuantity=duplicate.quantity+nextQuantity;
        const combinedCost=duplicate.acquisitionAmount+nextAmount;
        const visibility=duplicate.visibility==='private'||nextVisibility==='private'?'private':duplicate.visibility==='marketplace-only'||nextVisibility==='marketplace-only'?'marketplace-only':'public';
        const notes=[...new Set([duplicate.notes?.trim(),nextNotes?.trim()].filter((value):value is string=>Boolean(value)))].join(String.fromCharCode(10)).slice(0,2000)||null;
        stmts.push(d.prepare(`UPDATE collectible_instances SET quantity=?,acquisition_amount=?,currency=?,visibility=?,acquired_at=COALESCE(?,acquired_at),notes=? WHERE id=? AND owner_id=?`)
          .bind(combinedQuantity,combinedCost,nextCurrency,visibility,nextAcquiredAt,notes,duplicate.id,p.id));
        stmts.push(d.prepare('UPDATE collectible_instances SET deleted_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=?').bind(id,p.id));
        stmts.push(d.prepare('INSERT INTO audit_logs (id,actor_id,action,entity_id) VALUES (?,?,?,?)').bind(crypto.randomUUID(),p.id,'COLLECTIBLE_UPDATED',duplicate.id));
        await d.batch(stmts);
        return Response.json({ok:true,mergedInto:duplicate.id,quantity:combinedQuantity});
      }
    }
    if(existing.activeListedQuantity>nextQuantity)throw new HttpError(409,'That quantity is reserved by an active Market listing. Close or reduce the listing first.');
    if(nextType==='GRADED'&&(!fields.provider||!fields.grade||!fields.certification))throw new HttpError(400,'A graded card needs its grading company, grade, and certification number.');
    stmts.push(d.prepare(`UPDATE collectible_instances SET 
      printing_id=COALESCE(?,printing_id),
      type=COALESCE(?,type),
      quantity=COALESCE(?,quantity),
      condition=COALESCE(?,condition),
      visibility=COALESCE(?,visibility),
      acquisition_amount=COALESCE(?,acquisition_amount),
      currency=COALESCE(?,currency),
      notes=COALESCE(?,notes),
      acquired_at=COALESCE(?,acquired_at)
      WHERE id=? AND owner_id=?`).bind(
        fields.printingId!==undefined?nextPrintingId:null,
        fields.type==='RAW'||fields.type==='GRADED'?fields.type:null,
        fields.quantity!==undefined?fields.quantity:null,
        fields.condition!==undefined?fields.condition:null,
        fields.visibility!==undefined?fields.visibility:null,
        fields.acquisitionAmount!==undefined?fields.acquisitionAmount:null,
        fields.currency!==undefined?fields.currency:null,
        fields.notes!==undefined?fields.notes:null,
        fields.acquiredAt!==undefined?fields.acquiredAt:null,
        id,p.id
      ));
    if(nextType==='GRADED'){
      stmts.push(d.prepare('INSERT OR IGNORE INTO grading_providers (id,name,short_name) VALUES (?,?,?)').bind(crypto.randomUUID(),fields.provider,fields.provider));
      stmts.push(d.prepare(`INSERT INTO graded_cards (instance_id,provider_id,grade,certification,subgrades,verification_status,verification_source)
        VALUES (?,(SELECT id FROM grading_providers WHERE name=?),?,?,?,'user-entered','user-entered')
        ON CONFLICT(instance_id) DO UPDATE SET provider_id=excluded.provider_id,grade=excluded.grade,certification=excluded.certification,subgrades=excluded.subgrades`).bind(
          id,fields.provider,fields.grade,fields.certification,
          fields.subgrades!==undefined?(typeof fields.subgrades==='string'?fields.subgrades:JSON.stringify(fields.subgrades)):null
        ));
    }else if(existing.type==='GRADED'){
      stmts.push(d.prepare('DELETE FROM graded_cards WHERE instance_id=?').bind(id));
    }
    stmts.push(d.prepare('INSERT INTO audit_logs (id,actor_id,action,entity_id) VALUES (?,?,?,?)').bind(crypto.randomUUID(),p.id,'COLLECTIBLE_UPDATED',id));
    await d.batch(stmts);
    return Response.json({ok:true});
  }catch(e){return errorResponse(e)}
}

export async function DELETE(req:Request){try{guard(req);const p=await user();const {id}=await req.json() as {id:string};await db().prepare("UPDATE collectible_instances SET deleted_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=? AND NOT EXISTS (SELECT 1 FROM listings l WHERE l.status IN ('ACTIVE','PAUSED') AND (l.instance_id=? OR EXISTS(SELECT 1 FROM json_each(l.items) entry WHERE json_extract(entry.value,'$.instanceId')=?)))").bind(id,p.id,id,id).run();return Response.json({ok:true})}catch(e){return errorResponse(e)}}
