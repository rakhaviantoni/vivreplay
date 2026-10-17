import {RouteNotFound} from '@/components/tcg/route-not-found';
import {isIndonesianRequest} from '@/lib/locale';

export default async function SetsNotFound(){
  const indonesian=await isIndonesianRequest();
  return <RouteNotFound href="/sets" label={indonesian?'Kembali ke daftar set':'Back to Sets'} indonesian={indonesian}/>;
}
