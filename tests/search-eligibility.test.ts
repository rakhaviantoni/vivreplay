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
