export type OnePieceScanCode={setCode:string;cardNumber:string;rarity:string;variant:string};

export type PokemonScanCode={setCodeCandidates:string[];cardNumber:string;cardNumberTotal:string;rarity:string;language:string};

export function detectCardScanGame(text:string,requestedGame:'pokemon'|'one-piece'|'auto'):'pokemon'|'one-piece'|null{
  // A printed One Piece set/card code is stronger evidence than the page the
  // scanner was opened from. This lets scans work when the library is on the
  // other game, while the selected game still handles ambiguous OCR.
  if(parseOnePieceScanCode(text))return 'one-piece';
  if(requestedGame==='one-piece')return 'one-piece';
  if(requestedGame==='pokemon')return 'pokemon';
  return parsePokemonScanCode(text)?'pokemon':null;
}

export function detectPokemonScanLanguage(text:string){
  if(/[\u3040-\u30ff]/.test(text))return 'JP';
  const words=new Set((text.toLowerCase().match(/[a-záéíóúñ]+/g)??[]));
  const indonesian=['pemain','lawan','kartu','kelemahan','resistansi','mundur','peraturan','bertarung','lembar','serangan','gunakan','mengambil','energi','pokemon'];
  const english=['player','opponent','card','weakness','resistance','retreat','rule','attack','your','draw','energy','pokemon'];
  const idScore=indonesian.filter(word=>words.has(word)).length;
  const enScore=english.filter(word=>words.has(word)).length;
  if(idScore>=2&&idScore>enScore)return 'ID';
  if(enScore>=2&&enScore>idScore)return 'EN';
  return '';
}

function pokemonSetCandidates(word:string){
  const token=word.toUpperCase().replace(/[^A-Z0-9]/g,'');
  const tacticsSet=token.match(/^(MATS|MATK|MATL|MATH|MAAF|MAAL)(?=\d)/)?.[1];
  if(tacticsSet)return [tacticsSet];
  // OCR can append the regulation mark and a fragment of nearby print, turning
  // the printed PAL set code into PAL1NG. Keep the printed set identifier.
  if(token==='PAL1NG'||token==='PALING')return ['PAL'];
  // On older Japanese cards, OCR commonly reads the final “a” in S6a as 0,
  // and the adjacent regulation mark as 1.
  if(/^S6[0O]1?$/.test(token)||/^S6A1$/.test(token))return ['S6A',token];
  const corrected=token.replace(/I/g,'1').replace(/O/g,'0');
  if(/^[A-Z]{1,4}\d[A-Z0-9]{0,3}[1I]$/.test(token))return [...new Set([token.slice(0,-1),token,corrected])];
  const isPlausibleSetCode=/^[A-Z]{1,3}\d{1,3}[A-Z]{1,2}$/.test(corrected);
  return [...new Set([token,...(isPlausibleSetCode?[corrected]:[])])];
}

function isPokemonSetCodeCandidate(value:string){
  return value==='PAL'||/^(?:MATS|MATK|MATL|MATH|MAAF|MAAL)$/.test(value)||/^(?:[A-Z]{2,5}\d[A-Z0-9]{0,3}|[A-Z]\d[A-Z]{1,3})$/.test(value);
}

