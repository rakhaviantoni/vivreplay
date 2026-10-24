import {withRequestLocale} from '@/lib/with-request-locale';
import {ArchetypeDirectory} from '@/components/tcg/library-directory';
import {requestPageMetadata} from '@/lib/request-page-metadata';

export async function generateMetadata(){return requestPageMetadata({title:'Archetypes',description:'Browse One Piece Card Game cards by the traits and archetypes that connect them.',path:'/archetypes'});}
function Page(){return <ArchetypeDirectory/>}

export default withRequestLocale(Page);
