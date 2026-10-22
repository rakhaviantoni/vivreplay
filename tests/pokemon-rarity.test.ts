import assert from 'node:assert/strict';
import test from 'node:test';
import {pokemonRarityLabel} from '../lib/pokemon-rarity';

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

test('Pokemon rarity labels preserve unrecognized values and omit missing values',()=>{
  assert.equal(pokemonRarityLabel('Rare Holo LV.X'),'LV.X');
  assert.equal(pokemonRarityLabel('Secret Rare'),'SR');
  assert.equal(pokemonRarityLabel(null),'');
  assert.equal(pokemonRarityLabel('unknown'),'');
});
