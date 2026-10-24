import {tcgdexArtResponse} from '@/lib/server/tcgdex-art-response';

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  if(!/^\d{1,12}$/.test(id))return new Response('Not found',{status:404});
  return tcgdexArtResponse(`https://cardtell.id/images/taxonomy/${id}.png`);
}
