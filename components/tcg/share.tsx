'use client';

import LocalizedAnchor from '@/components/ui/localized-link';
import {useRouteLocale} from '@/components/locale-provider';
import {useEffect, useMemo, useState} from 'react';
import {
  CopyIcon as Copy,
  CheckIcon as Check,
  WhatsappLogoIcon as WhatsappLogo,
  XLogoIcon as XLogo,
  TelegramLogoIcon as TelegramLogo,
  DownloadSimpleIcon as DownloadSimple,
  MoonIcon as Moon,
  SunIcon as Sun,
} from '@phosphor-icons/react';
import {ShareRouteIcon, VivreMark} from './brand-assets';
import {toast} from 'sonner';
import {Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader} from '@/components/ui/dialog';
import {cardImageUrl} from './card-art';
import type {Card} from '@/packages/card-data/catalog';
import {energyAssetFromName} from './pokemon-card-text';
import {pokemonPrintingRarity} from '@/lib/pokemon-rarity';

export type ShareCardItem = {
  card: Card;
  printingId?: string;
  quantity?: number;
  condition?: string;
  unitAmount?: number;
  metaLine?: string;
  productType?: 'RAW'|'GRADED';
  gradingCompany?: string;
  grade?: string;
  certification?: string;
  subgrades?: Record<string,string|number>;
  slabLabel?: {setCode?:string;language?:string;number?:string;rarity?:string;labelStyle?:string};
};

export type ShareVaultSetProgress={name:string;ownedCount:number;totalCards:number;percentage:number;mainSetOwned:number;mainSetTotal:number;parallelsOwned:number;parallelsTotal:number};

type ShareSetYear={code:string;releaseYear:number};
const shareSetYearCache=new Map<string,Promise<Map<string,number>>>();
const normalizeShareSetCode=(value:string)=>value.toUpperCase().replace(/[-_\s]/g,'');

async function shareSetYear(game:'one-piece'|'pokemon',language:string,setCode:string){
  if(!setCode)return undefined;
  const locale=language==='ID'?'ID':language==='JP'||language==='JA'?'JP':'EN';
  const key=`${game}:${locale}`;
  let years=shareSetYearCache.get(key);
  if(!years){
    years=fetch(`/api/cards/sets?game=${game}&language=${locale}`,{cache:'force-cache'}).then(async response=>{
      if(!response.ok)return new Map<string,number>();
      const payload=await response.json() as {sets?:ShareSetYear[]};
      return new Map((payload.sets??[]).filter(set=>set.code&&Number(set.releaseYear)>0).map(set=>[normalizeShareSetCode(set.code),Number(set.releaseYear)]));
    }).catch(()=>new Map<string,number>());
    shareSetYearCache.set(key,years);
  }
  return (await years).get(normalizeShareSetCode(setCode));
}

export type ShareCardDetails = {
  gameLabel?: string;
  language?: string;
  setName?: string;
  setCode?: string;
  number?: string;
  rarity?: string;
  regulation?: string;
  illustrator?: string;
  facts?: Array<{label:string;value:string;energyTypes?:string[]}>
  sections?: Array<{title:string;text:string;badge?:string;damage?:string;energyTypes?:string[]}>
  evolutionCode?: string;
  evolvesFrom?: string;
  vitals?: {hp?:string|number;types?:string[]};
};

function drawPokemonRuleText(ctx:CanvasRenderingContext2D,value:string,x:number,y:number,maxWidth:number,lineHeight:number,maxLines:number,energyImages:Map<string,HTMLImageElement|null>) {
  const clean=value.replace(/<span\b[^>]*class=["'][^"']*energy-symbol[^"']*["'][^>]*>([\s\S]*?)<\/span\s*>/gi,(match,inner:string)=>{const classes=/class=["']([^"']+)["']/i.exec(match)?.[1]??'';const type=classes.split(/\s+/).find(energyAssetFromName)??inner.replace(/<[^>]*>/g,'').trim();return type?`{${type}}`:'';}).replace(/!??\[([^\]]*)\]\((https?:\/\/[^)]+)\)/gi,(_match,label:string,url:string)=>{const type=url.split(/[/?#]/).filter(Boolean).at(-1)?.replace(/\.[a-z\d]+$/i,'')??'';const count=Math.min(10,Math.max(1,label.match(/image/gi)?.length??1));return energyAssetFromName(type)?Array.from({length:count},()=>`{${type}}`).join(''):label;}).replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/\[([^\]]+)\]/g,'$1').replace(/\*\*|__|\*/g,'').replace(/\s+/g,' ').trim();
  const tokens=clean.split(/(\{[^}]+\}|(?:Colorless|Normal|Grass|Fire|Water|Lightning|Electric|Psychic|Fighting|Darkness|Dark|Metal|Steel|Dragon|Fairy|Daun|Api|Air|Listrik|Psikis|Petarung|Kegelapan|Logam|Naga|Peri)\s+Energy)/gi).filter(Boolean);
  let cursorX=x, cursorY=y, lines=1;
  for(const token of tokens){
    const raw=token.startsWith('{')&&token.endsWith('}')?token.slice(1,-1):token;
    const asset=energyAssetFromName(raw.replace(/\s+Energy$/i,''));
    if(asset){
      const icon=energyImages.get(asset);
      const size=15;
      if(cursorX+size> x+maxWidth){ if(lines>=maxLines)return cursorY+lineHeight; cursorX=x;cursorY+=lineHeight;lines++; }
      if(icon)ctx.drawImage(icon,cursorX,cursorY-size+3,size,size);
      cursorX+=size+2;
      continue;
    }
    const chunks=token.split(/(\n)/);
    for(const chunk of chunks){
      if(chunk==='\n'){if(lines>=maxLines)return cursorY+lineHeight;cursorX=x;cursorY+=lineHeight;lines++;continue;}
      const words=chunk.split(/(\s+)/);
      for(const word of words){
        const width=ctx.measureText(word).width;
        if(cursorX>x&&cursorX+width>x+maxWidth){if(lines>=maxLines)return cursorY+lineHeight;cursorX=x;cursorY+=lineHeight;lines++;}
        ctx.fillText(word,cursorX,cursorY,maxWidth);
        cursorX+=width;
      }
    }
  }
  return cursorY+lineHeight;
}

function drawOnePieceRuleText(ctx:CanvasRenderingContext2D,value:string,x:number,y:number,maxWidth:number,lineHeight:number,maxLines:number,palette:{panel:string;line:string;accent:string;ink:string;muted:string}){
  const ruleWindows=new Set(['rush','blocker','banish','double-attack','when-attacking','on-play','on-k-o','on-your-opponent-s-attack','activate-main','main','once-per-turn','trigger','your-turn','opponent-s-turn','end-of-your-turn','counter','don']);
  const startX=x,parts=value.split(/(\[[^\]]+\]|\([^)]*\))/g);let cursor=y,lines=0;
  for(let index=0;index<parts.length;index++){
    const part=parts[index]??'';
    const bracket=/^\[([^\]]+)\]$/.exec(part);
    if(bracket){
      const keyword=bracket[1].toLowerCase().replace(/[^a-z]+/g,'-').replace(/^-|-$/g,'');
      if(!ruleWindows.has(keyword)){ctx.font='500 13px "Manrope", sans-serif';ctx.fillStyle=palette.accent;const end=drawWrappedText(ctx,part,x,cursor,maxWidth-(x-startX),lineHeight,maxLines-lines);lines+=Math.max(1,Math.ceil((end-cursor)/lineHeight));cursor=end;x=startX;continue;}
      const label=bracket[1].replace(/^\*+|\*+$/g,'');ctx.font='800 12px "Plus Jakarta Sans", sans-serif';
      const width=ctx.measureText(label).width+16;
      if(lines>=maxLines)break;
      ctx.fillStyle=palette.panel;drawRoundedRect(ctx,x,cursor-14,width,20,5);ctx.fill();ctx.strokeStyle=palette.line;ctx.lineWidth=1;drawRoundedRect(ctx,x,cursor-14,width,20,5);ctx.stroke();
      ctx.fillStyle=palette.accent;ctx.fillText(label,x+8,cursor);x+=width+7;continue;
    }
    if(/^\([^)]*\)$/.test(part)){ctx.font='italic 500 12px "Manrope", sans-serif';ctx.fillStyle=palette.muted;}
    else {ctx.font='500 13px "Manrope", sans-serif';ctx.fillStyle=palette.ink;}
    if(part.trim()){
      const end=drawWrappedText(ctx,part.trim(),x,cursor,maxWidth-(x-startX),lineHeight,maxLines-lines);
      lines+=Math.max(1,Math.ceil((end-cursor)/lineHeight));cursor=end;x=startX;
    }
  }
  return cursor;
}

