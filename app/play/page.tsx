import {withRequestLocale} from '@/lib/with-request-locale';
import {ArenaLobby} from '@/components/tcg/arena-lobby';
import {requestPageMetadata} from '@/lib/request-page-metadata';

export async function generateMetadata(){return requestPageMetadata({title:'Arena',description:'Practice One Piece Card Game turns at an interactive table with VivrePlay Arena.',path:'/play'});}
function Page(){return <ArenaLobby/>}

export default withRequestLocale(Page);
