import {servePokemonArt} from '@/lib/server/pokemon-art-response';

export async function GET(request:Request,{params}:{params:Promise<{language:string;set:string;card:string}>}){
  const {language,set,card}=await params;
  return servePokemonArt(request,language,set,card);
}
