import {HomeExperience} from '@/components/tcg/home-experience';
import {pageMetadata} from '@/lib/site-metadata';
import {headers} from 'next/headers';
import {redirect} from 'next/navigation';

export const metadata=pageMetadata({title:'Pokémon TCG Card Database & Collection',description:'Explore Pokémon TCG cards and sets, manage your collection, and browse community listings on VivrePlay.',path:'/pokemon'});

export default async function PokemonHome({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const values=await searchParams;
  const localePrefix=(await headers()).get('x-locale')==='ID'?'/id':'';
  const catalogKeys=new Set(['set','q','illustrator','rarity','card','printing','number','lang']);
  const params=new URLSearchParams();
  for(const [key,value] of Object.entries(values))if(catalogKeys.has(key)){for(const item of Array.isArray(value)?value:value?[value]:[])params.append(key,item)}
  if(params.size)redirect(`${localePrefix}/pokemon/cards?${params.toString()}`);
  return <HomeExperience game="pokemon"/>;
}
