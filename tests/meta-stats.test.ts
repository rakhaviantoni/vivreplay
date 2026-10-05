import assert from 'node:assert/strict';
import test from 'node:test';
import {filterMeta,inPeriod,leaderStats,matchup,type MetaFeed,type MetaMatch} from '../lib/meta-stats';

const match=(patch:Partial<MetaMatch>={}):MetaMatch=>({id:'one',eventId:'event',eventName:'Tournament',eventDate:'2026-09-19',round:'Final',bestOf:3,leaderOneCode:'OP14-020',leaderTwoCode:'OP15-058',archetypeOne:'Green Dracule Mihawk',archetypeTwo:'Purple Enel',playerOneName:null,playerTwoName:null,scoreOne:2,scoreTwo:1,winnerSide:1,seriesComplete:1,scoreComplete:1,summary:'',sourceUrl:'https://example.com/match',source:'tournament',...patch});
const feed=(records:MetaMatch[]):MetaFeed=>({records,events:[],deckCards:[],cards:[],asOf:'2026-10-04T12:00:00Z'});

test('partial series count played games without assigning a series winner',()=>{
  const records=[match({scoreOne:1,scoreTwo:1,winnerSide:0,seriesComplete:0,scoreComplete:0})];
  const stats=leaderStats(feed(records),records,[]);
  assert.equal(stats[0].games,2);assert.equal(stats[0].wins,1);assert.equal(stats[0].series,0);
  const pair=matchup(records,'OP14-020','OP15-058');
  assert.equal(pair.rate,.5);assert.equal(pair.series,0);
});

test('mirror variants merge under one leader and retain the actual game count',()=>{
  const records=[match({leaderOneCode:'OP15-058',archetypeOne:'Purple Enel · Frankie',archetypeTwo:'Purple Enel · Dogs'})];
  const stats=leaderStats(feed(records),records,[]);
  assert.equal(stats.length,1);assert.equal(stats[0].games,6);assert.equal(stats[0].wins,3);
  assert.equal(stats[0].playRate,1);
  const mirror=matchup(records,'OP15-058','OP15-058');
  assert.equal(mirror.games,3);assert.equal(mirror.series,1);assert.equal(mirror.rate,null);
});

test('matchup rates are reciprocal and never substitute a match result for a game score',()=>{
  const records=[match(),match({id:'two',scoreOne:0,scoreTwo:2,winnerSide:2})];
  const one=matchup(records,'OP14-020','OP15-058'),two=matchup(records,'OP15-058','OP14-020');
  assert.equal(one.games,5);assert.equal(one.wins,2);assert.equal(one.seriesWins,1);
  assert.equal(one.rate,.4);assert.equal(two.rate,.6);
});

test('date and ranked filters exclude tournament games outside their selection',()=>{
  const data=feed([match()]);
  const defaults={period:'all' as const,source:'all' as const,event:'all',color:'all',query:''};
  assert.equal(filterMeta(data,{...defaults,source:'ranked'}).records.length,0);
  assert.equal(filterMeta(data,{...defaults,period:'7'}).records.length,0);
  assert.equal(filterMeta(data,{...defaults,period:'30'}).records.length,1);
  assert.equal(inPeriod('2026-10-05','7',data.asOf),false);
});

test('a tournament finish with no played games has no win rate and no invented tier',()=>{
  const data=feed([]);
  const events=[{id:'event',name:'Tournament',eventDate:'2026-09-19',playerCount:null,sourceUrl:'https://example.com',finishes:[{id:'finish',place:1,playerName:'Player',leaderCode:'OP14-020',archetype:'Green Dracule Mihawk',deckSourceUrl:'https://example.com/deck',cards:50,cardCount:15}]}];
  const stats=leaderStats(data,[],events);
  assert.equal(stats[0].winRate,null);assert.equal(stats[0].games,0);
  assert.equal(stats[0].tier,'Small sample');assert.equal(stats[0].topFinishes,1);
});
