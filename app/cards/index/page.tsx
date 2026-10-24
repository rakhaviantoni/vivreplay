import {withRequestLocale} from '@/lib/with-request-locale';
import {CardIndex} from '@/components/tcg/library-directory';
import {requestPageMetadata} from '@/lib/request-page-metadata';

export async function generateMetadata(){return requestPageMetadata({title:'Card index',description:'Browse the One Piece Card Game card pool by set and card number.',path:'/cards/index'});}
function Page(){return <CardIndex/>}

export default withRequestLocale(Page);
