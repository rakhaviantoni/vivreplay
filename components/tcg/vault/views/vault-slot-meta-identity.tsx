import {pokemonRarityLabel} from '@/lib/pokemon-rarity';
import type {EnrichedCollectionItem} from '../types';
import {onePieceVariantLabel} from './printing-labels';

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
  const number=printingCode.split(/[-/]/).filter(Boolean).at(-1)??'';
  const language=item.language??item.card.language??'EN';
  const rarity=pokemonRarityLabel(printing?.rarity??item.rarity??item.card.rarity,language);
  const illustrator=printing?.illustrator?.trim();

  return <span className={`vault-slot-meta-identity pokemon-card-meta-row${illustrator?' has-illustrator':''}`} aria-label={[setName,visibleSetCode,number,rarity,illustrator&&`Illustrator ${illustrator}`].filter(Boolean).join(' ')}>
    {setName&&<small className="pokemon-card-set-name" title={setName}>{setName}</small>}
    {visibleSetCode&&<small className="pokemon-card-set-badge">{visibleSetCode}</small>}
    {visibleSetCode&&number&&<span className="pokemon-card-meta-divider" aria-hidden="true"/>}
    {number&&<small className="pokemon-card-number">{number}</small>}
    {rarity&&<small className="pokemon-card-rarity">{rarity}</small>}
    {illustrator&&<span className="pokemon-card-illustrator-inline"><small>Illus.</small><strong>{illustrator}</strong></span>}
  </span>;
}
