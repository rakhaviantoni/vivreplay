type RegionRow={id:string|number;name:string;postal_code?:string|number|null;latitude?:number|null;longitude?:number|null};
const LOCAL_PROVINCES=[
  ['11','Aceh'],['12','Sumatera Utara'],['13','Sumatera Barat'],['14','Riau'],['15','Jambi'],['16','Sumatera Selatan'],['17','Bengkulu'],['18','Lampung'],['19','Kepulauan Bangka Belitung'],['21','Kepulauan Riau'],
  ['31','Daerah Khusus Ibukota Jakarta'],['32','Jawa Barat'],['33','Jawa Tengah'],['34','Daerah Istimewa Yogyakarta'],['35','Jawa Timur'],['36','Banten'],
  ['51','Bali'],['52','Nusa Tenggara Barat'],['53','Nusa Tenggara Timur'],['61','Kalimantan Barat'],['62','Kalimantan Tengah'],['63','Kalimantan Selatan'],['64','Kalimantan Timur'],['65','Kalimantan Utara'],
  ['71','Sulawesi Utara'],['72','Sulawesi Tengah'],['73','Sulawesi Selatan'],['74','Sulawesi Tenggara'],['75','Gorontalo'],['76','Sulawesi Barat'],['81','Maluku'],['82','Maluku Utara'],['91','Papua'],['92','Papua Barat'],['93','Papua Selatan'],['94','Papua Tengah'],['95','Papua Pegunungan'],['96','Papua Barat Daya'],
] as const;
const BASE='https://www.emsifa.com/api-wilayah-indonesia/v2';
const LEGACY_BASE='https://emsifa.github.io/api-wilayah-indonesia/api';
const validId=(value:string)=>/^\d+(?:\.\d+)?$/.test(value);

function rowsFrom(value:unknown):RegionRow[]{
  if(Array.isArray(value))return value as RegionRow[];
  if(value&&typeof value==='object'){
    const record=value as {data?:unknown;items?:unknown};
    const rows=record.data??record.items;
    if(Array.isArray(rows))return rows as RegionRow[];
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
  const legacyPath=level==='provinces'?'/provinces.json':level==='regencies'&&/^\d+$/.test(parent)?`/regencies/${parent}.json`:level==='districts'&&/^\d+$/.test(parent)?`/districts/${parent}.json`:level==='villages'&&/^\d+$/.test(parent)?`/villages/${parent}.json`:null;
  if(!path)return Response.json({error:'Choose a valid administrative region.',items:[]},{status:400});
  if(level==='provinces'){
    const items=LOCAL_PROVINCES.map(([id,name])=>({id,name,postalCode:null,latitude:null,longitude:null}));
    return Response.json({items},{headers:{'Cache-Control':'public, max-age=86400, s-maxage=604800'}});
  }

  try{
    let rows:RegionRow[];
    try{
      rows=await fetchRows(`${BASE}${path}`);
    }catch{
      if(!legacyPath)throw new Error('Region data unavailable.');
      rows=await fetchRows(`${LEGACY_BASE}${legacyPath}`);
    }
    const items=rows.map(row=>({id:String(row.id),name:row.name,postalCode:row.postal_code?String(row.postal_code):null,latitude:row.latitude??null,longitude:row.longitude??null}));
    return Response.json({items},{headers:{'Cache-Control':'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000'}});
  }catch{
    return Response.json({error:'Administrative regions are temporarily unavailable.',items:[]},{status:503,headers:{'Cache-Control':'public, max-age=300'}});
  }
}
