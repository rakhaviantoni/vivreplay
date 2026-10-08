import {AboutExperience} from '@/components/tcg/about-experience';

import {pageMetadata} from '@/lib/site-metadata';

export const metadata=pageMetadata({title:'About',description:'Learn how VivrePlay brings card archives, deck building, collection tools, market listings, and table practice together for the One Piece Card Game community.',path:'/about'});

export default function AboutPage() {
  return <AboutExperience />;
}
