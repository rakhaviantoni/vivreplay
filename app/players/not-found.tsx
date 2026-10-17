import {RouteNotFound} from '@/components/tcg/route-not-found';
import {isIndonesianRequest} from '@/lib/locale';

export default async function PlayerNotFound(){
  const indonesian=await isIndonesianRequest();
  return <RouteNotFound href="/market" label={indonesian?'Kembali ke Market':'Back to Market'} description={indonesian?'Profil ini mungkin sudah tidak tersedia atau tautannya salah.':'This profile may no longer be available, or the link may be incorrect.'} indonesian={indonesian}/>;
}
