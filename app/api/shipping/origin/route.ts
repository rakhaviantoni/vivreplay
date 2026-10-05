import {db,errorResponse,guard,user} from '@/lib/server/store';
import {verifyTurnstile} from '@/lib/server/turnstile';
import {isBiteshipAreaId} from '@/lib/shipping/biteship-area';
import {verifyBiteshipPostal,BiteshipError} from '@/lib/server/biteship';

export async function GET(request:Request){
  try{
    guard(request);const profile=await user();
    const origin=await db().prepare('SELECT owner_id AS ownerId, label, recipient_name AS recipientName, phone, address_line AS addressLine, city, postal_code AS postalCode, area_id AS areaId, latitude, longitude, updated_at AS updatedAt FROM seller_shipping_origins WHERE owner_id=?').bind(profile.id).first<{
      ownerId: string;
      label: string;
      recipientName: string | null;
      phone: string | null;
      addressLine: string;
      city: string;
      postalCode: string;
      areaId: string | null;
      latitude: number | null;
      longitude: number | null;
      updatedAt: string | null;
    }>();
    if(!origin)return Response.json({origin:null});

    let shippingMethods: string[] = [];
    let regionNames: {province?:string;city?:string;district?:string;subdistrict?:string} | undefined;
    let displayLabel = origin.label || 'Primary origin';
    if(origin.label && origin.label.startsWith('{')){
      try{
        const parsed = JSON.parse(origin.label);
        if(Array.isArray(parsed.methods)){
          shippingMethods = parsed.methods.filter((m: unknown): m is string => typeof m === 'string');
        }
        if(parsed.regionNames&&typeof parsed.regionNames==='object')regionNames=parsed.regionNames;
        if(typeof parsed.label === 'string' && parsed.label.trim()){
          displayLabel = parsed.label.trim();
        }
      }catch{}
    }

    return Response.json({
      origin: {
        ...origin,
        areaId:isBiteshipAreaId(origin.areaId)?origin.areaId:null,
        label: displayLabel,
        shippingMethods,
        regionNames,
      }
    });
  }catch(error){return errorResponse(error)}
}

export async function POST(request:Request){
  try{
    const rejected=await verifyTurnstile(request);if(rejected)return rejected;
    guard(request);const profile=await user();const input=await request.json() as Record<string,unknown>;
    const rawLabel=typeof input.label==='string'&&input.label.trim()?input.label.trim().slice(0,60):'Primary origin';
    const address=typeof input.addressLine==='string'?input.addressLine.trim().slice(0,260):'';
    const city=typeof input.city==='string'?input.city.trim().slice(0,80):'';
    const postalCode=typeof input.postalCode==='string'?input.postalCode.trim().slice(0,12):'';
    const areaId=typeof input.areaId==='string'&&isBiteshipAreaId(input.areaId)?input.areaId.trim():null;
    if(!address||!city)return Response.json({error:'Street address and city are required.'},{status:400});
    if(!/^\d{5}$/.test(postalCode)&&!areaId)return Response.json({error:'Choose a delivery area with a valid postal code.'},{status:400});
    let resolvedAreaId=areaId;
    if(!resolvedAreaId&&process.env.BITESHIP_API_KEY?.trim()){
      try{const area=await verifyBiteshipPostal(postalCode);resolvedAreaId=area?.id??null}
      catch(error){if(error instanceof BiteshipError)return Response.json({error:error.message},{status:error.status}) ;throw error}
    }

    const allowed = ['instant','regular','jnt','jne','sicepat','anteraja','tiki','pos','lion','ninja','wahana','grab','gojek'];
    const rawMethods = Array.isArray(input.shippingMethods) ? input.shippingMethods : [];
    const shippingMethods = rawMethods.filter((m: unknown): m is string => typeof m === 'string' && allowed.includes(m));
    const label = JSON.stringify({
      label: rawLabel,
      methods: shippingMethods,
      regionNames: input.regions&&typeof input.regions==='object'?input.regions:undefined,
    });

    await db().prepare(`INSERT INTO seller_shipping_origins (owner_id,label,recipient_name,phone,address_line,city,postal_code,area_id,latitude,longitude,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(owner_id) DO UPDATE SET label=excluded.label,recipient_name=excluded.recipient_name,phone=excluded.phone,address_line=excluded.address_line,city=excluded.city,postal_code=excluded.postal_code,area_id=excluded.area_id,latitude=excluded.latitude,longitude=excluded.longitude,updated_at=CURRENT_TIMESTAMP`).bind(profile.id,label,typeof input.recipientName==='string'?input.recipientName.trim().slice(0,100):null,typeof input.phone==='string'?input.phone.trim().slice(0,30):null,address,city,postalCode,resolvedAreaId,typeof input.latitude==='number'?input.latitude:null,typeof input.longitude==='number'?input.longitude:null).run();
    return Response.json({ok:true, shippingMethods});
  }catch(error){return errorResponse(error)}
}
