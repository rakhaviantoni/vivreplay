import test from 'node:test';
import assert from 'node:assert/strict';
import {uniquePrintingIds,matchingPrintingCopies,selectedPrintingCopy} from '../lib/market/printing-selection';

const copies=[{id:'english-copy',printingId:'en-standard'},{id:'japanese-copy',printingId:'jp-alt'}];
test('a stale copy from another language is never attached to the selected printing',()=>{
  assert.equal(selectedPrintingCopy(copies,'jp-alt','english-copy')?.id,'japanese-copy');
  assert.equal(selectedPrintingCopy(copies,'jp-standard','japanese-copy'),undefined);
  assert.deepEqual(matchingPrintingCopies(copies,''),[]);
});
test('duplicate IDs cannot create multiple selected options, distinct language printings remain',()=>{
  const options=uniquePrintingIds([{id:'en',language:'EN'},{id:'en',language:'EN'},{id:'jp',language:'JP'},{id:'JP',language:'JP'}]);
  assert.deepEqual(options.map(option=>option.id),['en','jp']);
});
