import {AboutExperience} from '@/components/tcg/about-experience';

import {pageMetadata} from '@/lib/site-metadata';

export const metadata=pageMetadata({title:'About VivrePlay',description:'Explore One Piece and Pokémon card libraries, collection tools, and the features currently available on VivrePlay.',path:'/about'});

export default function AboutPage() {
  return <AboutExperience />;
}
