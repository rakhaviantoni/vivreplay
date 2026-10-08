import type {Metadata} from 'next';
import {FeedbackLaunchButton,FeedbackPageAutoOpen} from '@/components/tcg/feedback-launch';

export const metadata:Metadata={title:'Feedback & reports',description:'Report a VivrePlay bug, missing card printing, incorrect card data, or rules issue.',robots:{index:false,follow:false}};
export default async function FeedbackPage({searchParams}:{searchParams?:Promise<{type?:string;card?:string;printing?:string;listing?:string;from?:string}>}){
  const params=searchParams?await searchParams:{};
  const sourcePath=params.from?.startsWith('/')&&!params.from.startsWith('//')?params.from:undefined;
  const request={initialCategory:params.type,cardCode:params.card,printingId:params.printing,listingId:params.listing,sourcePath};
  return <main className="page feedback-page"><FeedbackPageAutoOpen request={request}/><header className="directory-hero page-intro-surface feedback-heading"><p className="eyebrow">HELP IMPROVE VIVREPLAY</p><h1>Feedback &amp; reports</h1><p>Found a bug, a missing printing, or card data that needs a check? Send the details here.</p></header><section className="feedback-page-prompt"><div><p className="eyebrow">CARD DATA · PLAY · MARKET</p><h2>Tell us what you found.</h2><p>For card reports, include the card code and printing when you can. The page you report from is attached automatically.</p></div><FeedbackLaunchButton request={request} className="button">Open feedback form</FeedbackLaunchButton></section></main>;
}
