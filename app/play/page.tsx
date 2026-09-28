import {ArenaLobby} from '@/components/tcg/arena-lobby';
import {pageMetadata} from '@/lib/site-metadata';

export const metadata=pageMetadata({title:'Arena',description:'Practice One Piece Card Game turns at an interactive table with VivrePlay Arena.',path:'/play'});
export default function Page(){return <ArenaLobby/>}
