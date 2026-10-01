import {db} from '@/lib/server/store';

const trackedKeys=new Set(['gclid','dclid','fbclid','msclkid','ttclid','twclid','li_fat_id']);
const clean=(value:unknown,max=300)=>typeof value==='string'?value.trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,max)||null:null;
const searchHosts:Record<string,string>={'google.com':'google','bing.com':'bing','search.yahoo.com':'yahoo','duckduckgo.com':'duckduckgo','baidu.com':'baidu','yandex.com':'yandex','ecosia.org':'ecosia','brave.com':'brave'};
const socialHosts:Record<string,string>={'facebook.com':'facebook','instagram.com':'instagram','tiktok.com':'tiktok','x.com':'x','twitter.com':'x','reddit.com':'reddit','youtube.com':'youtube','youtu.be':'youtube','linkedin.com':'linkedin','threads.net':'threads','discord.com':'discord'};
function inferredSource(referrer:string|null,host:string){
  if(!referrer)return {source:'direct',medium:'none'};
  try{
    const domain=new URL(referrer).hostname.toLowerCase().replace(/^www\./,'');
    if(domain===host||domain.endsWith(`.${host}`))return {source:'direct',medium:'none'};
    const root=domain.split('.').slice(-2).join('.');
    const searchHost=Object.keys(searchHosts).find(item=>domain===item||domain.endsWith(`.${item}`));
    if(searchHost)return {source:searchHosts[searchHost],medium:'organic'};
    const socialHost=Object.keys(socialHosts).find(item=>domain===item||domain.endsWith(`.${item}`));
    if(socialHost)return {source:socialHosts[socialHost],medium:'social'};
    return {source:root,medium:'referral'};
  }catch{return {source:'direct',medium:'none'};}
}

export async function POST(request:Request){
  try{
    const origin=request.headers.get('origin');
    if(origin&&new URL(origin).host!==new URL(request.url).host)return Response.json({error:'Invalid origin.'},{status:403});
    const body=await request.json() as {visitorId?:unknown;landingPath?:unknown;referrer?:unknown;params?:unknown};
    if(typeof body.visitorId!=='string'||!/^[0-9a-f-]{36}$/i.test(body.visitorId))return Response.json({error:'Invalid visitor id.'},{status:400});
    const landingPath=clean(body.landingPath,500);
    if(!landingPath||!landingPath.startsWith('/')||landingPath.startsWith('//'))return Response.json({error:'Invalid landing path.'},{status:400});
    let referrerOrigin:string|null=null;
    try{if(typeof body.referrer==='string'&&body.referrer)referrerOrigin=new URL(body.referrer).origin;}catch{}
    const incoming=body.params&&typeof body.params==='object'&&!Array.isArray(body.params)?body.params as Record<string,unknown>:{};
    const country=(request as Request&{cf?:{country?:string}}).cf?.country;
    const countryCode=country&&/^[A-Z]{2}$/.test(country)?country:null;
    const params:Record<string,string>={};
    for(const [key,value] of Object.entries(incoming).slice(0,40)){
      if(!/^utm_[a-z0-9_]{1,40}$/.test(key)&&!trackedKeys.has(key))continue;
      const normalized=clean(value,300);
      if(normalized)params[key]=normalized;
    }
    const inferred=inferredSource(referrerOrigin,new URL(request.url).hostname.toLowerCase().replace(/^www\./,''));
    const source=params.utm_source??inferred.source;
    const medium=params.utm_medium??inferred.medium;
    await db().prepare(`INSERT INTO attribution_visits (id,visitor_id,landing_path,referrer_origin,country_code,utm_source,utm_medium,utm_campaign,utm_term,utm_content,parameters)
      VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`).bind(
      body.visitorId,body.visitorId,landingPath,referrerOrigin,countryCode,
      source,medium,params.utm_campaign??null,params.utm_term??null,params.utm_content??null,JSON.stringify(params),
    ).run();
    await db().prepare(`DELETE FROM attribution_visits WHERE created_at < datetime('now','-180 days')`).run();
    return Response.json({stored:true},{headers:{'Cache-Control':'no-store'}});
  }catch{return Response.json({error:'Attribution could not be stored.'},{status:503});}
}