function drawPokemonMechanicTitle(ctx:CanvasRenderingContext2D,value:string,x:number,y:number,maxWidth:number,fontSize:number,ink:string){
  const tokens=value.split(/(\b(?:V-UNION|VSTAR|VMAX|GX|EX|V|ex)\b)/gi).filter(Boolean);let cursorX=x,cursorY=y;
  for(const token of tokens){
    const mechanic=/^(?:V-UNION|VSTAR|VMAX|GX|EX|V|ex)$/i.test(token);
    ctx.font=mechanic?`900 ${fontSize}px Georgia, "Times New Roman", serif`:`800 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle=mechanic&&/^EX$/i.test(token)?'#393b3b':ink;
    const width=ctx.measureText(token).width;
    if(cursorX>x&&cursorX+width>x+maxWidth){cursorX=x;cursorY+=fontSize+8;}
    ctx.fillText(token,cursorX,cursorY,maxWidth);
    cursorX+=width;
  }
  return cursorY+fontSize+8;
}

export type ShareButtonProps = {
  title: string;
  path: string;
  privateEntity?: boolean;
  cards?: ShareCardItem[];
  card?: Card;
  subtitle?: string;
  price?: string;
  listingInfo?: {seller?:string;city?:string;expiresAt?:string;timeZone?:string};
  className?: string;
  openOnMount?: boolean;
  hideTrigger?: boolean;
  onOpenChange?: (open: boolean) => void;
  entityType?: 'listing' | 'card';
  cardDetails?: ShareCardDetails;
};

function shareExpiry(value:string,language:'EN'|'ID',preferredTimeZone?:string){
  const timestamp=new Date(value.includes('T')?value:`${value.replace(' ','T')}Z`);
  if(!Number.isFinite(timestamp.getTime()))return '';
  const locale=language==='ID'?'id-ID':'en-US';
  const timeZone=preferredTimeZone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
  const dateTime=new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',timeZone}).format(timestamp);
  const offset=new Intl.DateTimeFormat('en-US',{timeZone,timeZoneName:'longOffset'}).formatToParts(timestamp).find(part=>part.type==='timeZoneName')?.value.replace(/^GMT/,'UTC')??'UTC';
  return `${language==='ID'?'Berakhir':'Expires'} ${dateTime} ${offset}`;
}

function fitCanvasText(ctx:CanvasRenderingContext2D,value:string,maxWidth:number){
  let text=value;
  while(text.length>4&&ctx.measureText(text).width>maxWidth)text=`${text.slice(0,-4)}…`;
  return text;
}

function filenamePart(value:string){
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'');
}

function drawWrappedText(ctx:CanvasRenderingContext2D,value:string,x:number,y:number,maxWidth:number,lineHeight:number,maxLines=8){
  let line='';
  let lines=0;
  for(const word of value.replace(/\s+/g,' ').trim().split(' ')){
    const next=line?`${line} ${word}`:word;
    if(line&&ctx.measureText(next).width>maxWidth){
      ctx.fillText(line,x,y+lines*lineHeight,maxWidth);
      lines++;
      if(lines>=maxLines)return y+lines*lineHeight;
      line=word;
    }else line=next;
  }
  if(line&&lines<maxLines){ctx.fillText(line,x,y+lines*lineHeight,maxWidth);lines++;}
  return y+lines*lineHeight;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
  }
  ctx.closePath();
}

function drawVaultSlabLabel(ctx:CanvasRenderingContext2D,item:ShareCardItem,gameSlug:'one-piece'|'pokemon'|undefined,x:number,y:number,width:number,height:number,setYear?:number){
  const card=item.card as Card&{gameSlug?:string};
  const game=card.gameSlug??(/^PK-/i.test(card.code)?'pokemon':gameSlug??'one-piece');
  const language=String(item.slabLabel?.language??card.language??'').toUpperCase().replace('JA','JP');
  const setCode=String(item.slabLabel?.setCode??card.setCode??'').toUpperCase();
  const number=String(item.slabLabel?.number??card.printingCode??card.code??'').match(/(\d+[A-Z]?)$/i)?.[1]??'';
  const rawRarity=String(item.slabLabel?.rarity??card.rarity??'').trim();
  const resolvedRarity=game==='pokemon'?pokemonPrintingRarity(rawRarity,language,setCode,card.printingCode??card.code):rawRarity;
  const rarityKey=resolvedRarity.toLowerCase().replace(/[^a-z]/g,'');
  const pokemonRarities:Record<string,string>={c:'COMMON',u:'UNCOMMON',r:'RARE',rr:'DOUBLE RARE',rrr:'TRIPLE RARE',ur:'ULTRA RARE',hr:'HYPER RARE',ace:'ACE SPEC RARE',ssr:'SHINY ULTRA RARE',sar:'SPECIAL ART RARE',sir:'SPECIAL ART RARE',ar:'ART RARE',ir:'ART RARE',promo:'PROMO'};
  const rarity=game==='pokemon'?(pokemonRarities[rarityKey]??resolvedRarity.toUpperCase()):rarityKey==='sr'?'SPECIAL ART RARE':resolvedRarity.toUpperCase();
  const rawGrade=String(item.grade??'10').trim().toUpperCase();
  const gradeScore=rawGrade.match(/(\d{1,2}(?:\.\d)?)$/)?.[1]??rawGrade;
  const gradeInput=rawGrade.replace(/\s*\d{1,2}(?:\.\d)?$/,'').trim();
  const gradeNames:Record<string,string>={'10':'GEM MT','9.5':'MINT','9':'MINT','8.5':'NM-MT','8':'NM-MT','7':'NM','6':'EX-MT','5':'EX','4':'VG-EX','3':'VG','2':'GOOD','1':'PR'};
  const gradeLabel=gradeInput==='GEM MINT'?'GEM MT':gradeInput||gradeNames[gradeScore]||'GRADE';
  const certificate=String(item.certification??'');
  const grader=String(item.gradingCompany??'PSA').toUpperCase().replace(/[^A-Z]/g,'');
  const psa=grader==='PSA';
  const cgc=grader==='CGC'||grader==='CGCCARDS'||grader==='CERTIFIEDGUARANTYCOMPANY';
  const bgs=grader==='BGS'||grader==='BECKETT'||grader==='BECKETTGRADINGSERVICES';
  const tag=grader==='TAG'||grader==='TAGGRADING';
  const egs=grader==='EGS'||grader.includes('EMPORIUMGRADINGSERVICE');
  const ars=grader==='ARS'||grader.startsWith('ARS');
  const pristine=/\bPRISTINE\b/i.test(rawGrade)||(bgs&&gradeScore==='10');
  const blackLabel=bgs&&gradeScore==='10'&&Object.entries(item.subgrades??{}).filter(([key])=>/centering|corners|edges|surface/i.test(key)).length===4&&Object.entries(item.subgrades??{}).filter(([key])=>/centering|corners|edges|surface/i.test(key)).every(([,value])=>Number(value)===10);
  const clearEgs=egs&&item.slabLabel?.labelStyle==='clear';
  const inset=Math.max(3,width*.012);
  const left=x+inset+2,right=x+width-inset-2;
  const split=x+width*.69;
  const baseY=y+height;
  const small=Math.max(6,Math.min(10,width*.022));
  const write=(value:string,tx:number,ty:number,maxWidth:number,align:CanvasTextAlign='left',fontWeight=800,color='#1b2025')=>{
    if(!value)return;
    ctx.textAlign=align;ctx.fillStyle=color;ctx.font=`${fontWeight} ${small}px Arial,sans-serif`;
    ctx.fillText(fitCanvasText(ctx,value,maxWidth),tx,ty,maxWidth);
  };
  const line=(x1:number,y1:number,x2:number,y2:number,color:string,thickness=1)=>{ctx.strokeStyle=color;ctx.lineWidth=thickness;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();};
  const releaseYear=(card as Card&{releaseYear?:number}).releaseYear??setYear;
  const slabYearText=releaseYear?String(releaseYear):'';
  const gameText=game==='pokemon'?'POKÉMON':'ONE PIECE';
  const topLine=[slabYearText,gameText,setCode,language].filter(Boolean).join(' ');
  const name=card.name.toUpperCase();
  const numberText=number?`#${number}`:'';
  let seed=2166136261;for(const char of certificate||'UNVERIFIED')seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;
  ctx.save();
  ctx.textBaseline='alphabetic';

  if(psa){
    ctx.fillStyle='#fbfcff';ctx.fillRect(x,y,width,height);
    ctx.strokeStyle='#ed1c2e';ctx.lineWidth=Math.max(3,width*.012);ctx.strokeRect(x+1,y+1,width-2,height-2);
    ctx.save();ctx.beginPath();ctx.rect(x+3,y+3,width-6,height-6);ctx.clip();ctx.strokeStyle='#e8eef7';ctx.lineWidth=1;
    for(let yy=y+4;yy<baseY;yy+=4)line(x+3,yy,x+width-3,yy,'#e8eef7',.7);ctx.restore();
    write(topLine,left,y+small+2,split-left-5);write(numberText,right,y+small+2,right-split-3,'right');
    write(name,left,y+small*2+4,split-left-5);write(gradeLabel,right,y+small*2+4,right-split-3,'right');
    write(rarity,left,y+small*3+5,split-left-5);write(gradeScore,right,y+small*3+5,right-split-3,'right');
    let bx=left;const barcodeW=Math.min(width*.34,Math.max(20,split-left-6));
    while(bx<left+barcodeW){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const bar=Math.min(1+seed%3,left+barcodeW-bx);ctx.fillStyle='#17202b';ctx.fillRect(bx,baseY-9,bar,5);bx+=bar+1+(seed>>>8)%2;}
    write(certificate,right,baseY-3,right-split-3,'right',800,'#17202b');
    const stampW=Math.min(31,width*.12),stampH=14,sx=x+(width-stampW)/2,sy=baseY-stampH/2;
    ctx.fillStyle='#d8dee5';ctx.fillRect(sx,sy,stampW,stampH);ctx.strokeStyle='#53677f';ctx.lineWidth=.8;ctx.strokeRect(sx,sy,stampW,stampH);
    ctx.textAlign='center';ctx.font=`italic 900 ${Math.max(8,small*1.05)}px Arial,sans-serif`;ctx.fillStyle='#064e9a';ctx.fillText('P',sx+stampW*.33,sy+stampH*.72);ctx.fillStyle='#e52d41';ctx.fillText('S',sx+stampW*.5,sy+stampH*.72);ctx.fillStyle='#064e9a';ctx.fillText('A',sx+stampW*.67,sy+stampH*.72);
  }else if(cgc){
    ctx.fillStyle='#111315';ctx.fillRect(x,y,width,height);ctx.fillStyle='#17191c';ctx.fillRect(x+2,y+2,width-4,height*.25);
    ctx.fillStyle='#fbfbfb';ctx.fillRect(x+2,y+height*.25,width-4,height*.75-2);
    ctx.fillStyle='#647a9a';ctx.fillRect(x+2,y+2,width*.13,height*.25);ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font=`italic 900 ${small*1.3}px Arial,sans-serif`;ctx.fillText('CGC',x+width*.075,y+height*.2);
    write('CERTIFIED GUARANTY COMPANY',x+width-5,y+height*.18,width*.72,'right',850,'#fff');
    write(name,left,y+height*.42,split-left-5);write(`${gameText}${releaseYear?` (${releaseYear})`:''} ${language||'EN'}`,left,y+height*.59,split-left-5, 'left',750,'#202226');
    write(`${setCode} ${numberText}`,left,y+height*.75,split-left-5,'left',750,'#202226');write(rarity,left,y+height*.91,split-left-5,'left',750,'#202226');
    line(split,y+height*.34,split,baseY-3,'#24282c',1);
    const cgcLabel=pristine?'PRISTINE':gradeLabel;write(cgcLabel,right-3,y+height*.51,right-split-6,'right',900,pristine?'#b68a19':'#191b1e');
    ctx.textAlign='right';ctx.fillStyle=pristine?'#b68a19':'#17191c';ctx.font=`900 ${Math.max(18,small*3.1)}px Arial,sans-serif`;ctx.fillText(gradeScore,right-3,baseY-4);
    let bx=left;while(bx<split-width*.13){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const bar=Math.min(1+seed%3,split-width*.13-bx);ctx.fillStyle='#17191c';ctx.fillRect(bx,baseY-9,bar,5);bx+=bar+1;}
    write(certificate,split-width*.12,baseY-3,width*.12,'left',750,'#17191c');
  }else if(bgs){
    const gold=pristine;ctx.fillStyle=blackLabel?'#101114':gold?'#e5cc71':'#e9ebee';ctx.fillRect(x,y,width,height);
    if(!blackLabel){ctx.fillStyle='#111214';ctx.fillRect(x,y,width*.19,height);}
    const brandWidth=width*.19;ctx.fillStyle=blackLabel?'#fff':gold?'#0f1114':'#fff';ctx.textAlign='center';ctx.font=`900 ${small*2.1}px Georgia,serif`;ctx.fillText('B',x+brandWidth*.5,y+height*.61);
    ctx.font=`800 ${Math.max(4,small*.54)}px Arial,sans-serif`;ctx.fillText('BECKETT',x+brandWidth*.5,y+height*.82);
    const detailLeft=x+brandWidth+3;write(topLine,detailLeft,y+small+1,split-detailLeft-3,'left',800,blackLabel?'#fff':'#111');
    write(name,detailLeft,y+small*2+3,split-detailLeft-3,'left',850,blackLabel?'#fff':'#111');
    write(`${rarity} ${numberText}`.trim(),detailLeft,y+small*3+4,split-detailLeft-3,'left',750,blackLabel?'#fff':'#111');
    const rightW=right-split;ctx.fillStyle=blackLabel?'#101114':gold?'#e5cc71':'#e9ebee';ctx.fillRect(split,y,rightW,height);
    ctx.textAlign='center';ctx.fillStyle=blackLabel?'#fff':'#111';ctx.font=`900 ${Math.max(16,small*2.8)}px Arial,sans-serif`;ctx.fillText(gradeScore,split+rightW/2,y+height*.63);
    ctx.font=`850 ${Math.max(6,small*.75)}px Arial,sans-serif`;ctx.fillText(blackLabel?'BLACK LABEL':gold?'PRISTINE':gradeLabel,split+rightW/2,y+height*.82);
    ctx.font=`700 ${Math.max(5,small*.68)}px Arial,sans-serif`;ctx.fillText(certificate,split+rightW/2,baseY-2);
  }else if(tag){
    ctx.fillStyle='rgba(66,76,83,.32)';ctx.fillRect(x,y,width,height);ctx.strokeStyle='rgba(255,255,255,.94)';ctx.lineWidth=Math.max(1,width*.0035);ctx.strokeRect(x+3,y+height*.14,width-6,height*.82);
    ctx.fillStyle='rgba(255,255,255,.13)';ctx.fillRect(x+width*.42,y+1,width*.16,small+5);ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.strokeRect(x+width*.42,y+1,width*.16,small+5);
    ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font=`900 ${small*1.15}px Georgia,serif`;ctx.fillText('TAG',x+width*.5,y+small+1);
    const infoEnd=x+width*.57;write(name,left,y+height*.38,infoEnd-left-4,'left',850,'#fff');write(`${releaseYear?`${releaseYear} `:''}${gameText} ${language}`.trim(),left,y+height*.54,infoEnd-left-4,'left',750,'#fff');
    write(`${rarity} ${numberText}`.trim(),left,y+height*.7,infoEnd-left-4,'left',800,'#fff');
    ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font=`700 ${small*.66}px Arial,sans-serif`;
    for(let row=0;row<11;row++)for(let col=0;col<11;col++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;if((seed>>>29)!==0)ctx.fillRect(x+width*.61+col*small*.42,y+height*.33+row*small*.42,small*.25,small*.25);}
    ctx.textAlign='center';ctx.font=`900 ${small*2.1}px Arial,sans-serif`;ctx.fillText(gradeScore,x+width*.87,y+height*.62);ctx.font=`850 ${Math.max(5,small*.68)}px Arial,sans-serif`;ctx.fillText(pristine?'PRISTINE':gradeLabel,x+width*.87,y+height*.78);
    ctx.save();ctx.translate(x+width*.75,baseY-5);ctx.rotate(-Math.PI/2);ctx.font=`800 ${Math.max(4,small*.58)}px Arial,sans-serif`;ctx.fillText(certificate,0,0);ctx.restore();
  }else if(egs){
    ctx.fillStyle=clearEgs?'rgba(7,10,13,.94)':'#121315';ctx.fillRect(x,y,width,height);const ink=clearEgs?'#fff':'#f3f3f3';
    if(clearEgs){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.strokeRect(x+3,y+3,width-6,height-6);line(x+width*.22,y+height*.12,x+width*.22,y+height*.84,'#fff',1.5);line(x+width*.78,y+height*.12,x+width*.78,y+height*.84,'#fff',1.5);}
    else {ctx.fillStyle=pristine?'#d7bf56':'#161719';ctx.fillRect(x+width*.24,y+3,width*.5,height-6);}
    if(!clearEgs){ctx.fillStyle='#f8f8f8';ctx.fillRect(x+3,y+3,width*.18,height-6);ctx.fillStyle='#161719';ctx.textAlign='center';ctx.font=`900 ${small*1.25}px Arial,sans-serif`;ctx.fillText('♛',x+width*.09,y+height*.38);ctx.font=`900 ${small*1.25}px Arial,sans-serif`;ctx.fillText('EGS',x+width*.09,y+height*.64);write(certificate,x+width*.09,baseY-4,width*.16,'center',750,'#111');}
    const infoLeft=x+width*.25;const infoRight=clearEgs?x+width*.75:x+width*.74;
    if(clearEgs){
      const center=(infoLeft+infoRight)/2;
      ctx.textAlign='center';ctx.fillStyle=ink;
      ctx.font=`800 ${Math.max(6,small*.82)}px Arial,sans-serif`;ctx.fillText(fitCanvasText(ctx,topLine,infoRight-infoLeft),center,y+height*.27);
      ctx.font=`900 ${Math.max(10,small*1.28)}px Arial,sans-serif`;ctx.fillText(fitCanvasText(ctx,name,infoRight-infoLeft),center,y+height*.57);
      ctx.font=`800 ${Math.max(7,small*.94)}px Arial,sans-serif`;ctx.fillText(fitCanvasText(ctx,`${rarity} - ${numberText}`.trim(),infoRight-infoLeft),center,y+height*.79);
      const qrSize=Math.min(height*.48,width*.12);const qrX=x+width*.11-qrSize/2;const qrY=y+height*.24;
      ctx.fillStyle='#07090b';ctx.fillRect(qrX,qrY,qrSize,qrSize);
      const module=Math.max(1,qrSize/13);ctx.fillStyle='#fff';
      for(let row=0;row<13;row++)for(let col=0;col<13;col++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const inFinder=(col<5&&row<5)||(col>7&&row<5)||(col<5&&row>7);if(!inFinder&&(seed>>>29)!==0)ctx.fillRect(qrX+col*module,qrY+row*module,module*.72,module*.72);}
      const finder=(fx:number,fy:number)=>{ctx.fillStyle='#fff';ctx.fillRect(qrX+fx*module,qrY+fy*module,module*5,module*5);ctx.fillStyle='#07090b';ctx.fillRect(qrX+(fx+1)*module,qrY+(fy+1)*module,module*3,module*3);ctx.fillStyle='#fff';ctx.fillRect(qrX+(fx+2)*module,qrY+(fy+2)*module,module,module);};
      finder(0,0);finder(8,0);finder(0,8);
      write(certificate,x+width*.11,y+height*.24+qrSize+small*.85,width*.2,'center',850,'#fff');
      ctx.textAlign='center';ctx.fillStyle=ink;ctx.font=`900 ${Math.max(19,small*3.1)}px Arial,sans-serif`;ctx.fillText(gradeScore,x+width*.88,y+height*.6);
      ctx.font=`850 ${Math.max(6,small*.76)}px Arial,sans-serif`;ctx.fillText(pristine?'PRISTINE':gradeLabel,x+width*.88,y+height*.76);
      ctx.font=`900 ${Math.max(7,small*1.15)}px Arial,sans-serif`;ctx.fillText('EGS',x+width*.5,baseY-2);
    }else{
      write(topLine,infoLeft,y+small+1,infoRight-infoLeft,'center',800,'#111');write(name,infoLeft,y+small*2+4,infoRight-infoLeft,'center',900,'#111');
      write(`${rarity} ${numberText}`.trim(),infoLeft,y+small*3+6,infoRight-infoLeft,'center',800,'#111');
      ctx.textAlign='center';ctx.fillStyle=pristine?'#8c7015':'#fff';ctx.font=`900 ${Math.max(16,small*2.7)}px Arial,sans-serif`;ctx.fillText(gradeScore,x+width*.88,y+height*.63);ctx.font=`850 ${Math.max(5,small*.7)}px Arial,sans-serif`;ctx.fillText(pristine?'PRISTINE':gradeLabel,x+width*.88,baseY-5);
    }
  }else if(ars){
    const plaqueY=y+height*.13;ctx.fillStyle='#d7c6a0';ctx.fillRect(x+2,plaqueY,width-4,height*.82);ctx.strokeStyle='#9a8564';ctx.lineWidth=1.2;ctx.strokeRect(x+4,plaqueY+2,width-8,height*.82-4);
    ctx.textAlign='center';ctx.fillStyle='#57462f';ctx.font=`900 ${small*1.05}px Georgia,serif`;ctx.fillText(card.name.toUpperCase(),x+width*.5,plaqueY+height*.27);
    ctx.font=`750 ${small*.78}px Arial,sans-serif`;ctx.fillText(`${gameText} ${setCode} ${releaseYear??''}`.trim(),x+width*.5,plaqueY+height*.45);
    ctx.font=`800 ${small*.85}px Arial,sans-serif`;ctx.fillText(`${rarity}  ${number}`.trim(),x+width*.5,plaqueY+height*.65);
  }else{
    ctx.fillStyle='#e6e7e8';ctx.fillRect(x,y,width,height);write(topLine,left,y+small+1,width*.7);write(name,left,y+small*2+4,width*.7);write(rarity,left,y+small*3+5,width*.7);
    ctx.textAlign='right';ctx.fillStyle='#181a1c';ctx.font=`900 ${Math.max(14,small*2.2)}px Arial,sans-serif`;ctx.fillText(gradeScore,right,baseY-3);
  }
  ctx.restore();ctx.textAlign='left';
}

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function shareCardImageUrls(card:Card,printingId?:string):string[]{
  void printingId;
  const urls:string[]=[];
  const resolved=cardImageUrl(card);
  if(resolved?.startsWith('/')&&!resolved.startsWith('//'))urls.push(resolved);
  return [...new Set(urls)];
}

function shareSlabPlateHeight(item:ShareCardItem){
  const grader=String(item.gradingCompany??'PSA').toUpperCase().replace(/[^A-Z]/g,'');
  if(grader==='TAG'||grader==='TAGGRADING')return 110;
  if(grader==='CGC'||grader==='CGCCARDS'||grader==='CERTIFIEDGUARANTYCOMPANY')return 90;
  if(grader==='EGS'||grader.includes('EMPORIUMGRADINGSERVICE'))return 92;
  if(grader==='ARS'||grader.startsWith('ARS'))return 90;
  if(grader==='BGS'||grader==='BECKETT'||grader==='BECKETTGRADINGSERVICES')return 86;
  return 84;
}

async function generateListingCompositeBlob({
  title,
  price,
  subtitle,
  cards,
  link,
  language = 'EN',
  style = 'light',
  entityType = 'listing',
  cardDetails,
  gameSlug,
  setProgress,
}: {
  title: string;
  price?: string;
  subtitle?: string;
  cards: ShareCardItem[];
  link: string;
  language?: 'EN' | 'ID';
  style?: 'light' | 'dark';
  entityType?: 'listing' | 'card' | 'vault';
  cardDetails?: ShareCardDetails;
  gameSlug?: 'one-piece'|'pokemon'|'all';
  setProgress?: ShareVaultSetProgress;
}): Promise<Blob | null> {
  const canvasWidth = 1200;
  const paddingX = 54;
  const count = cards.length;

  let cols = 1;
  let cardWidth = 320;
  if (count === 2) {
    cols = 2;
    cardWidth = 270;
  } else if (count === 3) {
    cols = 3;
    cardWidth = 230;
  } else if (count === 4) {
    cols = 4;
    cardWidth = 210;
  } else if (count >= 5 && count <= 8) {
    cols = 4;
    cardWidth = 200;
  } else if (count >= 9) {
    cols = 5;
    cardWidth = 175;
  }
  if(entityType==='vault'){
    if(count<=1){cols=1;cardWidth=430}
    else if(count<=2){cols=2;cardWidth=350}
    else {cols=3;cardWidth=280}
  }

  const cardHeight = Math.round(cardWidth * (580 / 420));
  const rows = Math.ceil(count / cols);
  const gapY = 16;
  const cardInfoHeight = entityType==='vault'||cards.some(item=>item.productType==='GRADED')?Math.max(74,...cards.filter(item=>item.productType==='GRADED').map(shareSlabPlateHeight)):58;
  const headerHeight = 136;
  const footerHeight = 56;
  const cardsAreaHeight = rows * (cardHeight + cardInfoHeight) + (rows - 1) * gapY;
  const cardDetailShare = entityType === 'card' && count === 1;
  const vaultProgressHeight=entityType==='vault'&&setProgress?118:0;
  const canvasHeight = cardDetailShare ? 2400 : Math.max(640, headerHeight + vaultProgressHeight + cardsAreaHeight + footerHeight + 44);
  const isPokemon=gameSlug==='pokemon'||cardDetails?.gameLabel==='Pokémon TCG'||(cards[0]?.card as Card&{gameSlug?:string}|undefined)?.gameSlug==='pokemon';
  const palette = style === 'light' ? isPokemon?{
    bgStart:'#fbf3d8',bgMid:'#f6efd9',bgEnd:'#e8edf0',panel:'#fffdf4',line:'#d8c989',ink:'#203b55',muted:'#617486',accent:'#d94a3f',
    cardFallback:'#f5e4a1',cardText:'#203b55',badge:'#f0ce4d',badgeText:'#173d5f',
  } : {
    bgStart: '#f5f0e6', bgMid: '#eee7d9', bgEnd: '#e8dfcf',
    panel: '#fffaf0', line: '#d8cbb5', ink: '#28251f', muted: '#716a5e', accent: '#b77a19',
    cardFallback: '#f5f0e6', cardText: '#28251f', badge: '#fffaf0', badgeText: '#28251f',
  } : isPokemon?{
    bgStart:'#132b40',bgMid:'#15364b',bgEnd:'#102738',panel:'#17374b',line:'#35586c',ink:'#f5f2df',muted:'#b8c6c9',accent:'#f0cd4f',
    cardFallback:'#1c4055',cardText:'#f5f2df',badge:'#f0cd4f',badgeText:'#18344a',
  } : {
    bgStart: '#10141a', bgMid: '#131922', bgEnd: '#171f2b',
    panel: '#10161f', line: '#273344', ink: '#f6f2ea', muted: '#aab4c2', accent: '#e8c47d',
    cardFallback: '#17202c', cardText: '#d5deea', badge: '#1d242d', badgeText: '#fff7e6',
  };

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const pokemonWaveImg=entityType==='vault'&&isPokemon?await loadImg('/assets/pokemon-shell-wave.svg'):null;

  // Listing image background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  bgGrad.addColorStop(0, palette.bgStart);
  bgGrad.addColorStop(0.5, palette.bgMid);
  bgGrad.addColorStop(1, palette.bgEnd);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  if(pokemonWaveImg){ctx.save();ctx.globalAlpha=.12;ctx.drawImage(pokemonWaveImg,0,canvasHeight-190,canvasWidth,190);ctx.restore();}

  // The card-detail share border is redrawn after its content height is known.
  if (!cardDetailShare && entityType !== 'vault') {
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, 16, 16, canvasWidth - 32, canvasHeight - 32, 14);
    ctx.stroke();
  }

  // Ensure fonts are ready before canvas measurement and rendering
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignore font wait failures
    }
  }

  // Load brand compass mark & card images concurrently
  const [compassImg, gameLogoImg, ...loadedCardImages] = await Promise.all([
    loadImg('/brand/vivreplay-compass.png'),
    entityType==='vault'&&gameSlug==='all'?Promise.resolve(null):entityType==='vault'?loadImg(gameSlug==='pokemon'?'https://upload.wikimedia.org/wikipedia/commons/1/1a/Pok%C3%A9mon_Trading_Card_Game_logo.svg':'/assets/one-piece-card-game-logo.png'):Promise.resolve(null),
    ...cards.map(async (item) => {
      // Share previews should use the exact printing selected for the listing.
      // Catalog URL reconstruction can point at the standard art when an
      // alternate printing has a different image path.
      for(const url of shareCardImageUrls(item.card,item.printingId)){
        const image=await loadImg(url);
        if(image)return image;
      }
      return null;
    }),
  ]);
  const slabYears=new Map<ShareCardItem,number>();
  await Promise.all(cards.filter(item=>item.productType==='GRADED').map(async item=>{
    const card=item.card as Card&{gameSlug?:string};
    const game=(card.gameSlug??(/^PK-/i.test(card.code)?'pokemon':gameSlug??'one-piece')) as 'one-piece'|'pokemon';
    const setCode=item.slabLabel?.setCode??card.setCode??'';
    const language=item.slabLabel?.language??card.language??'EN';
    const year=await shareSetYear(game,language,setCode);
    if(year)slabYears.set(item,year);
  }));

  if (cardDetailShare) {
    const item = cards[0];
    const img = loadedCardImages[0];
    const gameLabel = cardDetails?.gameLabel || ((item.card as Card & {gameSlug?:string}).gameSlug === 'pokemon' ? 'Pokémon TCG' : 'ONE PIECE CARD GAME');
    const isPokemon = gameLabel === 'Pokémon TCG';
    const gameLogoImg = await loadImg(isPokemon
      ? 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Pok%C3%A9mon_Trading_Card_Game_logo.svg'
      : '/assets/one-piece-card-game-logo.png');
    const artX = 64, artY = 118, artW = 400, artH = 552;
    ctx.save();
    ctx.shadowColor = style === 'light' ? 'rgba(49,38,19,.18)' : 'rgba(0,0,0,.5)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = palette.panel;
    drawRoundedRect(ctx, artX, artY, artW, artH, 16);
    ctx.fill();
    ctx.restore();
    ctx.save();
    drawRoundedRect(ctx, artX, artY, artW, artH, 16);
    ctx.clip();
    if (img) ctx.drawImage(img, artX, artY, artW, artH);
    else {
      ctx.fillStyle = palette.cardFallback;
      ctx.fillRect(artX, artY, artW, artH);
      ctx.fillStyle = palette.ink;
      ctx.font = '700 24px "Plus Jakarta Sans", sans-serif';
      drawWrappedText(ctx, item.card.name, artX + 24, artY + artH / 2, artW - 48, 32, 3);
    }
    ctx.restore();

    if (gameLogoImg) {
      const logoWidth = gameLogoImg.naturalWidth || gameLogoImg.width;
      const logoHeight = gameLogoImg.naturalHeight || gameLogoImg.height;
      const scale = Math.min(220 / logoWidth, 44 / logoHeight);
      const drawWidth = logoWidth * scale;
      const drawHeight = logoHeight * scale;
      ctx.save();
      if (!isPokemon && style === 'dark') ctx.filter = 'invert(1)';
      ctx.drawImage(gameLogoImg, 64 + 170, 34 + (44 - drawHeight) / 2, drawWidth, drawHeight);
      ctx.restore();
    } else {
      ctx.font = '700 14px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = palette.accent;
      ctx.fillText(gameLabel.toUpperCase(), 64 + 170, 56);
    }
    if (compassImg) ctx.drawImage(compassImg, 64, 34, 44, 44);
    ctx.font = '800 17px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = palette.ink;
    ctx.fillText('VivrePlay', 118, 62);

    const panelX = 510, panelW = 624;
    const details = cardDetails ?? {
      language: item.card.language,
      setCode: item.card.setCode,
      number: item.card.printingCode || item.card.code,
      rarity: item.card.rarity,
      facts: [
        {label:'Color',value:item.card.color}, {label:'Card type',value:item.card.type},
        {label:'Cost',value:String(item.card.cost)}, ...(item.card.power ? [{label:'Power',value:String(item.card.power)}] : []),
        ...(item.card.counter ? [{label:'Counter',value:String(item.card.counter)}] : []), ...(item.card.attribute ? [{label:'Attribute',value:item.card.attribute}] : []),
      ],
      sections: item.card.effect ? [{title:'Effect',text:item.card.effect}] : [],
    };
    const energyAssets = [...new Set([...(details.facts ?? []).flatMap(fact => fact.energyTypes ?? []), ...(details.sections ?? []).flatMap(section => section.energyTypes ?? [])].map(energyAssetFromName).filter((value):value is string => Boolean(value)))];
    const energyImages = new Map(await Promise.all(energyAssets.map(async asset => [asset, await loadImg(`/assets/pokemon/energy/${asset}.png`)] as const)));
    ctx.font = '800 34px "Plus Jakarta Sans", sans-serif'; ctx.fillStyle = palette.ink;
    const vitalsWidth=details.vitals?((details.vitals.hp!==undefined?60:0)+(details.vitals.types?.length??0)*27):0;
    const titleMaxWidth=details.vitals?Math.max(300,panelW-vitalsWidth-14):panelW;
    const titleEnd = details.gameLabel==='Pokémon TCG'?drawPokemonMechanicTitle(ctx,title,panelX,166,titleMaxWidth,34,palette.ink):drawWrappedText(ctx,title,panelX,166,titleMaxWidth,42,2);
    if(details.vitals){
      let vx=panelX+titleMaxWidth+12;
      if(details.vitals.hp!==undefined){ctx.font='700 12px "Plus Jakarta Sans", sans-serif';ctx.fillStyle=palette.muted;ctx.fillText('HP',vx,154);ctx.font='800 24px "Plus Jakarta Sans", sans-serif';ctx.fillStyle=palette.ink;ctx.fillText(String(details.vitals.hp),vx,180);vx+=ctx.measureText(String(details.vitals.hp)).width+18;}
      for(const type of details.vitals.types??[]){const asset=energyAssetFromName(type),icon=asset?energyImages.get(asset):null;if(icon)ctx.drawImage(icon,vx,158,23,23);vx+=27;}
    }
    let y = Math.max(210, titleEnd + 10);
    ctx.font='600 13px "Manrope", sans-serif';ctx.fillStyle=palette.muted;
    if(details.setName){ctx.fillText(fitCanvasText(ctx,details.setName,panelW),panelX,y,panelW);y+=21;}
    let metaX=panelX;
    if(details.setCode){ctx.font='750 11px "Plus Jakarta Sans", sans-serif';ctx.fillStyle=palette.muted;ctx.fillText(details.setCode,metaX,y+13);metaX+=ctx.measureText(details.setCode).width+10;}
    if(details.setCode&&details.number)metaX+=10;
    if(details.number){ctx.font='600 12px "Manrope", sans-serif';ctx.fillStyle=palette.muted;ctx.fillText(details.number,metaX,y+13);metaX+=ctx.measureText(details.number).width+12;}
    if(details.rarity){ctx.font='800 11px "Plus Jakarta Sans", sans-serif';ctx.fillStyle=palette.ink;ctx.fillText(details.rarity,metaX,y+13);metaX+=ctx.measureText(details.rarity).width+12;}
    if(details.regulation){ctx.font='700 10px "Plus Jakarta Sans", sans-serif';ctx.fillStyle=palette.muted;ctx.fillText(details.regulation,metaX,y+13);}
    if(details.illustrator){ctx.font='650 11px "Manrope", sans-serif';ctx.fillStyle=palette.ink;ctx.textAlign='right';ctx.fillText(`Illus. ${details.illustrator}`,panelX+panelW,y+13,panelW*.38);ctx.textAlign='left';}
    y+=28;
    for (const section of details.sections ?? []) {
      y+=12;
      let headingX=panelX;
      if(section.badge){ctx.font='italic 900 10px "Plus Jakarta Sans", sans-serif';const badgeW=ctx.measureText(section.badge.toUpperCase()).width+15;const badgeGradient=ctx.createLinearGradient(headingX,y-13,headingX+badgeW,y);badgeGradient.addColorStop(0,'#d74237');badgeGradient.addColorStop(1,'#f36b49');ctx.fillStyle=badgeGradient;ctx.fillRect(headingX,y-13,badgeW,18);ctx.fillStyle='#fffaf0';ctx.fillText(section.badge.toUpperCase(),headingX+7,y);headingX+=badgeW+8;}
      if(section.energyTypes?.length){for(const type of section.energyTypes){const asset=energyAssetFromName(type),icon=asset?energyImages.get(asset):null;if(icon)ctx.drawImage(icon,headingX,y-15,17,17);headingX+=20;}}
      ctx.font='800 14px "Plus Jakarta Sans", sans-serif';ctx.fillStyle=palette.ink;ctx.fillText(section.title,headingX,y);
      if(section.damage){ctx.textAlign='right';ctx.fillText(section.damage,panelX+panelW,y);ctx.textAlign='left';}
      y+=22;
      const maxLines=Math.max(1,Math.floor((canvasHeight-100-y)/19));
      y=(details.gameLabel==='Pokémon TCG'?drawPokemonRuleText(ctx,section.text,panelX,y,panelW,19,maxLines,energyImages):drawOnePieceRuleText(ctx,section.text,panelX,y,panelW,19,maxLines,palette))+10;
    }
    let evolutionBottom=y;
    if(details.evolutionCode){
      try {
        const params=new URLSearchParams({code:details.evolutionCode,language:details.language??'EN'});
        if(details.evolvesFrom)params.set('evolveFrom',details.evolvesFrom);
        const response=await fetch(`/api/cards/catalog/evolution?${params}`);
        const payload=response.ok?await response.json() as {evolution?:{code:string;name:string;spriteName:string;stage:string;dexIds?:string[];children?:unknown[]}|null}:null;
        type EvolutionShareNode={code:string;name:string;spriteName:string;stage:string;dexIds?:string[];children?:EvolutionShareNode[]};
        const levels:EvolutionShareNode[][]=[];
        let level:EvolutionShareNode[]=payload?.evolution?[payload.evolution as EvolutionShareNode]:[];
        for(let depth=0;depth<4&&level.length;depth++){
          levels.push(level);
          level=[...new Map(level.flatMap(node=>node.children??[]).map(node=>[node.code,node])).values()];
        }
        if(levels.length){
          const evoY=y+14, left=panelX;
          const spriteImages=new Map(await Promise.all(levels.flatMap(nodes=>nodes).map(async node=>{const dex=node.dexIds?.find(value=>/^\d+$/.test(value));return [node.code,dex?await loadImg(`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dex}.png`):null] as const;})));
          ctx.font='800 13px "Plus Jakarta Sans", sans-serif';ctx.fillStyle=palette.muted;
          ctx.fillText(details.language==='ID'?'EVOLUSI':'EVOLUTION',left,evoY);
          const stepW=(panelW)/levels.length;
          for(const [index,nodes] of levels.entries()){
            const x=left+index*stepW;
            if(index){ctx.font='750 18px "Plus Jakarta Sans", sans-serif';ctx.fillStyle=palette.accent;ctx.fillText('›',x-21,evoY+52);}
            ctx.font='750 9px "Plus Jakarta Sans", sans-serif';ctx.fillStyle=palette.muted;ctx.fillText((nodes[0]?.stage||'').toUpperCase(),x,evoY+20,stepW-14);
            nodes.slice(0,2).forEach((node,nodeIndex)=>{
              const nodeY=evoY+27+nodeIndex*40;
              const sprite=spriteImages.get(node.code);
              const textX=sprite?x+39:x;
              const textWidth=stepW-(textX-x)-14;
              if(sprite){
                ctx.beginPath();ctx.arc(x+16,nodeY+14,15,0,Math.PI*2);ctx.fillStyle=style==='light'?'#eee7d9':'#273344';ctx.fill();
                ctx.drawImage(sprite,x+1,nodeY-1,30,30);
              }
              ctx.font='700 11px "Plus Jakarta Sans", sans-serif';ctx.fillStyle=palette.ink;ctx.fillText(fitCanvasText(ctx,node.name||node.spriteName,textWidth),textX,nodeY+18,textWidth);
            });
            if(nodes.length>2){ctx.font='600 9px "Manrope", sans-serif';ctx.fillStyle=palette.muted;ctx.fillText(`+${nodes.length-2}`,x,evoY+103);}
          }
          evolutionBottom=evoY+125;
        }
      } catch { /* Evolution remains optional when the detail endpoint is unavailable. */ }
    }
    y=evolutionBottom;
    // Keep card facts after evolution so Pokémon stats read beneath the chain.
    if (details.facts?.length) {
      y+=14;
      const columns=Math.min(3,details.facts.length),rows=Math.ceil(details.facts.length/columns),factW=panelW/columns,factY=y;
      for (const [index, fact] of details.facts.slice(0,9).entries()) {
        const col=index%columns,row=Math.floor(index/columns),x=panelX+col*factW,rowY=factY+row*58;
        ctx.font='800 10px "Plus Jakarta Sans", sans-serif';ctx.fillStyle=palette.muted;ctx.fillText(fact.label.toUpperCase(),x,rowY+17,factW-14);
        const icons = fact.energyTypes?.map(energyAssetFromName).filter((asset):asset is string=>Boolean(asset)) ?? [];
        if (icons.length) {
          let ix=x;
          for(const asset of icons){const icon=energyImages.get(asset);if(icon)ctx.drawImage(icon,ix,rowY+25,18,18);ix+=21;}
          if(fact.value){ctx.font='700 13px "Plus Jakarta Sans", sans-serif';ctx.fillStyle=palette.ink;ctx.fillText(fitCanvasText(ctx,fact.value,factW-(ix-x)-14),ix,rowY+39,factW-(ix-x)-14);}
        } else {ctx.font='700 14px "Plus Jakarta Sans", sans-serif';ctx.fillStyle=palette.ink;ctx.fillText(fitCanvasText(ctx,fact.value,factW-14),x,rowY+39,factW-14);}
      }
      y+=rows*58;
    }
    const finalHeight=Math.max(760,Math.max(artY+artH,y,evolutionBottom)+88);
    const output=document.createElement('canvas');output.width=canvasWidth;output.height=finalHeight;
    const outputCtx=output.getContext('2d');if(!outputCtx)return null;
    outputCtx.drawImage(canvas,0,0,canvasWidth,finalHeight,0,0,canvasWidth,finalHeight);
    const footerY=finalHeight-24;
    outputCtx.font='600 10px "Manrope", sans-serif';outputCtx.fillStyle=palette.muted;outputCtx.fillText('Powered by',paddingX,footerY);
    if(compassImg)outputCtx.drawImage(compassImg,paddingX+67,footerY-13,16,16);
    outputCtx.font='800 12px "Plus Jakarta Sans", sans-serif';outputCtx.fillStyle=palette.ink;outputCtx.fillText('VivrePlay',paddingX+87,footerY);
    outputCtx.textAlign='right';outputCtx.fillStyle=palette.muted;outputCtx.font='600 11px "Manrope", sans-serif';outputCtx.fillText(link,canvasWidth-paddingX,footerY,500);outputCtx.textAlign='left';
    return new Promise<Blob|null>(resolve=>output.toBlob(blob=>resolve(blob),'image/png'));
  }

  // Keep card shares associated with the library; listings belong to Market.
  const brandY = 56;
  let brandX = paddingX;

  if (compassImg) {
    ctx.drawImage(compassImg, brandX, brandY - 20, 24, 24);
    brandX += 32;
  }

  ctx.font = '800 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = palette.ink;
  ctx.fillText('VivrePlay', brandX, brandY - 2);
  const vpWidth = ctx.measureText('VivrePlay').width;
  brandX += vpWidth + 8;

  if(entityType==='vault'&&gameLogoImg){
    const logoWidth=gameLogoImg.naturalWidth||gameLogoImg.width,logoHeight=gameLogoImg.naturalHeight||gameLogoImg.height;
    const scale=Math.min(170/logoWidth,34/logoHeight);
    ctx.drawImage(gameLogoImg,brandX+12,brandY-21,logoWidth*scale,logoHeight*scale);
  }

  if (entityType === 'listing') {
    ctx.font = '400 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = palette.muted;
    ctx.fillText('|', brandX, brandY - 3);
    brandX += 14;

    ctx.font = '800 16px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = palette.accent;
    ctx.fillText('Market', brandX, brandY - 2);
  }

  // Price badge on the right
  if (price) {
    ctx.font = '800 24px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = palette.accent;
    ctx.textAlign = 'right';
    ctx.fillText(price, canvasWidth - paddingX, brandY);
    ctx.textAlign = 'left';
  }

  // Display listing title in Plus Jakarta Sans
  ctx.font = '800 28px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = palette.ink;
  let displayTitle = title;
  if (displayTitle.length > 52) {
    displayTitle = displayTitle.slice(0, 49) + '…';
  }
  ctx.fillText(displayTitle, paddingX, 96);

  // Subtitle in Manrope
  if (subtitle) {
    ctx.font = '600 13px "Manrope", sans-serif';
    ctx.fillStyle = palette.muted;
    ctx.fillText(fitCanvasText(ctx,subtitle,canvasWidth-paddingX*2), paddingX, 120);
  }

  // Divider rule
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(paddingX, 136);
  ctx.lineTo(canvasWidth - paddingX, 136);
  ctx.stroke();

  // Cards grid placement
  const availableWidth = canvasWidth - paddingX * 2;
  const gapX = 18;
  const gridWidth = cols * cardWidth + (cols - 1) * gapX;
  const gridStartX = paddingX + Math.max(0, (availableWidth - gridWidth) / 2);
  let startY = 162;

  if(entityType==='vault'&&setProgress){
    const progressY=158;
    ctx.font='800 21px "Plus Jakarta Sans", sans-serif';ctx.fillStyle=palette.ink;
    ctx.fillText(fitCanvasText(ctx,setProgress.name,availableWidth),paddingX,progressY,availableWidth);
    ctx.font='600 14px "Manrope", sans-serif';ctx.fillStyle=palette.muted;
    ctx.fillText(`${setProgress.ownedCount} / ${setProgress.totalCards} ${language==='ID'?'kartu':'cards'}`,paddingX,progressY+27);
    ctx.font='800 14px "Plus Jakarta Sans", sans-serif';ctx.fillStyle=palette.accent;ctx.textAlign='right';
    ctx.fillText(`${Math.max(0,Math.min(100,setProgress.percentage)).toFixed(1)}%`,canvasWidth-paddingX,progressY+27);ctx.textAlign='left';
    ctx.fillStyle=palette.line;drawRoundedRect(ctx,paddingX,progressY+40,availableWidth,10,5);ctx.fill();
    ctx.fillStyle=palette.accent;drawRoundedRect(ctx,paddingX,progressY+40,availableWidth*Math.max(0,Math.min(100,setProgress.percentage))/100,10,5);ctx.fill();
    ctx.font='600 12px "Manrope", sans-serif';ctx.fillStyle=palette.muted;
    ctx.fillText(`${language==='ID'?'Set utama':'Main set'} ${setProgress.mainSetOwned} / ${setProgress.mainSetTotal}`,paddingX,progressY+72);
    ctx.fillText(`${language==='ID'?'Kartu paralel':'Parallels'} ${setProgress.parallelsOwned} / ${setProgress.parallelsTotal}`,paddingX+230,progressY+72);
    startY=progressY+100;
  }

  for (let i = 0; i < count; i++) {
    const item = cards[i];
    const img = loadedCardImages[i];
    const r = Math.floor(i / cols);
    const c = i % cols;
    const cardX = gridStartX + c * (cardWidth + gapX);
    const cardY = startY + r * (cardHeight + cardInfoHeight + gapY);
    const isSlab=item.productType==='GRADED';
    const grader=String(item.gradingCompany??'PSA').toUpperCase().replace(/[^A-Z]/g,'');
    const isArsSlab=isSlab&&(grader==='ARS'||grader.startsWith('ARS'));
    const plateHeight=isSlab?shareSlabPlateHeight(item):cardInfoHeight;
    const clearSlab=isSlab&&(grader==='TAG'||grader==='TAGGRADING'||((grader==='EGS'||grader.includes('EMPORIUMGRADINGSERVICE'))&&item.slabLabel?.labelStyle==='clear'));
    const artX=cardX+(isSlab?8:0);
    const artY=cardY+(isSlab?(isArsSlab?5:plateHeight):0);
    const artWidth=cardWidth-(isSlab?16:0);
    const artHeight=cardHeight-(isSlab?10:0);

    if(isSlab){
      const caseHeight=plateHeight+cardHeight;
      ctx.save();
      ctx.shadowColor=style==='light'?'rgba(49,38,19,.18)':'rgba(0,0,0,.42)';ctx.shadowBlur=12;ctx.shadowOffsetY=5;
      ctx.fillStyle=clearSlab?'rgba(8,11,14,.96)':style==='light'?'rgba(255,255,255,.74)':'rgba(255,255,255,.08)';
      drawRoundedRect(ctx,cardX,cardY,cardWidth,caseHeight,10);ctx.fill();ctx.restore();
      ctx.strokeStyle=style==='light'?'rgba(119,126,132,.72)':'rgba(220,228,236,.46)';ctx.lineWidth=2;
      drawRoundedRect(ctx,cardX+1,cardY+1,cardWidth-2,caseHeight-2,10);ctx.stroke();
      if(clearSlab){ctx.fillStyle='rgba(7,10,13,.88)';drawRoundedRect(ctx,cardX+4,artY-1,cardWidth-8,artHeight+2,5);ctx.fill();ctx.strokeStyle='rgba(236,242,246,.62)';ctx.lineWidth=1.4;drawRoundedRect(ctx,cardX+4,artY-1,cardWidth-8,artHeight+2,5);ctx.stroke();}
      const labelY=isArsSlab?cardY+cardHeight+5:cardY+5;
      drawVaultSlabLabel(ctx,item,gameSlug==='all'?undefined:gameSlug,cardX+5,labelY,cardWidth-10,plateHeight-10,slabYears.get(item));
    }

    // Show duplicate copies as a small physical stack behind the top card.
    const stackLayers = Math.min(2, Math.max(0, Math.ceil((item.quantity ?? 1) - 1)));
    for (let layer = stackLayers; layer > 0; layer--) {
      const layerX = cardX + layer * 5;
      const layerY = cardY - layer * 4;
      ctx.save();
      ctx.fillStyle = palette.panel;
      drawRoundedRect(ctx, layerX, layerY, cardWidth, cardHeight, 7);
      ctx.fill();
      ctx.save();
      drawRoundedRect(ctx, layerX, layerY, cardWidth, cardHeight, 7);
      ctx.clip();
      if (img) ctx.drawImage(img, layerX, layerY, cardWidth, cardHeight);
      else {
        ctx.fillStyle = palette.cardFallback;
        ctx.fillRect(layerX, layerY, cardWidth, cardHeight);
      }
      ctx.restore();
      ctx.strokeStyle = palette.line;
      ctx.lineWidth = 1.5;
      drawRoundedRect(ctx, layerX, layerY, cardWidth, cardHeight, 7);
      ctx.stroke();
      ctx.restore();
    }

    // Realistic physical card shadow
    ctx.save();
    ctx.shadowColor = style === 'light' ? 'rgba(49, 38, 19, 0.18)' : 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = palette.panel;
    drawRoundedRect(ctx, artX, artY, artWidth, artHeight, isSlab?3:7);
    ctx.fill();
    ctx.restore();

    // Clipped card art
    ctx.save();
    drawRoundedRect(ctx, artX, artY, artWidth, artHeight, isSlab?3:7);
    ctx.clip();
    if (img) {
      ctx.drawImage(img, artX, artY, artWidth, artHeight);
    } else {
      ctx.fillStyle = palette.cardFallback;
      ctx.fillRect(artX, artY, artWidth, artHeight);
      ctx.fillStyle = palette.cardText;
      ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(item.card.name, artX + 12, artY + artHeight / 2);
    }
    ctx.restore();

    // Card border
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, artX, artY, artWidth, artHeight, isSlab?3:7);
    ctx.stroke();

    // VivrePlay stack badge for count > 1
    if (item.quantity && item.quantity > 1) {
      const badgeW = 38;
      const badgeH = 22;
      const badgeX = artX + artWidth - badgeW - 6;
      const badgeY = artY + artHeight - badgeH - 6;

      ctx.save();
      ctx.fillStyle = palette.badge;
      drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 11);
      ctx.fill();
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 1.5;
      drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 11);
      ctx.stroke();

      ctx.font = '800 11px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = palette.badgeText;
      ctx.textAlign = 'center';
      ctx.fillText(`×${item.quantity}`, badgeX + badgeW / 2, badgeY + 15);
      ctx.restore();
    }

    if(!isSlab){
      ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = palette.ink;
      ctx.textAlign = 'center';
      const maxLabelWidth = cardWidth - 8;
      let nameLabel = item.card.name;
      while (nameLabel.length > 3 && ctx.measureText(nameLabel).width > maxLabelWidth) nameLabel = `${nameLabel.slice(0, -2)}…`;
      ctx.fillText(nameLabel, cardX + cardWidth / 2, cardY + cardHeight + 16);
      ctx.font = '600 10px "Manrope", sans-serif';
      ctx.fillStyle = palette.muted;
      const cardDetails = [item.metaLine??item.card.code, item.productType==='GRADED'?'':item.condition].filter(Boolean).join('  ');
      ctx.fillText(cardDetails, cardX + cardWidth / 2, cardY + cardHeight + 32);
    }
    if(isSlab){ctx.strokeStyle=style==='light'?'rgba(119,126,132,.72)':'rgba(220,228,236,.46)';ctx.lineWidth=2;drawRoundedRect(ctx,cardX+1,cardY+1,cardWidth-2,plateHeight+cardHeight-2,10);ctx.stroke();}
    if (typeof item.unitAmount === 'number' && item.unitAmount > 0) {
      ctx.font = '800 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = palette.accent;
      const unitPrice = new Intl.NumberFormat(language === 'ID' ? 'id-ID' : 'en-ID', {style: 'currency', currency: 'IDR', maximumFractionDigits: 0}).format(item.unitAmount);
      ctx.fillText(`${unitPrice} / ${language === 'ID' ? 'kartu' : 'card'}`, cardX + cardWidth / 2, cardY + cardHeight + 50);
    }
    ctx.textAlign = 'left';
  }

  // Footer rule & provenance in Manrope
  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(paddingX, canvasHeight - 48);
  ctx.lineTo(canvasWidth - paddingX, canvasHeight - 48);
  ctx.stroke();

  const footerY = canvasHeight - 24;
  if (entityType==='vault'){
    ctx.font='600 10px "Manrope", sans-serif';ctx.fillStyle=palette.muted;ctx.fillText('Powered by',paddingX,footerY);
    if (compassImg) ctx.drawImage(compassImg,paddingX+62,footerY-13,16,16);
    ctx.font='800 12px "Plus Jakarta Sans", sans-serif';ctx.fillStyle=palette.ink;ctx.fillText('VivrePlay',paddingX+82,footerY);
  } else {
  if (compassImg) ctx.drawImage(compassImg, paddingX, footerY - 13, 18, 18);
  ctx.font = '800 13px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = palette.ink;
  ctx.fillText('VivrePlay', paddingX + 25, footerY);
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = palette.muted;
  ctx.font = '600 11px "Manrope", sans-serif';
  ctx.fillText(link, canvasWidth - paddingX, footerY, 500);
  ctx.textAlign = 'left';

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

export async function generateVaultShareBlob({title,cards,link,language='EN',style='light',gameSlug,setProgress}:{title:string;cards:ShareCardItem[];link:string;language?:'EN'|'ID';style?:'light'|'dark';gameSlug:'one-piece'|'pokemon'|'all';setProgress?:ShareVaultSetProgress}){
  return generateListingCompositeBlob({title,cards,link,language,style,entityType:'vault',gameSlug,setProgress});
}

export function ShareButton({
  title,
  path,
  privateEntity = false,
  cards,
  card,
  subtitle,
  price,
  listingInfo,
  className = '',
  openOnMount = false,
  hideTrigger = false,
  onOpenChange,
  entityType = 'listing',
  cardDetails,
}: ShareButtonProps) {
  const [open, setOpen] = useState(openOnMount);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [language, setLanguage] = useState<'EN' | 'ID'>(useRouteLocale());
  const [shareStyle, setShareStyle] = useState<'light' | 'dark'>('light');
  const [imagePreview, setImagePreview] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    const sync = () => setLanguage(window.localStorage.getItem('vivreplay-locale') === 'ID' ? 'ID' : 'EN');
    const onLocale = (event: Event) => setLanguage((event as CustomEvent<'EN' | 'ID'>).detail === 'ID' ? 'ID' : 'EN');
    sync();
    window.addEventListener('vivreplay:locale', onLocale);
    return () => window.removeEventListener('vivreplay:locale', onLocale);
  }, []);

  const cardListKey = JSON.stringify(cards && cards.length > 0 ? cards : card ? [{card, quantity: 1}] : []);
  const cardList: ShareCardItem[] = useMemo(() => JSON.parse(cardListKey) as ShareCardItem[], [cardListKey]);
  const cardDetailsKey = JSON.stringify(cardDetails ?? null);
  const stableCardDetails = useMemo(() => JSON.parse(cardDetailsKey) as ShareCardDetails | null, [cardDetailsKey]);

  const url = typeof window === 'undefined' ? path : new URL(path, window.location.origin).href;
  const sharePath = new URL(path, 'https://vivreplay.com');
  const imageLink = `vivreplay.com${sharePath.pathname}${sharePath.search}`;
  const imageSubtitle=[subtitle,listingInfo?.city,listingInfo?.seller?`${language==='ID'?'oleh':'by'} ${listingInfo.seller}`:'',listingInfo?.expiresAt?shareExpiry(listingInfo.expiresAt,language,listingInfo.timeZone):''].filter(Boolean).join(' | ');
  const entityLabel = entityType === 'card' ? (language === 'ID' ? 'kartu' : 'card') : 'listing';
  const imageFileName = entityType === 'card' && cardList.length === 1
    ? [
        title,
        stableCardDetails?.setCode ?? cardList[0]?.card.setCode,
        stableCardDetails?.number ?? cardList[0]?.card.printingCode ?? cardList[0]?.card.code,
        stableCardDetails?.language ?? cardList[0]?.card.language,
        stableCardDetails?.rarity ?? cardList[0]?.card.rarity,
        'card',
      ].filter((part): part is string => Boolean(part?.trim())).map(filenamePart).filter(Boolean).join('_') + '.png'
    : `${filenamePart(title)}_${entityType === 'card' ? 'card' : 'listing'}.png`;

  useEffect(() => {
    if (!open || cardList.length === 0) return;
    let active = true;
    void Promise.resolve().then(()=>{
      if(!active)return null;
      setPreviewLoading(true);
      setImagePreview('');
      return generateListingCompositeBlob({title,price,subtitle:imageSubtitle,cards:cardList,link:imageLink,language,style:shareStyle,entityType,cardDetails:stableCardDetails ?? undefined});
    }).then(blob => {
      if (!active || !blob) return;
      setImagePreview(URL.createObjectURL(blob));
    }).catch(() => {}).finally(() => { if (active) setPreviewLoading(false); });
    return () => { active = false; };
  }, [open,cardList,title,price,imageSubtitle,imageLink,language,shareStyle,entityType,stableCardDetails]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(language === 'ID' ? 'Tautan disalin ke papan klip' : 'Link copied to clipboard');
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      toast.error(language === 'ID' ? 'Gagal menyalin. Silakan pilih dan salin tautan secara manual.' : 'Copy unavailable. Please select and copy the link.');
    }
  };

  const handleDownloadListingImage = async () => {
    if (cardList.length === 0) return;
    setDownloading(true);
    try {
      const blob = await generateListingCompositeBlob({
        title,
        price,
        subtitle:imageSubtitle,
        cards: cardList,
        link: imageLink,
        language,
        style: shareStyle,
        entityType,
        cardDetails: stableCardDetails ?? undefined,
      });
      if (!blob) throw new Error('Image generation failed');

      const previewUrl = URL.createObjectURL(blob);
      setImagePreview((old) => { if (old) URL.revokeObjectURL(old); return previewUrl; });

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = imageFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      toast.success(entityType === 'card'
        ? (language === 'ID' ? 'Gambar kartu tersimpan' : 'Card image saved')
        : (language === 'ID' ? 'Gambar listing tersimpan' : 'Listing image saved'));
    } catch {
      toast.error(entityType === 'card'
        ? (language === 'ID' ? 'Gagal membuat gambar kartu' : 'Could not generate card image')
        : (language === 'ID' ? 'Gagal membuat gambar listing' : 'Could not generate listing image'));
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview); }, [imagePreview]);

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && Boolean(navigator.share)) {
      try {
        if (imagePreview) {
          const response = await fetch(imagePreview);
          const file = new File([await response.blob()], imageFileName, {type: 'image/png'});
          if (navigator.canShare?.({files: [file]})) { await navigator.share({title, text: subtitle, url, files: [file]}); return; }
        }
        await navigator.share({title, text: subtitle, url});
      } catch {
        // User cancelled or dismissed share sheet
      }
    }
  };

  return (
    <>
      {!hideTrigger && <button
        type="button"
        className={`share-action-button button secondary ${className}`}
        onClick={() => { setOpen(true); onOpenChange?.(true); }}
        aria-label={language === 'ID' ? `Bagikan ${title}` : `Share ${title}`}
      >
        <ShareRouteIcon size={15} />
        <span>{language === 'ID' ? 'Bagikan' : 'Share'}</span>
      </button>}

      <Dialog open={open} onOpenChange={(next) => { setOpen(next); onOpenChange?.(next); }}>
        <DialogContent className="share-dialog-content">
          <DialogHeader className="share-dialog-header">
            <div className={`share-brand-lockup${entityType === 'card' ? ' is-library-share' : ''}`}>
              <VivreMark size={20} />
              <span>VivrePlay</span>
              {entityType !== 'card' && <><i>|</i><b>Market</b></>}
            </div>
            <DialogTitle>{entityType === 'card'
              ? (language === 'ID' ? 'Bagikan kartu' : 'Share card')
              : (language === 'ID' ? 'Bagikan listing' : 'Share listing')}</DialogTitle>
            <DialogDescription>
              {entityType === 'card'
                ? (language === 'ID' ? 'Bagikan kartu lewat tautan atau gambar.' : 'Share this card with a link or image.')
                : privateEntity
                ? (language === 'ID' ? 'Listing ini bersifat privat. Hanya Anda yang dapat membuka tautan ini.' : 'This listing is private. Only you can open this link.')
                : (language === 'ID' ? 'Bagikan listing lewat tautan atau gambar.' : 'Share this listing with a link or image.')}
            </DialogDescription>
          </DialogHeader>

          {cardList.length > 0 && (
            <div className="share-preview-listing">
              <div className="share-preview-canvas">
                <div className="share-preview-style-picker">
                  <button
                    type="button"
                    className="share-preview-theme-toggle"
                    aria-label={shareStyle === 'light'
                      ? (language === 'ID' ? 'Gunakan tema gelap' : 'Use dark image theme')
                      : (language === 'ID' ? 'Gunakan tema terang' : 'Use light image theme')}
                    aria-pressed={shareStyle === 'dark'}
                    onClick={() => setShareStyle(current => current === 'light' ? 'dark' : 'light')}
                  >
                    {shareStyle === 'light' ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
                  </button>
                </div>
                {previewLoading && <div className="share-listing-image-loading" aria-label={language === 'ID' ? 'Memuat pratinjau' : 'Loading preview'} />}
                {!previewLoading && imagePreview && <img className="share-listing-image-preview" src={imagePreview} alt={language === 'ID' ? `Gambar ${entityLabel} ${title}` : `${entityLabel[0].toUpperCase()}${entityLabel.slice(1)} image for ${title}`} />}
                {!previewLoading && !imagePreview && <p className="share-preview-error" role="status">{language === 'ID' ? 'Pratinjau gambar tidak tersedia.' : 'Image preview is unavailable.'}</p>}
              </div>
              <button
                type="button"
                className="share-preview-save-btn"
                onClick={handleDownloadListingImage}
                disabled={downloading}
              >
                <DownloadSimple size={15} />
                <span>{downloading ? (language === 'ID' ? 'Membuat gambar...' : 'Creating image...') : entityType === 'card'
                  ? (language === 'ID' ? 'Simpan gambar kartu' : 'Save card image')
                  : (language === 'ID' ? 'Simpan gambar listing' : 'Save listing image')}</span>
              </button>
            </div>
          )}

          <div className="share-link-box">
            <input
              type="text"
              readOnly
              value={url}
              className="share-link-input"
              onFocus={(e) => e.target.select()}
              aria-label={language === 'ID' ? `Tautan ${entityLabel}` : `${entityLabel[0].toUpperCase()}${entityLabel.slice(1)} share link`}
            />
            <button
              type="button"
              className="button share-copy-btn"
              onClick={handleCopy}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              <span>{copied ? (language === 'ID' ? 'Tersalin!' : 'Copied!') : (language === 'ID' ? 'Salin' : 'Copy')}</span>
            </button>
          </div>

          {!privateEntity && (
            <div className="share-channels-grid">
              <LocalizedAnchor
                className="share-channel-btn whatsapp"
                href={`https://wa.me/?text=${encodeURIComponent(`${title} - ${url}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <WhatsappLogo size={18} weight="fill" />
                <span>WhatsApp</span>
              </LocalizedAnchor>
              <LocalizedAnchor
                className="share-channel-btn x-social"
                href={`https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <XLogo size={18} weight="bold" />
                <span>X</span>
              </LocalizedAnchor>
              <LocalizedAnchor
                className="share-channel-btn telegram"
                href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <TelegramLogo size={18} weight="fill" />
                <span>Telegram</span>
              </LocalizedAnchor>
            </div>
          )}

          {!privateEntity && typeof navigator !== 'undefined' && Boolean(navigator.share) && (
            <button
              type="button"
              className="button secondary share-native-btn"
              onClick={handleNativeShare}
            >
              <ShareRouteIcon size={15} />
              <span>{language === 'ID' ? 'Opsi berbagi lainnya' : 'More sharing options'}</span>
            </button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
