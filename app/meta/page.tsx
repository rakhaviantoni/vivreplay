import {withRequestLocale} from '@/lib/with-request-locale';
import {MetaExperience} from '@/components/tcg/meta-experience';
import {requestPageMetadata} from '@/lib/request-page-metadata';

export async function generateMetadata(){return requestPageMetadata({title:'Meta Stats',description:'One Piece Card Game leader win rates, matchup matrix, tournament results, and competitive decklists.',path:'/meta'});}
function Page(){return <MetaExperience/>}

export default withRequestLocale(Page);
