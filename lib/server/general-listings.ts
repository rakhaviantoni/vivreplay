import {z} from 'zod';
import {computeListingExpiration} from '@/lib/market/policy';
import {generalMarketConditionOptions,generalMarketCategories} from '@/lib/market/general-products';
import {db,HttpError} from './store';
import {recordMarketActivity} from './market-activity-progress';

const parcelSchema=z.object({weight:z.number().int().min(10).max(30000),length:z.number().int().min(1).max(200),width:z.number().int().min(1).max(200),height:z.number().int().min(1).max(200)});
const schema=z.object({productType:z.literal('GENERAL'),type:z.enum(['WTS','WTB']),title:z.string().trim().min(3).max(100),category:z.enum(['HOBBY','COMPUTER','COMPUTER_PART','CONSOLE','PHYSICAL_GAME','ACCESSORY']),brand:z.string().trim().max(60).default(''),model:z.string().trim().max(80).default(''),attributes:z.record(z.string(),z.string().trim().max(100)).default({}),quantity:z.number().int().min(1).max(99),unitAmount:z.number().int().min(1).max(1000000000),condition:z.enum(generalMarketConditionOptions),notes:z.string().trim().max(1000).default(''),photoIds:z.array(z.string().uuid()).max(6).default([]),parcel:parcelSchema.optional()});

export async function createGeneralListing(body:unknown,ownerId:string,durationDays:number,maxActiveListings:number,maxProductStock:number){
  const value=schema.parse(body);const category=generalMarketCategories[value.category];
  if(value.quantity>maxProductStock)throw new HttpError(400,`This plan allows up to ${maxProductStock} units of one product per listing.`);
  const attributes=Object.fromEntries(Object.entries(value.attributes).filter(([key,text])=>category.fields.some(field=>field.key===key)&&text.trim()).map(([key,text])=>[key,text.trim()]));
  if(value.type==='WTS'&&(!value.photoIds.length||!value.parcel))throw new HttpError(400,'Add at least one item photo and packed dimensions before selling.');
  const database=db();
  const origin=await database.prepare('SELECT city FROM seller_shipping_origins WHERE owner_id=?').bind(ownerId).first<{city:string}>();
  const city=origin?.city?.trim()??'';
  if(value.type==='WTS'&&!city)throw new HttpError(400,'Save your delivery address before publishing.');
  if(value.type==='WTB'&&!city)throw new HttpError(400,'Add a delivery address before posting a buying request.');
  const photos=value.type==='WTS'?[...new Set(value.photoIds)]:[];
  if(photos.length){const owned=await database.prepare(`SELECT id FROM market_product_photos WHERE owner_id=? AND id IN (${photos.map(()=>'?').join(',')})`).bind(ownerId,...photos).all<{id:string}>();if(owned.results.length!==photos.length)throw new HttpError(400,'Choose photos uploaded from your account.');}
  const id=crypto.randomUUID();const expiresAt=computeListingExpiration(durationDays);const listingId=crypto.randomUUID();
  const generalProduct={category:value.category,brand:value.brand,model:value.model,attributes};
  const item={printingId:id,sealedProductId:id,productType:'GENERAL',quantity:value.quantity,unitAmount:value.unitAmount,condition:value.condition,notes:value.notes,generalProduct,...(value.type==='WTS'?{photoIds:photos,parcel:value.parcel}:{})};
  await database.prepare(`INSERT INTO tcg_sealed_products(id,source,external_id,game_slug,name,product_kind,set_code,set_name,language,source_url,updated_at) VALUES (?,'community',?,'general',?,'OTHER',?,?, '',NULL,CURRENT_TIMESTAMP)`).bind(id,id,value.title,value.category,value.model||null).run();
  const result=await database.prepare(`INSERT INTO listings(id,seller_id,sealed_product_id,title,amount,currency,quantity,condition,type,city,expires_at,items,negotiable) SELECT ?,?,?,?,?,'IDR',?,?,?,?,?,?,1 WHERE (SELECT COUNT(*) FROM listings WHERE seller_id=? AND status='ACTIVE' AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP))<?`).bind(listingId,ownerId,id,value.title,value.unitAmount*value.quantity,value.quantity,value.condition,value.type,city,expiresAt,JSON.stringify([item]),ownerId,maxActiveListings).run();
  if(!result.meta.changes){await database.prepare('DELETE FROM tcg_sealed_products WHERE id=? AND source=\'community\'').bind(id).run();throw new HttpError(409,'Your active listing limit has been reached.');}
  await recordMarketActivity(database,ownerId,'listing_published',listingId);
  return Response.json({id:listingId,expiresAt},{status:201});
}
