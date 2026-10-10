import type {Metadata} from 'next';
import Script from 'next/script';
import {headers} from 'next/headers';
import {Shell} from '@/components/tcg/shell';
import {DeferredWebFonts} from '@/components/tcg/deferred-web-fonts';
import './globals.css';
import './vivreplay.css';
import './catalog-workbench.css';
import './mobile.css';

const siteName='VivrePlay';
const description='A premium One Piece Card Game companion for cards, decks, collections, and play.';
export const metadata:Metadata={
  metadataBase:new URL('https://vivreplay.com'),
  title:{default:siteName,template:`%s | ${siteName}`},
  description,
  applicationName:siteName,
  keywords:['VivrePlay','One Piece Card Game','OPTCG','TCG cards','deck builder','card collection'],
  icons:{icon:[{url:'/brand/vivreplay-icon-192.png',type:'image/png',sizes:'192x192'},{url:'/brand/vivreplay-compass.png',type:'image/png'}],apple:[{url:'/brand/vivreplay-icon-192.png',sizes:'192x192',type:'image/png'}]},
  manifest:'/manifest.webmanifest',
  openGraph:{type:'website',siteName,title:siteName,description,images:[{url:'/brand/vivreplay-og.png',width:1200,height:630,alt:'VivrePlay'}]},
  twitter:{card:'summary_large_image',title:siteName,description,images:['/brand/vivreplay-og.png']},
};
export default async function RootLayout({children}:{children:React.ReactNode}){
  const requestHeaders=await headers();
  const locale=requestHeaders.get('x-locale')==='ID'||requestHeaders.get('x-middleware-rewrite')?.startsWith('/id')?'id':'en';
  const structuredData={
    '@context':'https://schema.org',
    '@graph':[
      {'@type':'Organization','@id':'https://vivreplay.com/#organization','name':'VivrePlay','url':'https://vivreplay.com/','logo':{'@type':'ImageObject','url':'https://vivreplay.com/brand/vivreplay-icon-192.png'},'description':'An independent fan-made companion for the One Piece Card Game, with a card archive, deck tools, collection management, Market listings, and table practice.'},
      {'@type':'WebSite','@id':'https://vivreplay.com/#website','url':'https://vivreplay.com/','name':'VivrePlay','publisher':{'@id':'https://vivreplay.com/#organization'},'inLanguage':['en','id']},
    ],
  };
  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://shqwaqxpxsyjafxdcibj.supabase.co"/>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
      </head>
      <body>
        <DeferredWebFonts/>
        <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(structuredData)}}/>
        <Script id="error-guard" strategy="beforeInteractive">{`window.addEventListener('error',function(e){if(e&&e.message&&e.message.indexOf("reading 'startTime'")!==-1){e.preventDefault();e.stopImmediatePropagation()}});`}</Script>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
