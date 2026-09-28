import {CardIndex} from '@/components/tcg/library-directory';
import {pageMetadata} from '@/lib/site-metadata';

export const metadata=pageMetadata({title:'Card index',description:'Browse the One Piece Card Game card pool by set and card number.',path:'/cards/index'});
export default function Page(){return <CardIndex/>}
