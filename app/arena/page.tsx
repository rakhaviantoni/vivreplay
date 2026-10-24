import {isIndonesianRequest} from '@/lib/locale';
import {redirect} from 'next/navigation';
import {privateMetadata} from '@/lib/site-metadata';
export const metadata=privateMetadata('Arena','This legacy route redirects to the Arena.');

export default async function ArenaPage(){
  redirect((await isIndonesianRequest())?'/id/play':'/play');
}
