import type {Metadata} from 'next';

export const metadata:Metadata={
  applicationName:'VivrePlay Pokémon',
  themeColor:'#ffffff',
  appleWebApp:{capable:true,title:'VivrePlay Pokémon',statusBarStyle:'default'},
  manifest:'/pokemon.webmanifest?v=1',
  icons:{
    icon:[
      {url:'/brand/vivreplay-pokemon-icon-192.png?v=2',type:'image/png',sizes:'192x192'},
      {url:'/brand/vivreplay-pokemon-icon-512.png?v=2',type:'image/png',sizes:'512x512'},
    ],
    apple:[{url:'/brand/vivreplay-pokemon-icon-192.png?v=2',type:'image/png',sizes:'192x192'}],
  },
};

export default function PokemonLayout({children}:{children:React.ReactNode}){
  return children;
}
