'use client';

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
  slabLabel?: {setCode?:string;language?:string;number?:string;rarity?:string};
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

function drawVaultPsaLabel(ctx:CanvasRenderingContext2D,item:ShareCardItem,gameSlug:'one-piece'|'pokemon'|undefined,x:number,y:number,width:number,height:number,setYear?:number){
  const card=item.card as Card&{gameSlug?:string};
  const game=card.gameSlug??gameSlug??'one-piece';
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
  const psa=String(item.gradingCompany??'PSA').toUpperCase()==='PSA';
  const border=psa?'#ed1c2e':'#8b929b';
  const frame=4;
  const left=x+8,right=x+width-8;
  const split=x+width*.69;
  const baseY=y+height;
  ctx.save();
  ctx.fillStyle='#fbfcff';ctx.fillRect(x,y,width,height);
  ctx.save();ctx.beginPath();ctx.rect(x+frame,y+frame,width-frame*2,height-frame*2);ctx.clip();
  ctx.strokeStyle='#e8eef7';ctx.lineWidth=2;
  for(let line=y+8;line<baseY;line+=8){ctx.beginPath();ctx.moveTo(x+frame,line);ctx.lineTo(x+width-frame,line);ctx.stroke();}
  ctx.restore();
  ctx.strokeStyle=border;ctx.lineWidth=frame;ctx.strokeRect(x+frame/2,y+frame/2,width-frame,height-frame);
  ctx.fillStyle='#17202b';ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.font='900 9px Arial,sans-serif';
  const releaseYear=(card as Card&{releaseYear?:number}).releaseYear??setYear;
  const descriptor=[releaseYear,game==='pokemon'?'POKÉMON':'ONE PIECE',setCode,language].filter(Boolean).join(' ');
  ctx.fillText(fitCanvasText(ctx,descriptor,split-left-5),left,y+14,split-left-5);
  ctx.textAlign='right';ctx.fillText(number?`#${number}`:'',right,y+14,width*.27);
  ctx.textAlign='left';ctx.fillText(fitCanvasText(ctx,card.name.toUpperCase(),split-left-5),left,y+27,split-left-5);
  ctx.textAlign='right';ctx.fillText(fitCanvasText(ctx,gradeLabel, right-split-4),right,y+27,right-split-4);
  ctx.textAlign='left';ctx.fillText(fitCanvasText(ctx,rarity,split-left-5),left,y+40,split-left-5);
  ctx.textAlign='right';ctx.fillText(gradeScore,right,y+40,right-split-4);
  let seed=2166136261;for(const char of certificate||'UNVERIFIED')seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;
  let barcodeX=left;const barcodeY=y+height-14;const barcodeW=Math.max(20,width*.34);
  while(barcodeX<left+barcodeW){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const barWidth=Math.min(1+seed%3,left+barcodeW-barcodeX);ctx.fillStyle='#17202b';ctx.fillRect(barcodeX,barcodeY,barWidth,7);barcodeX+=barWidth+1+(seed>>>8)%2;}
  ctx.textAlign='right';ctx.fillText(certificate,right,y+height-7,right-split-4);
  if(psa){
    const stampW=Math.min(36,width*.15),stampH=19,stampX=x+(width-stampW)/2,stampY=baseY-stampH/2;
    ctx.fillStyle='#d8dee5';ctx.fillRect(stampX,stampY,stampW,stampH);ctx.strokeStyle='#53677f';ctx.lineWidth=1;ctx.strokeRect(stampX,stampY,stampW,stampH);
    ctx.textAlign='center';ctx.font='italic 900 12px Arial,sans-serif';ctx.fillStyle='#064e9a';ctx.fillText('P',stampX+10,stampY+14);ctx.fillStyle='#e52d41';ctx.fillText('S',stampX+18,stampY+14);ctx.fillStyle='#064e9a';ctx.fillText('A',stampX+26,stampY+14);
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
  gameSlug?: 'one-piece'|'pokemon';
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
  const cardInfoHeight = entityType==='vault'?74:58;
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
    entityType==='vault'?loadImg(gameSlug==='pokemon'?'https://upload.wikimedia.org/wikipedia/commons/1/1a/Pok%C3%A9mon_Trading_Card_Game_logo.svg':'/assets/one-piece-card-game-logo.png'):Promise.resolve(null),
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
  if(entityType==='vault')await Promise.all(cards.filter(item=>item.productType==='GRADED'&&String(item.gradingCompany??'PSA').toUpperCase()==='PSA').map(async item=>{
    const card=item.card as Card&{gameSlug?:string};
    const game=(card.gameSlug??gameSlug??'one-piece') as 'one-piece'|'pokemon';
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
    drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 7);
    ctx.fill();
    ctx.restore();

    // Clipped card art
    ctx.save();
    drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 7);
    ctx.clip();
    if (img) {
      ctx.drawImage(img, cardX, cardY, cardWidth, cardHeight);
    } else {
      ctx.fillStyle = palette.cardFallback;
      ctx.fillRect(cardX, cardY, cardWidth, cardHeight);
      ctx.fillStyle = palette.cardText;
      ctx.font = '700 13px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(item.card.name, cardX + 12, cardY + cardHeight / 2);
    }
    ctx.restore();

    // Card border
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 1.5;
    drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 7);
    ctx.stroke();

    // VivrePlay stack badge for count > 1
    if (item.quantity && item.quantity > 1) {
      const badgeW = 38;
      const badgeH = 22;
      const badgeX = cardX + cardWidth - badgeW - 6;
      const badgeY = cardY + cardHeight - badgeH - 6;

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

    // Graded cards carry their details in the PSA label below the artwork.
    if(entityType==='vault'&&item.productType==='GRADED'&&String(item.gradingCompany??'PSA').toUpperCase()==='PSA'){
      drawVaultPsaLabel(ctx,item,gameSlug,cardX,cardY+cardHeight+2,cardWidth,cardInfoHeight-2,slabYears.get(item));
    }else{
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
    if(entityType==='vault'&&item.productType==='GRADED'&&String(item.gradingCompany??'PSA').toUpperCase()!=='PSA'){
      const label=`${item.gradingCompany??'PSA'}  ${item.grade??''}`.trim();
      ctx.font='800 10px "Plus Jakarta Sans", sans-serif';ctx.textAlign='center';
      const badgeWidth=Math.min(cardWidth-12,ctx.measureText(label).width+16),badgeX=cardX+(cardWidth-badgeWidth)/2,badgeY=cardY+cardHeight+42;
      ctx.fillStyle=palette.badge;drawRoundedRect(ctx,badgeX,badgeY,badgeWidth,20,6);ctx.fill();
      ctx.strokeStyle=palette.accent;ctx.lineWidth=1;drawRoundedRect(ctx,badgeX,badgeY,badgeWidth,20,6);ctx.stroke();
      ctx.fillStyle=palette.badgeText;ctx.fillText(label,cardX+cardWidth/2,badgeY+14,cardWidth-20);
    }
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

export async function generateVaultShareBlob({title,cards,link,language='EN',style='light',gameSlug,setProgress}:{title:string;cards:ShareCardItem[];link:string;language?:'EN'|'ID';style?:'light'|'dark';gameSlug:'one-piece'|'pokemon';setProgress?:ShareVaultSetProgress}){
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
  const [language, setLanguage] = useState<'EN' | 'ID'>('EN');
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
              <a
                className="share-channel-btn whatsapp"
                href={`https://wa.me/?text=${encodeURIComponent(`${title} - ${url}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <WhatsappLogo size={18} weight="fill" />
                <span>WhatsApp</span>
              </a>
              <a
                className="share-channel-btn x-social"
                href={`https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <XLogo size={18} weight="bold" />
                <span>X</span>
              </a>
              <a
                className="share-channel-btn telegram"
                href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <TelegramLogo size={18} weight="fill" />
                <span>Telegram</span>
              </a>
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
