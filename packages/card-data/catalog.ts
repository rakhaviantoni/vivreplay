export type Card = { id:string; code:string; name:string; color:string; type:'Leader'|'Character'|'Event'; cost:number; power:number; counter?:number; rarity:string; art:number; effect:string; imageUrl?:string; imageSource?:'external'|'generated'; setCode?:string; language?:string; printingCode?:string; assetPath?:string; variant?:string; attribute?:string };
export const gameId='00000000-0000-4000-8000-000000000001';
const iconicCards:Card[] = [
  {
    id:'10000000-0000-4000-8000-000000000019',
    code:'OP05-119',
    name:'Monkey D. Luffy',
    color:'Purple',
    type:'Character',
    cost:10,
    power:12000,
    rarity:'SEC',
    art:0,
    effect:'[Activate: Main] [Once Per Turn] Give this character up to 2 rested DON!! cards. [When Attacking] Look at up to 5 cards from the top of your deck; add 1 to your hand.',
    imageUrl:'https://cards.oplaytcg.com/OP05/en/small/OP05-119_p1.webp',
    imageSource:'external',
    setCode:'OP-05'
  },
  {
    id:'10000000-0000-4000-8000-000000000020',
    code:'OP01-025',
    name:'Roronoa Zoro',
    color:'Red',
    type:'Character',
    cost:3,
    power:5000,
    rarity:'SR',
    art:1,
    effect:'[Rush] (This card can attack on the turn in which it is played.)',
    imageUrl:'https://cards.oplaytcg.com/OP01/en/small/OP01-025.webp',
    imageSource:'external',
    setCode:'OP-01'
  },
  {
    id:'10000000-0000-4000-8000-000000000021',
    code:'OP09-001',
    name:'Shanks',
    color:'Red',
    type:'Leader',
    cost:0,
    power:5000,
    rarity:'L',
    art:2,
    effect:'[When Attacking] If you have 1 or fewer Life cards, give up to 1 of your opponent’s Characters -2000 power during this turn.',
    imageUrl:'https://cards.oplaytcg.com/OP09/en/small/OP09-001.webp',
    imageSource:'external',
    setCode:'OP-09'
  },
  {
    id:'10000000-0000-4000-8000-000000000022',
    code:'OP02-004',
    name:'Edward.Newgate',
    color:'Red',
    type:'Leader',
    cost:0,
    power:6000,
    rarity:'L',
    art:3,
    effect:'[End of Your Turn] Add 1 card from the top of your Life cards to your hand.',
    imageUrl:'https://cards.oplaytcg.com/OP02/en/small/OP02-004.webp',
    imageSource:'external',
    setCode:'OP-02'
  },
  {
    id:'10000000-0000-4000-8000-000000000023',
    code:'OP05-060',
    name:'Monkey D. Luffy',
    color:'Purple',
    type:'Character',
    cost:5,
    power:6000,
    rarity:'SR',
    art:4,
    effect:'[On Play] DON!! -1: Draw 2 cards.',
    imageUrl:'https://cards.oplaytcg.com/OP05/en/small/OP05-060.webp',
    imageSource:'external',
    setCode:'OP-05'
  },
  {
    id:'10000000-0000-4000-8000-000000000024',
    code:'OP06-118',
    name:'Roronoa Zoro',
    color:'Green',
    type:'Character',
    cost:9,
    power:9000,
    rarity:'SEC',
    art:5,
    effect:'[Activate: Main] Set this Character as active. This card can attack up to 3 times this turn.',
    imageUrl:'https://cards.oplaytcg.com/OP06/en/small/OP06-118.webp',
    imageSource:'external',
    setCode:'OP-06'
  },
  {
    id:'10000000-0000-4000-8000-000000000025',
    code:'OP09-004',
    name:'Benn Beckman',
    color:'Red',
    type:'Character',
    cost:7,
    power:8000,
    rarity:'SR',
    art:2,
    effect:'[On Play] K.O. up to 1 of your opponent’s Characters with 6000 power or less.',
    imageUrl:'https://cards.oplaytcg.com/OP09/en/small/OP09-004.webp',
    imageSource:'external',
    setCode:'OP-09'
  },
  {
    id:'10000000-0000-4000-8000-000000000026',
    code:'OP01-016',
    name:'Nami',
    color:'Red',
    type:'Character',
    cost:1,
    power:2000,
    rarity:'R',
    art:1,
    effect:'[On Play] Look at 5 cards from the top of your deck; reveal up to 1 {Straw Hat Crew} type card and add it to your hand.',
    imageUrl:'https://cards.oplaytcg.com/OP01/en/small/OP01-016.webp',
    imageSource:'external',
    setCode:'OP-01'
  }
];

// Player-facing surfaces use official One Piece printings only. The old illustrative
// seed records stay out of the exported catalog so their generated artwork cannot surface.
export const cards:Card[] = [iconicCards[2],iconicCards[0],...iconicCards.filter((_,index)=>index!==2&&index!==0)];

export type Printing={id:string;cardId:string;language:'EN'|'JP';variant:string;set:string;assetSourceId:string};

const iconicPrintings:Printing[] = iconicCards.flatMap((c,i)=>['EN','JP'].map((language,j)=>({
  id:`20000000-0000-4000-8000-${String(36+i*2+j+1).padStart(12,'0')}`,
  cardId:c.id,
  language:language as 'EN'|'JP',
  variant:c.code==='OP05-119'?'Manga Rare':c.code==='OP06-118'?'Manga Rare':(j===1?'Parallel art':'Standard'),
  set:c.setCode??'OP-05',
  assetSourceId:'30000000-0000-4000-8000-000000000007'
})));

export const printings:Printing[] = iconicPrintings;

export const cardFor=(printingId:string)=>cards.find(c=>c.id===printings.find(p=>p.id===printingId)?.cardId);
export const printingFor=(id:string,language='EN')=>printings.find(p=>p.cardId===id&&p.language===language)!;
export const colors:Record<string,string>={Red:'#df675e',Blue:'#62a5cd',Green:'#78ab78',Black:'#24272c',Yellow:'#dcb968',Purple:'#ad86ce'};

export const SETS_CATALOG = [
  { code: 'OP-09', name: 'Emperors in the New World', releaseYear: 2024, mainCount: 142, parallelCount: 34, totalIdentities: 142 },
  { code: 'OP-05', name: 'Awakening of the New Era', releaseYear: 2023, mainCount: 126, parallelCount: 28, totalIdentities: 126 },
  { code: 'OP-01', name: 'Romance Dawn', releaseYear: 2022, mainCount: 121, parallelCount: 24, totalIdentities: 121 },
  { code: 'OP-02', name: 'Paramount War', releaseYear: 2022, mainCount: 121, parallelCount: 24, totalIdentities: 121 },
  { code: 'OP-06', name: 'Flamboyant Rivals', releaseYear: 2024, mainCount: 126, parallelCount: 29, totalIdentities: 126 },
  { code: 'ST-01', name: 'Straw Hat Crew Starter', releaseYear: 2022, mainCount: 17, parallelCount: 4, totalIdentities: 17 },
] as const;
