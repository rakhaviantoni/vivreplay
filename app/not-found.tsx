import {isIndonesianRequest} from '@/lib/locale';
import {RouteNotFound} from '@/components/tcg/route-not-found';

export default async function NotFound(){
  const indonesian=await isIndonesianRequest();
  return <RouteNotFound href="/" label={indonesian?'Kembali ke beranda':'Back to VivrePlay'} indonesian={indonesian}/>;
}
