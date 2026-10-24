import Link from '@/components/ui/localized-link';
import {pokemonRarityLabel} from '@/lib/pokemon-rarity';
import type {EnrichedCollectionItem} from '../types';
import {onePieceVariantLabel} from './printing-labels';
import {pokemonPublicReference} from '@/lib/pokemon-public-reference';
import {pokemonLocalCardNumber} from '@/lib/pokemon-set-aliases';

export function vaultPublicCardReference(item:EnrichedCollectionItem){
  const isPokemon=item.card.gameSlug==='pokemon'||/^PK-/i.test(item.card.code);
  if(!isPokemon)return item.card.code;
  const printing=item.card.availablePrintings?.find(option=>String(option.id)===String(item.printingId));
  return pokemonPublicReference({
    code:item.card.code,
    setCode:printing?.set_code??item.setCode??item.card.setCode,
    printingCode:printing?.printing_code??item.printingCode??item.card.printingCode,
    localCardNumber:printing?.localCardNumber??item.card.localCardNumber,
  });
}

export function vaultPublicCardHref(item:EnrichedCollectionItem){
  if(item.card.gameSlug==='pokemon'||/^PK-/i.test(item.card.code)){
    const reference=vaultPublicCardReference(item).split(/\s+/);
    const params=new URLSearchParams({set:reference[0]??'',number:reference[1]??'',lang:item.language??item.card.language??'EN'});
    return `/pokemon/cards?${params.toString()}`;
  }
  return `/cards/${encodeURIComponent(item.card.code)}`;
}

export function VaultSlotMetaIdentity({item,printingLabel}:{item:EnrichedCollectionItem;printingLabel:string}){
  const isPokemon=item.card.gameSlug==='pokemon'||/^PK-/i.test(item.card.code);
  if(!isPokemon){
    const fallbackParts=printingLabel.split('/').map(value=>value.trim());
    const selectedPrinting=item.card.availablePrintings?.find(option=>String(option.id)===String(item.printingId));
    const language=selectedPrinting?.language??item.language??item.card.language??fallbackParts[0]??'';
    const setCode=(selectedPrinting?.set_code??item.setCode??item.card.setCode??'').replace(/^OP-/i,'OP');
    const printCode=selectedPrinting?.printing_code??item.printingCode??item.card.printingCode??'';
    const variant=onePieceVariantLabel(selectedPrinting?.variant??item.variant??item.card.variant??fallbackParts[1]??'',setCode,printCode);
    const printNumber=printCode.match(/_(p\d+)$/i)?.[1];

    return <span className="vault-slot-meta-identity vault-slot-meta-op">
      <b>{item.card.code}</b>
      {language&&<small>{language}</small>}
      {variant&&variant.toLowerCase()!=='standard'&&<small>{variant}</small>}
      {setCode&&<small>{setCode}</small>}
      {printNumber&&<small>{printNumber}</small>}
    </span>;
  }

  const printing=item.card.availablePrintings?.find(option=>String(option.id)===String(item.printingId))
    ??item.card.availablePrintings?.find(option=>
      (item.language??item.card.language)===(option.language)
      &&(item.setCode??item.card.setCode??'').replace(/[-_\s]/g,'').toUpperCase()===(option.set_code??'').replace(/[-_\s]/g,'').toUpperCase()
      &&String(item.printingCode??item.card.printingCode??'')===String(option.printing_code??'')
      &&String(item.variant??item.card.variant??'')===String(option.variant??'')
    );
  const setName=printing?.set_name?.trim();
  const setCode=printing?.set_code??item.setCode??item.card.setCode??'';
  const visibleSetCode=setCode&&!/^PK-/i.test(setCode)?setCode.toLowerCase():'';
  const printingCode=printing?.printing_code??item.printingCode??item.card.printingCode??item.card.code;
  const localNumber=pokemonLocalCardNumber(item.card.source_payload,printing?.localCardNumber??printingCode);
  const number=/^CT-\d+$/i.test(localNumber)?'':localNumber.match(/^(?:[A-Z]+-)?(\d{1,4})(?:\s*\/.*)?$/i)?.[1]??localNumber.match(/(?:^|[-/])(\d{1,4})(?:$|\/)/)?.[1]??'';
  const language=item.language??item.card.language??'EN';
  const rawRarity=printing?.rarity??item.rarity??item.card.rarity??'';
  const rarity=pokemonRarityLabel(rawRarity,language);
  const illustrator=printing?.illustrator?.trim();
  const libraryPath=language.toUpperCase()==='ID'?'/id/pokemon/cards':'/pokemon/cards';
  const filterHref=(filter:'set'|'rarity'|'illustrator',value:string)=>{
    const params=new URLSearchParams({lang:language});
    params.set(filter,value);
    return `${libraryPath}?${params.toString()}`;
  };
  const setHref=setCode?filterHref('set',setCode):undefined;
  const rarityHref=rawRarity?filterHref('rarity',rawRarity):undefined;

  return <span className={`vault-slot-meta-identity pokemon-card-meta-row${illustrator?' has-illustrator':''}`} aria-label={[setName,visibleSetCode,number,rarity,illustrator&&`Illustrator ${illustrator}`].filter(Boolean).join(' ')}>
    {setName&&setHref?<Link className="pokemon-card-set-name" href={setHref} title={setName} aria-label={`Browse cards from ${setName}`}>{setName}</Link>:setName&&<small className="pokemon-card-set-name" title={setName}>{setName}</small>}
    {visibleSetCode&&setHref?<Link className="pokemon-card-set-badge" href={setHref} aria-label={`Filter by set ${visibleSetCode}`}>{visibleSetCode}</Link>:visibleSetCode&&<small className="pokemon-card-set-badge">{visibleSetCode}</small>}
    {visibleSetCode&&number&&<span className="pokemon-card-meta-divider" aria-hidden="true"/>}
    {number&&<small className="pokemon-card-number">{number}</small>}
    {rarity&&rarityHref?<Link className="pokemon-card-rarity" href={rarityHref} aria-label={`Filter by rarity ${rarity}`}>{rarity}</Link>:rarity&&<small className="pokemon-card-rarity">{rarity}</small>}
    {illustrator&&<span className="pokemon-card-illustrator-inline"><small>Illus.</small><Link href={filterHref('illustrator',illustrator)} aria-label={`Filter by illustrator ${illustrator}`}><strong>{illustrator}</strong></Link></span>}
  </span>;
}
