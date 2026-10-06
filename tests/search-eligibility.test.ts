import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchesSearch} from '../packages/domain/search-eligibility';
const restriction={alternatives:[{name:'Monkey.D.Luffy'},{color:'red',cardType:'Event'}]};
test('Boa search accepts named Luffy of any colour and red Events only',()=>{
 assert.equal(matchesSearch({name:'Monkey.D.Luffy',color:'Purple',type:'Character'},restriction),true);
 assert.equal(matchesSearch({name:'Event',color:'Red',type:'Event'},restriction),true);
 assert.equal(matchesSearch({name:'Koala',color:'Red',type:'Character'},restriction),false);
 assert.equal(matchesSearch({name:'Event',color:'Blue',type:'Event'},restriction),false);
});
test('rules-name aliases qualify as the printed card name in searches',()=>{
 const alias={name:'Tony Tony.Chopper alternate printing',type:'Character',color:'Blue',effectText:"Also treat this card's name as [Tony Tony.Chopper] according to the rules."};
 assert.equal(matchesSearch(alias,{name:'Tony Tony.Chopper'}),true);
 assert.equal(matchesSearch(alias,{excludeName:'Tony Tony.Chopper'}),false);
 assert.equal(matchesSearch({...alias,effectText:''},{name:'Tony Tony.Chopper'}),false);
});
test('designated-event Leaders match printed name, trait, and card-type search restrictions',()=>{
 const luffy={name:'Monkey.D.Luffy (Release Event Leader)',type:'Leader',color:'Red',effectText:'This Leader can only be used in designated events according to the rules. This Leader is treated as a card with all card names, types, and attributes according to the rules.'};
 assert.equal(matchesSearch(luffy,{name:'Nami',trait:'Straw Hat Crew',cardType:'Event'}),true);
 assert.equal(matchesSearch({...luffy,effectText:''},{name:'Nami'}),false);
});
