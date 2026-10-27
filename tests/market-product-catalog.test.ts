import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import path from 'node:path';
import accessories from '../packages/card-data/one-piece-accessories.json';
import {matchesSealedProductQuery,sealedProducts,sealedProductById,sealedDisplayCard,sealedProductPublicCode} from '../lib/market/sealed-products';
import {productConditionLabel,productConditionOptions,validProductCondition} from '../lib/market/product-conditions';

test('the requested official accessories are available for listing with local artwork',()=>{
  for(const code of ['SLEEVE037','SLEEVE047','SLEEVE045','TS04','SPC01','STORAGE008','CARD_COLLECTION_007','OFFICIAL-9POKET-BINDER001','PLAYMAT007','PLAYMAT_FLAME-FLAME-FRUIT']){
    const entries=accessories.filter(product=>product.code===code&&product.edition==='asia');
    assert.ok(entries.length,code);
    for(const entry of entries){
      const product=sealedProductById(entry.id);
      assert.ok(product,entry.id);
      assert.equal(sealedDisplayCard(entry.id)?.imageUrl,entry.imageUrl);
      assert.match(entry.imageUrl,/^\/products\/one-piece\//);
      assert.ok(existsSync(path.join(process.cwd(),'public',entry.imageUrl)),entry.imageUrl);
    }
  }
});

test('catalog products keep distinct identities and valid names across both editions',()=>{
  assert.equal(new Set(sealedProducts.map(product=>product.id)).size,sealedProducts.length);
  for(const product of sealedProducts){
    assert.ok(product.name.trim());
    assert.doesNotMatch(product.name,/Select Display Language|^PRODUCTS$|<[^>]+>/i);
    assert.ok(existsSync(path.join(process.cwd(),'public',product.imageUrl)),product.id);
  }
  const sleeves=accessories.filter(product=>product.code==='SLEEVE047'&&product.edition==='asia');
  assert.equal(sleeves.length,4);
  assert.equal(new Set(sleeves.map(product=>product.design)).size,4);
  assert.equal(new Set(sleeves.map(product=>product.imageUrl)).size,4);
});

test('product search accepts punctuation variations while public labels hide source slugs',()=>{
  assert.ok(matchesSealedProductQuery('OP15-EB04 Booster box','op15eb04'));
  assert.ok(matchesSealedProductQuery('Official Card Sleeves Gum-Gum Fruit','gum gum'));
  assert.equal(sealedProductPublicCode({setCode:'OFFICIAL-9POKET-BINDER001'}),'');
  assert.equal(sealedProductPublicCode({setCode:'TS04'}),'TS04');
});

test('accessory condition choices do not allow opened boosters to be listed as sealed products',()=>{
  for(const kind of ['SLEEVE','PLAYMAT','STORAGE','BINDER']){
    assert.ok(validProductCondition(kind,'USED_GOOD'));
    assert.ok(validProductCondition(kind,'NEW'));
  }
  for(const kind of ['BOOSTER_PACK','BOOSTER_BOX','STARTER_DECK','MINI_TIN']){
    assert.deepEqual(productConditionOptions(kind),['SEALED','SEALED_DAMAGED']);
    assert.equal(validProductCondition(kind,'USED_GOOD'),false);
  }
  assert.equal(validProductCondition('PLAYMAT','not-a-condition'),false);
  assert.equal(productConditionLabel('USED_GOOD','EN'),'Used, good condition');
  assert.equal(productConditionLabel('USED_GOOD','ID'),'Bekas, kondisi baik');
});
