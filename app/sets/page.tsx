import {withRequestLocale} from '@/lib/with-request-locale';
import {SetsExperience} from '@/components/tcg/sets-experience';
import {requestPageMetadata} from '@/lib/request-page-metadata';

export async function generateMetadata(){return requestPageMetadata({title:'Set archive',description:'Browse One Piece Card Game releases and open each card pool.',path:'/sets'});}
function Page(){return <SetsExperience/>}

export default withRequestLocale(Page);
