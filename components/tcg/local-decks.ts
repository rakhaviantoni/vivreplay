export type LocalDeck={
  id:string;
  title:string;
  leaderPrintingId?:string;
  leaderCode?:string;
  entries:Record<string,number>;
  artworkIds:Record<string,string>;
  updatedAt:string;
};

export const LOCAL_DECKS_KEY='vivreplay-local-decks-v1';
export const LOCAL_DRAFT_KEY='vivreplay-builder-draft-v1';

function parse(value:string|null):LocalDeck[]{
  if(!value)return [];
  try{const data=JSON.parse(value) as unknown;return Array.isArray(data)?data.filter((deck):deck is LocalDeck=>Boolean(deck&&typeof deck==='object'&&typeof (deck as LocalDeck).id==='string'&&typeof (deck as LocalDeck).entries==='object')):[];}catch{return [];}
}

export function readLocalDecks(){return typeof window==='undefined'?[]:parse(window.localStorage.getItem(LOCAL_DECKS_KEY));}
export function writeLocalDecks(decks:LocalDeck[]){if(typeof window!=='undefined')window.localStorage.setItem(LOCAL_DECKS_KEY,JSON.stringify(decks));}
export function readLocalDraft(){if(typeof window==='undefined')return undefined;return parse(window.localStorage.getItem(LOCAL_DRAFT_KEY))[0];}
export function writeLocalDraft(deck:LocalDeck){if(typeof window!=='undefined')window.localStorage.setItem(LOCAL_DRAFT_KEY,JSON.stringify([deck]));}
export function upsertLocalDeck(deck:LocalDeck){const decks=readLocalDecks();const index=decks.findIndex(item=>item.id===deck.id);if(index>=0)decks[index]=deck;else decks.unshift(deck);writeLocalDecks(decks);return deck;}
export function makeLocalDeckId(){return typeof crypto!=='undefined'&&'randomUUID' in crypto?crypto.randomUUID():`deck-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;}
