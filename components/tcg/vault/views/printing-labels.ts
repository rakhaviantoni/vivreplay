const normalizePrintingPart=(value:string)=>value.toUpperCase().replace(/[^A-Z0-9]/g,'');

export function onePieceVariantLabel(value:string|null|undefined,setCode:string|null|undefined,printingCode:string|null|undefined){
  const set=normalizePrintingPart(setCode??'');
  const print=normalizePrintingPart(printingCode??'');
  const printNumber=normalizePrintingPart(printingCode?.match(/(?:_|\b)(p\d+)$/i)?.[1]??'');
  const parts=String(value??'').split(/\s*[·•|/]\s*/).map(part=>part.trim()).filter(Boolean);
  const label=parts.filter(part=>{
    const normalized=normalizePrintingPart(part);
    if(normalized===set||normalized===print||normalized===printNumber)return false;
    if(/^P\d+$/.test(normalized)||/^(OP|ST|EB|PRB)\d+$/.test(normalized))return false;
    return true;
  }).join(' ');
  return label.replace(/\s+/g,' ').trim();
}
