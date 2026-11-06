const normalizePrintingPart=(value:string)=>value.toUpperCase().replace(/[^A-Z0-9]/g,'');

export function onePieceVariantLabel(value:string|null|undefined,setCode:string|null|undefined,printingCode:string|null|undefined){
  const set=normalizePrintingPart(setCode??'');
  const print=normalizePrintingPart(printingCode??'');
  const printNumber=normalizePrintingPart(printingCode?.match(/(?:_|\b)(p\d+)$/i)?.[1]??'');
  const parts=String(value??'').split(/\s*[·•|/]\s*/).map(part=>part.trim()).filter(Boolean);
  const label=parts.map(part=>{
    // Older imports sometimes put the set name before the actual variant.
    // Keep the printing style and drop that redundant catalog context.
    const marker=part.match(/\b(standard|base|alt(?:ernate)?\s*art|parallel(?:\s*art)?|manga(?:\s*(?:art|rare))?|wanted(?:\s*alt(?:ernate)?\s*art)?|promo(?:tional)?|super\s*pre[ -]?release|special\s*alternate\s*art)\b/i);
    if(marker?.index)part=part.slice(marker.index);
    const normalized=normalizePrintingPart(part);
    if(normalized===set||normalized===print||normalized===printNumber)return '';
    if(/^P\d+$/.test(normalized)||/^(OP|ST|EB|PRB)\d+$/.test(normalized))return '';
    return part;
  }).filter(Boolean).join(' ');
  return label.replace(/\s+/g,' ').replace(/\bAlternate Art\b/ig,'Alt art').replace(/\bParallel Art\b/ig,'Parallel').trim();
}
