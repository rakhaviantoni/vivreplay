import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeSlabLabelStyle,slabLabelStyleFromSubgrades} from '../lib/market/slab-label-style';

test('EGS Clear label style is read from stored subgrades JSON or objects', () => {
  assert.equal(slabLabelStyleFromSubgrades('{"__labelStyle":"clear","Centering":10}'),'clear');
  assert.equal(slabLabelStyleFromSubgrades({__labelStyle:'CLEAR'}),'clear');
});

test('slabs without a Clear style or with unreadable subgrades stay Standard', () => {
  assert.equal(slabLabelStyleFromSubgrades(null),'standard');
  assert.equal(slabLabelStyleFromSubgrades('not json'),'standard');
  assert.equal(slabLabelStyleFromSubgrades({Centering:9}),'standard');
});

test('stored listing label styles are only accepted when valid', () => {
  assert.equal(normalizeSlabLabelStyle('clear'),'clear');
  assert.equal(normalizeSlabLabelStyle('standard'),'standard');
  assert.equal(normalizeSlabLabelStyle('glass'),undefined);
  assert.equal(normalizeSlabLabelStyle(undefined),undefined);
});
