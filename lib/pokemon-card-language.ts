export type PokemonCardLanguage='EN'|'JP'|'ID';

const validLanguage=(value:string|null|undefined):PokemonCardLanguage|null=>{
  const normalized=String(value??'').trim().toUpperCase().split(/[-_]/)[0];
  return normalized==='ID'?'ID':normalized==='JP'||normalized==='JA'?'JP':normalized==='EN'?'EN':null;
};

export async function preferredPokemonCardLanguage(profileLocale?:string|null):Promise<PokemonCardLanguage>{
  if(typeof window!=='undefined'){
    const routeIsIndonesian=window.location.pathname==='/id'||window.location.pathname.startsWith('/id/');
    if(routeIsIndonesian)return 'ID';
    const saved=validLanguage(window.localStorage.getItem('vivreplay-pokemon-language'));
    if(saved)return saved;
  }
  const profile=validLanguage(profileLocale);
  if(profile)return profile;
  if(typeof window!=='undefined'&&window.localStorage.getItem('vivreplay-locale')==='ID')return 'ID';
  try{
    const response=await fetch('/api/visitor-region',{cache:'no-store'});
    if(response.ok){
      const country=String((await response.json() as {country?:string}).country??'').toUpperCase();
      if(country==='ID')return 'ID';
      if(country==='JP')return 'JP';
    }
  }catch{}
  return 'EN';
}
