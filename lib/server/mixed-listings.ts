import {z} from 'zod';
import {after} from 'next/server';
import {notifyListingWatchers} from '@/lib/server/market-watch-alerts';
import {db,HttpError} from './store';
import {computeListingExpiration} from '@/lib/market/policy';
import {sealedProductById} from '@/lib/market/sealed-products';
import {productConditions,validProductCondition} from '@/lib/market/product-conditions';
import {generalMarketCategories,generalMarketConditionOptions} from '@/lib/market/general-products';

const parcelSchema=z.object({weight:z.number().int().min(10).max(30000),length:z.number().int().min(1).max(200),width:z.number().int().min(1).max(200),height:z.number().int().min(1).max(200)});
const cardItemSchema=z.object({productType:z.enum(['RAW','GRADED']).default('RAW'),instanceId:z.string().uuid(),printingId:z.string().min(1),quantity:z.number().int().positive().max(20),condition:z.string().optional(),gradingCompany:z.string().trim().max(40).optional(),grade:z.string().trim().max(20).optional(),certification:z.string().trim().max(100).optional(),unitAmount:z.number().int().positive().max(1000000000)});
const sealedItemSchema=z.object({productType:z.literal('SEALED'),productId:z.string().min(1),printingId:z.string().min(1),quantity:z.number().int().positive().max(99),unitAmount:z.number().int().positive().max(1000000000),condition:z.enum(productConditions),notes:z.string().trim().max(1000).default(''),photoIds:z.array(z.string().uuid()).max(6).default([]),parcel:parcelSchema});
const generalItemSchema=z.object({productType:z.literal('GENERAL'),printingId:z.string().min(1),name:z.string().trim().min(3).max(100),quantity:z.number().int().positive().max(99),unitAmount:z.number().int().positive().max(1000000000),condition:z.enum(generalMarketConditionOptions),notes:z.string().trim().max(1000).default(''),photoIds:z.array(z.string().uuid()).max(6).default([]),parcel:parcelSchema,generalProduct:z.object({category:z.string(),brand:z.string().max(60).default(''),model:z.string().max(80).default(''),attributes:z.record(z.string(),z.string().max(100)).default({})})});
const schema=z.object({title:z.string().trim().min(3).max(100),amount:z.number().int().positive().max(100000000000),quantity:z.number().int().positive().max(200),city:z.string().trim().min(2).max(60),type:z.literal('WTS'),negotiable:z.boolean().default(true),items:z.array(z.union([cardItemSchema,sealedItemSchema,generalItemSchema])).min(1).max(150)});

