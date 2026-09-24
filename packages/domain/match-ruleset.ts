export type Ruleset={id:string;code:string;rulesRevision:string;effectiveFrom:string;effectiveTo?:string|null;status:'draft'|'published'|'retired';rules:Record<string,unknown>};
export type MatchSnapshot={rulesetId:string;playerDeck:string[];opponentDeck:string[];state:Record<string,unknown>};

export function rulesetForDate(rulesets:Ruleset[],date:string){
 return rulesets.filter(ruleset=>ruleset.status==='published'&&ruleset.effectiveFrom<=date&&(!ruleset.effectiveTo||ruleset.effectiveTo>=date)).sort((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
}

export function createMatchSnapshot(ruleset:Ruleset,playerDeck:string[],opponentDeck:string[]):MatchSnapshot{
 return {rulesetId:ruleset.id,playerDeck:[...playerDeck],opponentDeck:[...opponentDeck],state:{rulesetCode:ruleset.code,rulesRevision:ruleset.rulesRevision}};
}
