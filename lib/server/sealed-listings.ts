import {z} from 'zod';
import {db,HttpError} from './store';
import {sealedProductById} from '@/lib/market/sealed-products';
import {computeListingExpiration} from '@/lib/market/policy';

export const sealedListingSchema=z.object({productType:z.literal('SEALED'),productId:z.string(),type:z.enum(['WTS','WTB']),quantity:z.number().int().min(1).max(99),unitAmount:z.number().int().min(1).max(1000000000),title:z.string().trim().min(3).max(100),condition:z.enum(['SEALED','SEALED_DAMAGED']),notes:z.string().trim().max(1000).default(''),photoIds:z.array(z.string().uuid()).max(6).default([]),parcel:z.object({weight:z.number().int().min(10).max(30000),length:z.number().int().min(1).max(100),width:z.number().int().min(1).max(100),height:z.number().int().min(1).max(100)}).optional()});
export async function createSealedListing(body:unknown,ownerId:string,durationDays:number,maxActiveListings:number){
  const value=sealedListingSchema.parse(body);const product=sealedProductById(value.productId);
  if(!product)throw new HttpError(400,'Choose a product from the catalog.');
  if(value.type==='WTS'&&(!value.parcel||!value.photoIds.length))throw new HttpError(400,'Add a product photo and packed dimensions before selling.');
  const database=db();
  const origin=await database.prepare('SELECT city FROM seller_shipping_origins WHERE owner_id=?').bind(ownerId).first<{city:string}>();
  if(!origin?.city)throw new HttpError(400,'Save your delivery address before publishing.');
  const photos=[...new Set(value.photoIds)];
  if(photos.length){const owned=await database.prepare(`SELECT id FROM market_product_photos WHERE owner_id=? AND id IN (${photos.map(()=>'?').join(',')})`).bind(ownerId,...photos).all<{id:string}>();if(owned.results.length!==photos.length)throw new HttpError(400,'Choose your own uploaded photos.');}
  await database.prepare(`INSERT OR IGNORE INTO tcg_sealed_products(id,source,external_id,game_slug,name,product_kind,set_code,set_name,language,source_url,updated_at) VALUES (?,'bandai',?,'one-piece',?,?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(product.id,product.id,product.name,product.kind,product.setCode,product.name,product.language,product.sourceUrl).run();
  const id=crypto.randomUUID();const expiresAt=computeListingExpiration(durationDays);
  const items=JSON.stringify([{printingId:product.id,sealedProductId:product.id,productType:'SEALED',quantity:value.quantity,unitAmount:value.unitAmount,condition:value.condition,notes:value.notes,photoIds:photos,parcel:value.parcel}]);
  const saved=await database.prepare(`INSERT INTO listings(id,seller_id,sealed_product_id,title,amount,currency,quantity,condition,type,city,expires_at,items,negotiable) SELECT ?,?,?,?,?,'IDR',?,?,?,?,?,?,1 WHERE (SELECT COUNT(*) FROM listings WHERE seller_id=? AND status='ACTIVE' AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP))<?`).bind(id,ownerId,product.id,value.title,value.unitAmount*value.quantity,value.quantity,value.condition,value.type,origin.city,expiresAt,items,ownerId,maxActiveListings).run();
  if(!saved.meta.changes)throw new HttpError(409,'Your active listing limit has been reached.');
  return Response.json({id,expiresAt},{status:201});
}
