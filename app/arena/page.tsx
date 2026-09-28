import {redirect} from 'next/navigation';
import {privateMetadata} from '@/lib/site-metadata';
export const metadata=privateMetadata('Arena','This legacy route redirects to the Arena.');

export default function ArenaPage(){
  redirect('/play');
}
