import {MetaExperience} from '@/components/tcg/meta-experience';
import {pageMetadata} from '@/lib/site-metadata';

export const metadata=pageMetadata({title:'Meta',description:'Explore VivrePlay’s current One Piece Card Game meta overview and matchup insights.',path:'/meta'});
export default function Page(){return <MetaExperience/>}
