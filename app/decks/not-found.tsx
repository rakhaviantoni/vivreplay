import {RouteNotFound} from '@/components/tcg/route-not-found';
import {isIndonesianRequest} from '@/lib/locale';

export default async function DecksNotFound(){
  const indonesian=await isIndonesianRequest();
  return <RouteNotFound href="/decks" label={indonesian?'Kembali ke deck':'Back to Decks'} indonesian={indonesian}/>;
}
