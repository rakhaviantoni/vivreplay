import {withRequestLocale} from '@/lib/with-request-locale';
import {TournamentReplayTable} from '@/components/tcg/tournament-replay-table';
import {requestPageMetadata} from '@/lib/request-page-metadata';
export async function generateMetadata(){return requestPageMetadata({title:'Tournament match simulation',description:'Step through a simulated tournament match on VivrePlay, reconstructed from tournament results and representative decklists.',path:'/play/replay'});}
async function Page({searchParams}:{searchParams:Promise<{match?:string}>}){const {match=''}=await searchParams;return <TournamentReplayTable matchId={match}/>}

export default withRequestLocale(Page);
