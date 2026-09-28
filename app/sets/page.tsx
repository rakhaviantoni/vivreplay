import {SetsExperience} from '@/components/tcg/sets-experience';
import {pageMetadata} from '@/lib/site-metadata';

export const metadata=pageMetadata({title:'Set archive',description:'Browse One Piece Card Game releases and open each card pool.',path:'/sets'});
export default function Page(){return <SetsExperience/>}
