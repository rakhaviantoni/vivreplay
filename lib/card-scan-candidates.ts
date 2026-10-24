export type ScanCandidateKey={game:string;setCode:string;cardNumber:string;language:string;variant:string};

function normalize(value:string){
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
}

export function deduplicateScanCandidates<T extends ScanCandidateKey>(candidates:T[]):T[]{
  const seen=new Set<string>();
  return candidates.filter(candidate=>{
    const key=[candidate.game,candidate.setCode,candidate.cardNumber,candidate.language,candidate.variant].map(normalize).join(':');
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  });
}
