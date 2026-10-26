import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import path from 'node:path';
import products from '../packages/card-data/one-piece-products.json';
import {findSetProduct,productCodeForLanguage} from '../lib/one-piece-products';

test('language switching selects the matching regional product without fallback',()=>{
  assert.equal(productCodeForLanguage('OP15-EB04','JP'),'OP15');
  assert.equal(productCodeForLanguage('OP15','EN'),'OP15-EB04');
  assert.equal(findSetProduct('OP15-EB04','JP')?.edition,'asia');
  assert.equal(findSetProduct('OP15','EN')?.edition,'global');
  assert.equal(findSetProduct('ST30','JP')?.images.pack,'/products/one-piece/asia/st30/pack.webp');
  assert.equal(findSetProduct('ST30','EN')?.images.pack,'/products/one-piece/global/st30/pack.webp');
  assert.equal(findSetProduct('NOT-A-SET','EN'),undefined);
});

test('regional OP15 products retain their separate release and contents',()=>{
  const global=products.find(row=>row.code==='OP15-EB04'&&row.edition==='global');
  const asia=products.find(row=>row.code==='OP15'&&row.edition==='asia');
  assert.ok(global&&asia);
  assert.match(global.facts['Release Date']??'',/April 3, 2026/);
  assert.match(asia.facts['Release Date']??'',/February 28, 2026/);
  assert.match(global.facts.Contents??'',/159/);
  assert.match(asia.facts.Contents??'',/125/);
  assert.notEqual(global.images.pack,asia.images.pack);
});

test('product keys are unique and every published asset exists locally',()=>{
  const keys=products.map(row=>`${row.edition}:${row.code}`);
  assert.equal(keys.length,new Set(keys).size);
  for(const product of products){
    assert.ok(product.images.pack,`${product.edition} ${product.code} package image`);
    assert.match(product.sourceUrl,/^https:\/\/(?:en|asia-en)\.onepiece-cardgame\.com\//);
    for(const image of Object.values(product.images)){
      assert.ok(image.startsWith('/products/one-piece/'));
      assert.ok(existsSync(path.join(process.cwd(),'public',image)),image);
    }
  }
});
