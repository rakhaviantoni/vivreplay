import {MetaExperience} from '@/components/tcg/meta-experience';
import {pageMetadata} from '@/lib/site-metadata';

export const metadata=pageMetadata({title:'Meta Stats',description:'One Piece Card Game leader win rates, matchup matrix, tournament results, and competitive decklists.',path:'/meta'});
export default function Page(){return <MetaExperience/>}
