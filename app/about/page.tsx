import {AboutExperience} from '@/components/tcg/about-experience';
import {LocaleScope} from '@/components/locale-provider';
import {isIndonesianRequest} from '@/lib/locale';

import {requestPageMetadata} from '@/lib/request-page-metadata';

export async function generateMetadata(){return requestPageMetadata({title:'About VivrePlay',description:'Explore One Piece and Pokémon card libraries, collection tools, and the features currently available on VivrePlay.',path:'/about'});}

export default async function AboutPage() {
  return <LocaleScope locale={(await isIndonesianRequest())?'ID':'EN'}><AboutExperience /></LocaleScope>;
}