export function parsePokemonScanCode(text:string):PokemonScanCode|null{
  const normalized=text.toUpperCase().replace(/[—–−]/g,'-');
  const words=normalized.match(/[A-Z0-9]+/g)??[];
  const raritySuffix='(?:SAR|SIR|SSR|RRR|RR|UR|HR|SR|AR|IR|ACE|U|R|C)';
  const numberBoundary=`(?=$|[^A-Z0-9]|${raritySuffix}(?![A-Z0-9]))`;
  const joinedTacticsNumber=normalized.match(new RegExp(`(?:^|[^A-Z0-9])(?:MATS|MATK|MATL|MATH|MAAF|MAAL)\\s*(\\d{1,4})\\s*[/|I!：:]\\s*(\\d{1,4})${numberBoundary}`));
  const joinedSetNumber=normalized.match(new RegExp(`(?:^|[^A-Z0-9])([A-Z]{1,5}[0-9ILOQDG]{1,2}[A-Z])(\\d{1,4})\\s*[/|I!：:]\\s*(\\d{1,4})${numberBoundary}`));
  // PaddleOCR often reads the slash as I or l, and may attach the card's
  // suffix (ex/V/VMAX) to the numerator. Only accept a slash-like separator
  // when both sides are numeric; don't let the E in “EX” become the number.
  const printedNumber=normalized.match(new RegExp(`(?:^|[^A-Z0-9])(\\d{1,4})\\s*[/|I!：:]\\s*(\\d{1,4})${numberBoundary}`));
  const partialPrintedNumber=normalized.match(new RegExp(`(?:^|[^A-Z0-9])(\\d{1,4})\\s*[/|I!：:]\\s*[0-9OQDGIl]{1,4}${numberBoundary}`));
  const preliminarySets=[...new Set([...words.flatMap(pokemonSetCandidates),...(joinedSetNumber?pokemonSetCandidates(joinedSetNumber[1]!):[])]
    .filter(isPokemonSetCodeCandidate))];
  // Some cards and photos expose only “set number” (for example S6A 073),
  // without the denominator. Accept that form when a set token is present.
  const standaloneNumbers=[...normalized.matchAll(/(?:^|[^A-Z0-9])(\d{1,4})(?=$|[^A-Z0-9])/g)];
  // If the denominator was cut off by the frame, use a standalone number
  // following a recognized set token. This also avoids reading the “E” in
  // EX as a slash when the card number itself is missing.
  const partialNumber=partialPrintedNumber??(preliminarySets.length?standaloneNumbers.at(-1):undefined);
  const number=joinedTacticsNumber?{1:joinedTacticsNumber[1]!,2:joinedTacticsNumber[2]!}:printedNumber??(joinedSetNumber?{1:joinedSetNumber[2]!,2:joinedSetNumber[3]!}:partialNumber?{1:partialNumber[1]!,2:''}:null);
  if(!number)return null;
  const numberPrefix=new RegExp(`^[A-Z]{1,2}0*${number[1]}$`);
  const setCandidatesFromWords=[...words.flatMap(word=>{
    const candidates=pokemonSetCandidates(word);
    // OCR may join a short Japanese set code and collector number, e.g.
    // “SV11W169/086”. Split the number back off before matching the set.
    const compact=word.toUpperCase().replace(/[^A-Z0-9]/g,'');
    const joinedSet=compact.endsWith(number[1])?compact.slice(0,-number[1].length):'';
    if(isPokemonSetCodeCandidate(joinedSet))candidates.push(joinedSet);
    return candidates;
  }),...(joinedSetNumber?pokemonSetCandidates(joinedSetNumber[1]!):[])];
  const setCodeCandidates=[...new Set(setCandidatesFromWords.filter(word=>isPokemonSetCodeCandidate(word)&&!numberPrefix.test(word)))];
  const rarity=[...words].reverse().find(word=>['SAR','SIR','SSR','UR','HR','RRR','RR','SR','AR','IR','ACE','U','R','C'].includes(word))
    ??normalized.match(new RegExp(`\\d{1,4}\\s*[/|I!：:]\\s*\\d{1,4}(${raritySuffix})(?![A-Z0-9])`))?.[1]
    ??'';
  return {setCodeCandidates,cardNumber:number[1],cardNumberTotal:joinedTacticsNumber?.[2]??printedNumber?.[2]??joinedSetNumber?.[3]??'',rarity,language:detectPokemonScanLanguage(text)};
}

export function parseOnePieceScanCode(text:string):OnePieceScanCode|null{
  const normalized=text.toUpperCase().replace(/[—–−]/g,'-');
  const match=normalized.match(/(?:^|[^A-Z0-9])(?:(SP|5P|E2)\s*[\/|:]?\s*)?(OP|ST|EB|PRB|P|DON)\s*-?\s*(\d{0,2})\s*-?\s*(\d{3})/);
  if(!match)return null;
  const [,rawMarker,prefix,series,number]=match;
  const codeText=match[0].match(/(?:OP|ST|EB|PRB|P|DON)\s*-?\s*\d{0,2}\s*-?\s*\d{3}/i)?.[0]??'';
  const codeIndex=(match.index??0)+match[0].indexOf(codeText);
  const markerAfter=normalized.slice(codeIndex+codeText.length,codeIndex+codeText.length+12);
  const suffixRarity=markerAfter.match(/^\s*(SEC|SR|UC|R|C|L|SP|TR|P|DON)(?=$|[^A-Z0-9])/i)?.[1]?.toUpperCase()??'';
  const variant=rawMarker?'SP':'';
  return {setCode:`${prefix}${series}`,cardNumber:`${prefix}${series}-${number}`,rarity:suffixRarity||(variant?'SP':''),variant};
}
