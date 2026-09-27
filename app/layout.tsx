import type {Metadata} from 'next';
import Script from 'next/script';
import {Shell} from '@/components/tcg/shell';
import './globals.css';
import './vivreplay.css';
import './vault.css';
import './playmat.css';
import './catalog-workbench.css';
import './mobile.css';

const siteName='VivrePlay';
const description='A premium One Piece Card Game companion for cards, decks, collections, and play.';
export const metadata:Metadata={
  metadataBase:new URL('https://vivreplay.com'),
  title:{default:siteName,template:`%s · ${siteName}`},
  description,
  applicationName:siteName,
  keywords:['VivrePlay','One Piece Card Game','OPTCG','TCG cards','deck builder','card collection'],
  icons:{icon:[{url:'/brand/vivreplay-icon-192.png',type:'image/png',sizes:'192x192'},{url:'/brand/vivreplay-compass.png',type:'image/png'}],apple:[{url:'/brand/vivreplay-icon-192.png',sizes:'192x192',type:'image/png'}]},
  manifest:'/manifest.webmanifest',
  openGraph:{type:'website',siteName,title:siteName,description,images:[{url:'/brand/vivreplay-og.png',width:1200,height:630,alt:'VivrePlay'}]},
  twitter:{card:'summary_large_image',title:siteName,description,images:['/brand/vivreplay-og.png']},
};
export default function RootLayout({children}:{children:React.ReactNode}){
  return (
    <html lang="en">
      <body>
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-2Z50572QD3" strategy="afterInteractive"/>
        <Script id="google-analytics" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-2Z50572QD3');`}</Script>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
