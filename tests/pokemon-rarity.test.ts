import assert from 'node:assert/strict';
import test from 'node:test';
import {pokemonPrintingRarity, pokemonRarityLabel} from '../lib/pokemon-rarity';
import {pokemonArtRoute} from '../lib/pokemon-art-route';

test('Pokemon rarity labels use the same short forms across library and market',()=>{
  assert.equal(pokemonRarityLabel('Double rare'),'RR');
  assert.equal(pokemonRarityLabel('Ultra Rare'),'UR');
  assert.equal(pokemonRarityLabel('Special Illustration Rare','EN'),'SIR');
  assert.equal(pokemonRarityLabel('Special Illustration Rare','JP'),'SAR');
  assert.equal(pokemonRarityLabel('Illustration rare','EN'),'IR');
  assert.equal(pokemonRarityLabel('Illustration rare','JP'),'AR');
  assert.equal(pokemonRarityLabel('One Star','EN'),'IR');
  assert.equal(pokemonRarityLabel('One Star','JP'),'AR');
  assert.equal(pokemonRarityLabel('Two Star','EN'),'SIR');
  assert.equal(pokemonRarityLabel('Double Star','JP'),'SAR');
  assert.equal(pokemonRarityLabel('Hyper Rare'),'HR');
});

test('known Japanese printings use their set rarity when source rarity is missing or wrong',()=>{
  const cases=[
    ['sv8a','217','SAR'],['sv4a','327','SSR'],['sv2a','331','SSR'],['sv4a','349','SAR'],
    ['sv3s','098','RR'],['sv3s','203','SR'],['sv3s','220','SAR'],
    ['sv5s','088','RR'],['sv5s','175','SR'],['sv3s','101','U'],
  ] as const;
  for (const [set,number,rarity] of cases) {
    assert.equal(pokemonPrintingRarity('unknown','JP',set,number),rarity,`${set} ${number}`);
    assert.equal(pokemonPrintingRarity('Common','JP',set,number),rarity,`${set} ${number} overrides stale source data`);
  }
});

test('Pokemon rarity labels preserve unrecognized values and omit missing values',()=>{
  assert.equal(pokemonRarityLabel('Rare Holo LV.X'),'LV.X');
  assert.equal(pokemonRarityLabel('Secret Rare'),'SR');
  assert.equal(pokemonRarityLabel(null),'');
  assert.equal(pokemonRarityLabel('unknown'),'');
});

test('Pokemon artwork routes use catalog set and printing identifiers for each language',()=>{
  assert.equal(pokemonArtRoute('JP','sv4a','327'),'/sv4a/jp/327.webp');
  assert.equal(pokemonArtRoute('JA','sv5s','088'),'/sv5s/jp/088.webp');
  assert.equal(pokemonArtRoute('ID','sv8a','217'),'/sv8a/id/217.webp');
  assert.equal(pokemonArtRoute('EN','sv2a','331'),'/sv2a/en/331.webp');
  assert.equal(pokemonArtRoute('ID','S6a','073/069','fbf45d27-b735-5928-9fa9-63ca65c7bbd1'),'/S6a/id/073.webp?printingId=fbf45d27-b735-5928-9fa9-63ca65c7bbd1');
  assert.equal(pokemonArtRoute('JP','../sv4a','327'),'');
});
