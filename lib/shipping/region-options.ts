import {INDONESIAN_REGIONS,getCities,getDistricts,getSubdistricts} from '@/lib/indonesia-areas';

export type ShippingRegionLevel='provinces'|'regencies'|'districts'|'villages';
export type ShippingRegionContext={province?:string;city?:string;district?:string};
export type ShippingRegionOption={id:string;name:string;postalCode?:string|null;latitude?:number|null;longitude?:number|null};

const normalizeRegion=(value:string)=>value.toLocaleLowerCase('id').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/^(provinsi|province|kota administrasi|kabupaten administrasi|kabupaten|kota|kab\.?|kec\.?|kecamatan)\s+/,'').replace(/[^a-z0-9]+/g,' ').trim();

function localOptions(level:ShippingRegionLevel,context:ShippingRegionContext):ShippingRegionOption[]{
  const province=INDONESIAN_REGIONS.find(item=>normalizeRegion(item.name)===normalizeRegion(context.province??''));
  const city=province&&getCities(province.name).find(item=>normalizeRegion(item.name)===normalizeRegion(context.city??''));
  const district=province&&city&&getDistricts(province.name,city.name).find(item=>normalizeRegion(item.name)===normalizeRegion(context.district??''));
  if(level==='provinces')return INDONESIAN_REGIONS.map(item=>({id:`local:province:${item.name}`,name:item.name,latitude:item.latitude,longitude:item.longitude}));
  if(level==='regencies'&&province)return getCities(province.name).map(item=>({id:`local:city:${province.name}:${item.name}`,name:item.name,latitude:item.latitude,longitude:item.longitude}));
  if(level==='districts'&&province&&city)return getDistricts(province.name,city.name).map(item=>({id:`local:district:${province.name}:${city.name}:${item.name}`,name:item.name,latitude:item.latitude,longitude:item.longitude}));
  if(level==='villages'&&province&&city&&district)return getSubdistricts(province.name,city.name,district.name).map(item=>({id:`local:village:${item.name}`,name:item.name,postalCode:item.postalCode,latitude:item.latitude,longitude:item.longitude}));
  return[];
}

export async function loadShippingRegionOptions(level:ShippingRegionLevel,parent:string|undefined,context:ShippingRegionContext):Promise<ShippingRegionOption[]>{
  if(parent?.startsWith('local:'))return localOptions(level,context);
  const params=new URLSearchParams({level});if(parent)params.set('parent',parent);
  try{const response=await fetch(`/api/shipping/regions?${params}`);const payload=await response.json() as {items?:ShippingRegionOption[]};if(response.ok&&Array.isArray(payload.items)&&payload.items.length)return payload.items}catch{}
  return localOptions(level,context);
}
