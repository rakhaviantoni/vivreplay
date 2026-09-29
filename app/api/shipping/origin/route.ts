import {db,errorResponse,guard,user} from '@/lib/server/store';

export async function GET(request:Request){
  try{
    guard(request);const profile=await user();
    const origin=await db().prepare('SELECT owner_id AS ownerId, label, recipient_name AS recipientName, phone, address_line AS addressLine, city, postal_code AS postalCode, area_id AS areaId, latitude, longitude, updated_at AS updatedAt FROM seller_shipping_origins WHERE owner_id=?').bind(profile.id).first();
    return Response.json({origin:origin||null});
  }catch(error){return errorResponse(error)}
}

export async function POST(request:Request){
  try{
    guard(request);const profile=await user();const input=await request.json() as Record<string,unknown>;
    const label=typeof input.label==='string'?input.label.trim().slice(0,60):'Primary origin';
    const address=typeof input.addressLine==='string'?input.addressLine.trim().slice(0,260):'';
    const city=typeof input.city==='string'?input.city.trim().slice(0,80):'';
    const postalCode=typeof input.postalCode==='string'?input.postalCode.trim().slice(0,12):'';
    if(!address||!city||!postalCode)return Response.json({error:'Address, city, and postal code are required.'},{status:400});
    await db().prepare(`INSERT INTO seller_shipping_origins (owner_id,label,recipient_name,phone,address_line,city,postal_code,area_id,latitude,longitude,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(owner_id) DO UPDATE SET label=excluded.label,recipient_name=excluded.recipient_name,phone=excluded.phone,address_line=excluded.address_line,city=excluded.city,postal_code=excluded.postal_code,area_id=excluded.area_id,latitude=excluded.latitude,longitude=excluded.longitude,updated_at=CURRENT_TIMESTAMP`).bind(profile.id,label,typeof input.recipientName==='string'?input.recipientName.trim().slice(0,100):null,typeof input.phone==='string'?input.phone.trim().slice(0,30):null,address,city,postalCode,typeof input.areaId==='string'?input.areaId.trim().slice(0,80):null,typeof input.latitude==='number'?input.latitude:null,typeof input.longitude==='number'?input.longitude:null).run();
    return Response.json({ok:true});
  }catch(error){return errorResponse(error)}
}
