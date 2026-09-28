import {ArchetypeDirectory} from '@/components/tcg/library-directory';
import {pageMetadata} from '@/lib/site-metadata';

export const metadata=pageMetadata({title:'Archetypes',description:'Browse One Piece Card Game cards by the traits and archetypes that connect them.',path:'/archetypes'});
export default function Page(){return <ArchetypeDirectory/>}
