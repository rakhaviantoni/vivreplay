import {RouteNotFound} from '@/components/tcg/route-not-found';
import {isIndonesianRequest} from '@/lib/locale';

export default async function CardsNotFound(){
  const indonesian=await isIndonesianRequest();
  return <RouteNotFound href="/cards" label={indonesian?'Kembali ke katalog kartu':'Back to Card Library'} indonesian={indonesian}/>;
}
