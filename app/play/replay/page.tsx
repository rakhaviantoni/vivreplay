import {TournamentReplayTable} from '@/components/tcg/tournament-replay-table';
import {pageMetadata} from '@/lib/site-metadata';
export const metadata=pageMetadata({title:'Tournament match simulation',description:'Step through a simulated tournament match on VivrePlay, reconstructed from tournament results and representative decklists.',path:'/play/replay'});
export default async function Page({searchParams}:{searchParams:Promise<{match?:string}>}){const {match=''}=await searchParams;return <TournamentReplayTable matchId={match}/>}
