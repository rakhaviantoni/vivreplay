import type {Metadata} from 'next';
import {FeedbackForm} from '@/components/tcg/feedback-form';

export const metadata:Metadata={title:'Feedback & reports | VivrePlay',description:'Report a VivrePlay bug, missing card printing, incorrect card data, or rules issue.',robots:{index:false,follow:false}};
export default async function FeedbackPage({searchParams}:{searchParams?:Promise<{type?:string;card?:string;printing?:string;listing?:string;from?:string}>}){
  const params=searchParams?await searchParams:{};
  return <main className="page feedback-page"><header className="page-intro-surface feedback-heading"><p className="kicker">HELP IMPROVE VIVREPLAY</p><h1>Feedback & reports</h1><p>Found a bug, a missing printing, or card data that needs a check? Send the details here.</p></header><div className="feedback-layout"><section><p className="eyebrow">CARD DATA · PLAY · MARKET</p><h2>Tell us what you found.</h2><p>For card reports, include the card code and printing when you can. The page you report from is attached automatically.</p></section><FeedbackForm initialCategory={params.type} cardCode={params.card} printingId={params.printing} listingId={params.listing} sourcePath={params.from?.startsWith('/')&&!params.from.startsWith('//')?params.from:undefined}/></div></main>;
}
