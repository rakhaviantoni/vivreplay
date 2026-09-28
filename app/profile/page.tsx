import {Profile} from '@/components/tcg/profile';
import {privateMetadata} from '@/lib/site-metadata';
export const metadata=privateMetadata('Profile','Your player profile settings are private.');
export default function Page(){return <Profile/>}
