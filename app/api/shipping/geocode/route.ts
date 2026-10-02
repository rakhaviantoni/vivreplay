type PhotonProperties={name?:string;street?:string;housenumber?:string;postcode?:string;district?:string;city_district?:string;county?:string;suburb?:string;neighbourhood?:string;locality?:string;city?:string;state?:string;country?:string;countrycode?:string;osm_value?:string;type?:string};
type PhotonFeature={properties?:PhotonProperties;geometry?:{coordinates?:[number,number]}};

export async function GET(request:Request){
  const params=new URL(request.url).searchParams;
  const query=(params.get('q')??'').trim().slice(0,180);
  if(query.length<4)return Response.json({results:[]});
  const url=new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q',query);
  url.searchParams.set('countrycode','ID');
  url.searchParams.set('lang',params.get('lang')==='id'?'id':'en');
  url.searchParams.set('limit','8');
  const lat=Number(params.get('lat')),lon=Number(params.get('lon'));
  if(Number.isFinite(lat)&&Number.isFinite(lon)){url.searchParams.set('lat',String(lat));url.searchParams.set('lon',String(lon));}
  try{
    const upstream=await fetch(url,{headers:{accept:'application/geo+json'},cache:'force-cache',next:{revalidate:3600}});
    if(!upstream.ok)throw new Error('Address search unavailable.');
    const payload=await upstream.json() as {features?:PhotonFeature[]};
    const results=(payload.features??[]).flatMap(feature=>{
      const p=feature.properties;const coords=feature.geometry?.coordinates;
      if(!p||!coords||!Number.isFinite(coords[0])||!Number.isFinite(coords[1]))return [];
      if((p.countrycode&&p.countrycode.toLowerCase()!=='id')||(p.country&&!/indonesia/i.test(p.country)))return [];
      const district=p.district??p.city_district??p.county??'';
      const subdistrict=p.suburb??p.neighbourhood??'';
      const locality=[subdistrict,district,p.city,p.state].filter((value,index,list):value is string=>Boolean(value)&&list.indexOf(value)===index);
      const street=[p.housenumber,p.street].filter(Boolean).join(' ');
      const label=[p.name,street, ...locality,p.postcode,p.country].filter((value,index,list):value is string=>Boolean(value)&&list.indexOf(value)===index).join(', ');
      return [{label,latitude:coords[1],longitude:coords[0],postalCode:p.postcode??'',district,subdistrict,city:p.city??'',province:p.state??'',type:p.osm_value??p.type??''}];
    });
    return Response.json({results},{headers:{'Cache-Control':'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400'}});
  }catch{return Response.json({error:'Address search is temporarily unavailable.',results:[]},{status:503,headers:{'Cache-Control':'public, max-age=60'}});}
}
