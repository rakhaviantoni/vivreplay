'use client';

const ruleWindows=new Set(['rush','blocker','when-attacking','on-play','on-k-o','on-your-opponent-s-attack','activate-main','main','once-per-turn','trigger','your-turn','opponent-s-turn','end-of-your-turn','counter','don']);

function effectWindow(value:string) {
  if (/^don!!\s*x\s*\d+/i.test(value)) return 'don';
  const normalized=value.toLowerCase().replace(/[^a-z]+/g,'-').replace(/^-|-$/g,'');
  return normalized.startsWith('rush-') ? 'rush' : normalized;
}

function startsRuleLine(previous:string) { return /[.)]\s*(?:\*+)?\s*$/.test(previous); }

function staysInModifierChain(previous:string, keyword:string) {
  if (keyword!=='once-per-turn'||!/^\[[^\]]+\]$/.test(previous)) return false;
  return ['activate-main','main','don','on-play','when-attacking','on-k-o','on-your-opponent-s-attack','your-turn','opponent-s-turn','end-of-your-turn'].includes(effectWindow(previous.slice(1,-1)));
}

export function EffectText({text}:{text:string}) {
  const parts=text.split(/(\[[^\]]+\]|\([^)]*\))/g);
  return <>{parts.map((part,index)=>{
    const prior=parts[index-1]??'';
    if (index>0&&/^\[[^\]]+\]$/.test(prior)&&ruleWindows.has(effectWindow(prior.slice(1,-1)))&&!/^\[[^\]]+\]$|^\([^)]*\)$/.test(part)) return null;
    if (/^\[[^\]]+\]$/.test(part)) {
      const keyword=effectWindow(part.slice(1,-1));
      if (!ruleWindows.has(keyword)) return <span key={index} className="effect-reference">{part}</span>;
      const previous=parts.slice(0,index).reverse().find(value=>value.trim().length>0)??'';
      const beginsRuleLine=!staysInModifierChain(previous,keyword)&&startsRuleLine(previous);
      const instruction=parts[index+1]&&!/^\[[^\]]+\]$|^\([^)]*\)$/.test(parts[index+1])?parts[index+1].replace(/^\s+/, ' '):'';
      const colon=instruction.indexOf(':');
      return <span key={index} className="effect-rule-line">{beginsRuleLine&&<br/>}<span className="effect-rule-intro"><span className={`effect-keyword effect-keyword-${keyword}`}>{part.slice(1,-1).replace(/^\*+|\*+$/g,'')}</span>{colon>=0?<strong className="effect-clause">{instruction.slice(0,colon+1)}</strong>:instruction}</span>{colon>=0&&instruction.slice(colon+1)}</span>;
    }
    if (/^\([^)]*\)$/.test(part)) return <span key={index}>{/\.\s*$/.test(parts[index-1]??'')&&<br/>}<em className="effect-reminder">{part}</em></span>;
    if (/^\[[^\]]+\]$/.test(parts[index-1]??'') && ruleWindows.has(effectWindow((parts[index-1]??'').slice(1,-1)))) {
      const instruction=part.replace(/^\s+/, ' ');
      const colon=instruction.indexOf(':');
      if (colon>=0) return <span key={index}><strong className="effect-clause">{instruction.slice(0,colon+1)}</strong>{instruction.slice(colon+1)}</span>;
      return <span key={index}>{instruction}</span>;
    }
    return part;
  })}</>;
}
