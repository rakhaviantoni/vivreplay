import {MetaExperience} from '@/components/tcg/meta-experience';
import {pageMetadata} from '@/lib/site-metadata';

export const metadata=pageMetadata({title:'Tournament Meta',description:'Explore sourced One Piece Card Game tournament results, published decklists, and verified matchup records.',path:'/meta'});
export default function Page(){return <MetaExperience/>}
