import {PlayTutorial} from '@/components/tcg/play-tutorial';
import {privateMetadata} from '@/lib/site-metadata';
export const metadata=privateMetadata('Practice table','Direct practice-board links are not indexed.');
export default async function Page({searchParams}:{searchParams?:Promise<{deck?:string;format?:string}>}){const params=searchParams?await searchParams:{};return <PlayTutorial practiceDeckId={params.format==='practice'?params.deck:undefined}/>}
