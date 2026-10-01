type RegionRow={id:string|number;name:string;postal_code?:string|number|null;latitude?:number|null;longitude?:number|null};
const BASE='https://www.emsifa.com/api-wilayah-indonesia/v2';
const LEGACY_BASE='https://emsifa.github.io/api-wilayah-indonesia/api';
const validId=(value:string)=>/^\d+(?:\.\d+)?$/.test(value);
function rowsFrom(value:unknown):RegionRow[]{
  if(Array.isArray(value))return value as RegionRow[];
  if(value&&typeof value==='object'){
    const data=(value as {data?:unknown;items?:unknown}).data??(value as {items?:unknown}).items;
    if(Array.isArray(data))return data as RegionRow[];
  }
  return [];
}
async function fetchRows(url:string):Promise<RegionRow[]>{
  const response=await fetch(url,{headers:{accept:'application/json'},cache:'force-cache',next:{revalidate:604800}});
  if(!response.ok)throw new Error(`Region data request failed (${response.status}).`);
  const rows=rowsFrom(await response.json());
  if(!rows.length)throw new Error('Region data response was empty.');
  return rows;
}

export async function GET(request:Request){
  const params=new URL(request.url).searchParams;
  const level=params.get('level')??'provinces';
  const parent=params.get('parent')??'';
  const path=level==='provinces'?'/provinces.json':level==='regencies'&&validId(parent)?`/regencies/${parent}.json`:level==='districts'&&validId(parent)?`/districts/${parent}.json`:level==='villages'&&validId(parent)?`/villages/${parent}.json`:null;
  const legacyPath=level==='provinces'?'/provinces.json':level==='regencies'&&validId(parent)?`/regencies/${parent}.json`:level==='districts'&&validId(parent)?`/districts/${parent}.json`:level==='villages'&&validId(parent)?`/villages/${parent}.json`:null;
  if(!path||!legacyPath)return Response.json({error:'Choose a valid administrative region.'},{status:400});
  try{
    let rows:RegionRow[];
    try{rows=await fetchRows(`${BASE}${path}`)}catch{rows=await fetchRows(`${LEGACY_BASE}${legacyPath}`)}
    const items=rows.map(row=>({id:String(row.id),name:row.name,postalCode:row.postal_code?String(row.postal_code):null,latitude:row.latitude??null,longitude:row.longitude??null}));
    return Response.json({items},{headers:{'Cache-Control':'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000'}});
  }catch{
    return Response.json({error:'Administrative regions are temporarily unavailable.',items:[]},{status:503,headers:{'Cache-Control':'public, max-age=300'}});
  }
}
