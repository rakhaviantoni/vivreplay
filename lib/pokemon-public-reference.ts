export function pokemonPublicNumber(value?:string|null){
  const rawNumber=String(value??'').trim().replace(/_p\d+$/i,'');
  if(/^CT-\d+$/i.test(rawNumber))return '';
  // Collector numbers such as 354/S-P should show as 354; the set code is
  // already shown separately. Never turn the denominator into the number.
  return rawNumber.match(/^(?:[A-Z]+-)?(\d{1,4})(?:\s*\/.*)?$/i)?.[1]
    ??rawNumber.match(/(?:^|[-/])(\d{1,4})(?:$|\/)/)?.[1]
    ??'';
}

export function pokemonPublicReference({code='',setCode='',printingCode='',localCardNumber=''}:{code?:string|null;setCode?:string|null;printingCode?:string|null;localCardNumber?:string|null}){
  const embedded=/^PK-([A-Z0-9]+)-([A-Z0-9]+)$/i.exec(String(code??'').trim());
  const set=String(setCode||embedded?.[1]||'').trim();
  // Cardtell IDs identify imported records, not printed collector numbers.
  if(embedded?.[1]?.toUpperCase()==='CT')return set;
  const number=pokemonPublicNumber(localCardNumber||printingCode||embedded?.[2]||'');
  return [set,number].filter(Boolean).join(' ');
}
