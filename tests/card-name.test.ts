import {test} from 'node:test';
import assert from 'node:assert/strict';
import {displayCardName} from '../components/tcg/card-name';

test('card names collapse repeated source titles and repair an unmatched trailing quote',()=>{
  assert.equal(displayCardName('"Big Mama" Tagawa"Big Mama" Tagawa'),'"Big Mama" Tagawa');
  assert.equal(displayCardName('"Big Mama" Tagawa "Big Mama" Tagawa "Big Mama" Tagawa"'),'"Big Mama" Tagawa');
  assert.equal(displayCardName('"Big Mama" Tagawa"'),'"Big Mama" Tagawa');
});

test('card name cleanup preserves valid punctuation and removes redundant printing suffixes',()=>{
  assert.equal(displayCardName('"Big Mama" Tagawa'),'"Big Mama" Tagawa');
  assert.equal(displayCardName('Monkey D. Luffy (Alternate Art)','OP01-001'),'Monkey D. Luffy');
});