export async function createMixedListing(body:unknown,ownerId:string,durationDays:number,maxActiveListings:number,limits:{maxListingCopies:number;maxCopiesPerCard:number;maxCardTypes:number;maxProductStock:number}){
  const value=schema.parse(body);
  const cardItems=value.items.filter((item):item is z.infer<typeof cardItemSchema>=>item.productType==='RAW'||item.productType==='GRADED');
  const productItems=value.items.filter(item=>item.productType==='SEALED'||item.productType==='GENERAL');
  const cardQuantity=cardItems.reduce((sum,item)=>sum+item.quantity,0);
  const productQuantity=productItems.reduce((sum,item)=>sum+item.quantity,0);
  if(cardQuantity>limits.maxListingCopies)throw new HttpError(400,`This plan allows up to ${limits.maxListingCopies} cards in one listing.`);
  if(productQuantity>limits.maxProductStock)throw new HttpError(400,`This plan allows up to ${limits.maxProductStock} product units in one listing.`);
  if(value.quantity!==cardQuantity+productQuantity)throw new HttpError(400,'The listing quantity must match the cards and product units in the bundle.');
  if(productItems.some(item=>!item.unitAmount||item.unitAmount<1))throw new HttpError(400,'Set a price for every item in the bundle.');
  const database=db();
  const origin=await database.prepare('SELECT city FROM seller_shipping_origins WHERE owner_id=?').bind(ownerId).first<{city:string}>();
  if(!origin?.city)throw new HttpError(400,'Save your delivery address before publishing.');

  const identityRows=cardItems.length?await database.prepare(`SELECT p.id AS printingId,COALESCE(g.slug,'one-piece')||':'||COALESCE(i.code,p.printing_code,p.id) AS identity FROM card_printings p LEFT JOIN card_identities i ON i.id=p.identity_id LEFT JOIN games g ON g.id=i.game_id WHERE p.id IN (${cardItems.map(()=>'?').join(',')})`).bind(...cardItems.map(item=>item.printingId)).all<{printingId:string;identity:string}>():{results:[]};
  if(identityRows.results.length!==new Set(cardItems.map(item=>item.printingId)).size)throw new HttpError(400,'One or more selected cards are no longer available. Refresh the catalog and add them again.');
  const identityByPrinting=new Map(identityRows.results.map(row=>[row.printingId,row.identity]));
  const cardIdentityCounts=new Map<string,number>();for(const item of cardItems){const key=identityByPrinting.get(item.printingId)??item.printingId;cardIdentityCounts.set(key,(cardIdentityCounts.get(key)??0)+item.quantity);}
  if(cardIdentityCounts.size>limits.maxCardTypes)throw new HttpError(400,`This plan allows up to ${limits.maxCardTypes} different cards in one listing.`);
  if([...cardIdentityCounts.values()].some(quantity=>quantity>limits.maxCopiesPerCard))throw new HttpError(400,`A listing can include up to ${limits.maxCopiesPerCard} copies of each card.`);
  if(cardItems.some(item=>item.productType==='GRADED'&&(item.quantity!==1||!item.gradingCompany||!item.grade)))throw new HttpError(400,'Add complete grading details for each slab.');

  const byInstance=new Map<string,{printingId:string;quantity:number}>();for(const item of cardItems){const current=byInstance.get(item.instanceId);if(current&&current.printingId!==item.printingId)throw new HttpError(400,'A Vault item cannot represent multiple printings in one bundle.');byInstance.set(item.instanceId,{printingId:item.printingId,quantity:(current?.quantity??0)+item.quantity});}
  const storedCards=new Map<string,{condition:string;type:string;gradingCompany:string|null;grade:string|null;certification:string|null}>();
  for(const [instanceId,item] of byInstance){
    const owned=await database.prepare(`SELECT c.printing_id AS printingId,c.quantity,c.type,c.condition,p.short_name AS gradingCompany,g.grade,g.certification FROM collectible_instances c LEFT JOIN graded_cards g ON g.instance_id=c.id LEFT JOIN grading_providers p ON p.id=g.provider_id WHERE c.id=? AND c.owner_id=? AND c.deleted_at IS NULL`).bind(instanceId,ownerId).first<{printingId:string;quantity:number;type:string;condition:string;gradingCompany:string|null;grade:string|null;certification:string|null}>();
    if(!owned||owned.printingId!==item.printingId||item.quantity>owned.quantity)throw new HttpError(400,'One or more cards exceeds your available Vault quantity.');
    if(owned.type==='GRADED'&&(item.quantity!==1||!owned.gradingCompany||!owned.grade))throw new HttpError(400,'Update the slab grading details in your Vault before listing it.');
    const alreadyListed=await database.prepare(`SELECT COALESCE((SELECT SUM(CASE WHEN items IS NULL THEN quantity ELSE 0 END) FROM listings WHERE instance_id=? AND status='ACTIVE' AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP)),0)+COALESCE((SELECT SUM(CAST(json_extract(entry.value,'$.quantity') AS INTEGER)) FROM listings l,json_each(l.items) entry WHERE json_extract(entry.value,'$.instanceId')=? AND l.status='ACTIVE' AND (l.expires_at IS NULL OR l.expires_at>CURRENT_TIMESTAMP)),0) AS total`).bind(instanceId,instanceId).first<{total:number}>();
    if((alreadyListed?.total??0)+item.quantity>owned.quantity)throw new HttpError(409,'One or more cards is already listed.');
    storedCards.set(instanceId,owned);
  }

  const photos=[...new Set(productItems.flatMap(item=>item.photoIds))];
  if(productItems.some(item=>!item.photoIds.length||!item.parcel))throw new HttpError(400,'Add a photo and packed dimensions for every product in the listing.');
  if(photos.length){const ownedPhotos=await database.prepare(`SELECT id FROM market_product_photos WHERE owner_id=? AND id IN (${photos.map(()=>'?').join(',')})`).bind(ownerId,...photos).all<{id:string}>();if(ownedPhotos.results.length!==photos.length)throw new HttpError(400,'Choose photos uploaded from your account.');}
  const normalizedItems:Record<string,unknown>[]=[];
  const generatedProducts:string[]=[];
  for(const item of value.items){
    if(item.productType==='RAW'||item.productType==='GRADED'){
      const owned=storedCards.get(item.instanceId)!;
      normalizedItems.push(owned.type==='GRADED'?{...item,productType:'GRADED',condition:undefined,gradingCompany:owned.gradingCompany,grade:owned.grade,certification:owned.certification}:{...item,productType:'RAW',condition:owned.condition,gradingCompany:undefined,grade:undefined,certification:undefined});
      continue;
    }
    if(item.productType==='SEALED'){
      const product=sealedProductById(item.productId);if(!product||product.id!==item.printingId)throw new HttpError(400,'Choose a TCG product from the catalog.');
      if(!validProductCondition(product.kind,item.condition))throw new HttpError(400,'Choose a condition available for this product.');
      const kind=product.kind==='BOOSTER_PACK'||product.kind==='BOOSTER_BOX'||product.kind==='STARTER_DECK'||product.kind==='DOUBLE_PACK'?product.kind:product.kind==='CARD_COLLECTION'||product.kind==='PREMIUM_COLLECTION'||product.kind==='MINI_TIN'?'COLLECTION':'OTHER';
      await database.prepare(`INSERT OR IGNORE INTO tcg_sealed_products(id,source,external_id,game_slug,name,product_kind,set_code,set_name,language,source_url,updated_at) VALUES (?,'bandai',?,'one-piece',?,?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(product.id,product.id,product.name,kind,product.setCode,product.name,product.language,product.sourceUrl).run();
      normalizedItems.push({...item,sealedProductId:product.id});
      continue;
    }
    const generalItem=item as z.infer<typeof generalItemSchema>;
    const category=generalItem.generalProduct.category;
    const categoryConfig=generalMarketCategories[category as keyof typeof generalMarketCategories];if(!categoryConfig)throw new HttpError(400,'Choose a supported item category.');
    const attributes=Object.fromEntries(Object.entries(generalItem.generalProduct.attributes as Record<string,string>).filter(([key,text])=>categoryConfig.fields.some(field=>field.key===key)&&text.trim()).map(([key,text])=>[key,text.trim()]));
    const productId=crypto.randomUUID();
    await database.prepare(`INSERT INTO tcg_sealed_products(id,source,external_id,game_slug,name,product_kind,set_code,set_name,language,source_url,updated_at) VALUES (?,'community',?,'general',?,'OTHER',?,?, '',NULL,CURRENT_TIMESTAMP)`).bind(productId,productId,generalItem.name,category,generalItem.generalProduct.model||null).run();
    generatedProducts.push(productId);
    normalizedItems.push({...generalItem,printingId:productId,sealedProductId:productId,generalProduct:{...generalItem.generalProduct,attributes}});
  }
  const listingId=crypto.randomUUID();const expiresAt=computeListingExpiration(durationDays);const primaryCard=cardItems[0];const primaryProduct=productItems[0];
  const primaryId=primaryCard?.printingId??null;
  const primaryInstance=primaryCard?.instanceId??null;
  const primarySealed=primaryCard?null:(typeof normalizedItems[0]?.sealedProductId==='string'?String(normalizedItems[0].sealedProductId):null);
  const firstOwned=primaryInstance?await database.prepare('SELECT condition FROM collectible_instances WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(primaryInstance,ownerId).first<{condition:string}>():null;
  const productCondition=primaryProduct?.condition??'NM';
  const serializedItems=JSON.stringify(normalizedItems);
  const result=await database.prepare(`INSERT INTO listings(id,seller_id,printing_id,sealed_product_id,instance_id,title,amount,currency,quantity,condition,type,city,expires_at,items,negotiable) SELECT ?,?,?,?,?,?,?,'IDR',?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM listings WHERE seller_id=? AND status='ACTIVE' AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP))<? AND NOT EXISTS(SELECT 1 FROM (SELECT json_extract(value,'$.instanceId') AS instanceId,SUM(CAST(json_extract(value,'$.quantity') AS INTEGER)) AS quantity FROM json_each(?) WHERE json_extract(value,'$.instanceId') IS NOT NULL GROUP BY json_extract(value,'$.instanceId')) requested LEFT JOIN collectible_instances owned ON owned.id=requested.instanceId WHERE owned.id IS NULL OR owned.owner_id!=? OR owned.deleted_at IS NOT NULL OR requested.quantity > owned.quantity-(COALESCE((SELECT SUM(CASE WHEN l.items IS NULL THEN l.quantity ELSE 0 END) FROM listings l WHERE l.instance_id=owned.id AND l.status='ACTIVE' AND (l.expires_at IS NULL OR l.expires_at>CURRENT_TIMESTAMP)),0)+COALESCE((SELECT SUM(CAST(json_extract(entry.value,'$.quantity') AS INTEGER)) FROM listings l,json_each(l.items) entry WHERE json_extract(entry.value,'$.instanceId')=owned.id AND l.status='ACTIVE' AND (l.expires_at IS NULL OR l.expires_at>CURRENT_TIMESTAMP)),0)))`).bind(listingId,ownerId,primaryId||null,primarySealed,primaryInstance,value.title,value.amount,value.quantity,firstOwned?.condition??productCondition,'WTS',value.city,expiresAt,serializedItems,value.negotiable?1:0,ownerId,maxActiveListings,serializedItems,ownerId).run();
  if(!result.meta.changes){if(generatedProducts.length)await database.prepare(`DELETE FROM tcg_sealed_products WHERE source='community' AND id IN (${generatedProducts.map(()=>'?').join(',')})`).bind(...generatedProducts).run();throw new HttpError(409,'Your active listing limit has been reached.');}
  after(()=>notifyListingWatchers(listingId));
  return Response.json({id:listingId,expiresAt},{status:201});
}
