import {RouteNotFound} from '@/components/tcg/route-not-found';
import {isIndonesianRequest} from '@/lib/locale';

export default async function OrderNotFound(){
  const indonesian=await isIndonesianRequest();
  return <RouteNotFound href="/market?profile=orders" label={indonesian?'Kembali ke pesanan':'Back to Orders'} description={indonesian?'Pesanan ini tidak tersedia atau tautannya salah.':'This order is unavailable, or the link may be incorrect.'} indonesian={indonesian}/>;
}
