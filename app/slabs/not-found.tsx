import {RouteNotFound} from '@/components/tcg/route-not-found';
import {isIndonesianRequest} from '@/lib/locale';

export default async function SlabNotFound(){
  const indonesian=await isIndonesianRequest();
  return <RouteNotFound href="/vault" label={indonesian?'Kembali ke Vault':'Back to Vault'} indonesian={indonesian}/>;
}
