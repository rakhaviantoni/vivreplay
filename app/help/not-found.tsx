import {RouteNotFound} from '@/components/tcg/route-not-found';
import {isIndonesianRequest} from '@/lib/locale';

export default async function HelpNotFound(){
  const indonesian=await isIndonesianRequest();
  return <RouteNotFound href="/help" label={indonesian?'Kembali ke Pusat Bantuan':'Back to Help Center'} indonesian={indonesian}/>;
}
