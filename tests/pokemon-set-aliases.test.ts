import assert from 'node:assert/strict';
import test from 'node:test';
import {pokemonSetFamily, pokemonPrintingMatchesPublicReference, pokemonSetFilter} from '../lib/pokemon-set-aliases';

test('MA6 deep links match their split 30th Celebration and 30th Classic catalog sets', () => {
  assert.equal(pokemonSetFamily('MA6', '008'), '30th-celebration');
  assert.equal(pokemonPrintingMatchesPublicReference('MA6', '008', '30TH', '008'), true);
  assert.equal(pokemonPrintingMatchesPublicReference('MA6', '008', '30th', '008'), true);
  assert.equal(pokemonPrintingMatchesPublicReference('MA6', '168', '30THC', '168'), true);
  assert.equal(pokemonPrintingMatchesPublicReference('MA6', '008', '30THC', '008'), false);
});

test('ordinary set deep links keep punctuation-insensitive matching', () => {
  assert.equal(pokemonPrintingMatchesPublicReference('SV11-W', '027', 'SV11W', '027'), true);
  assert.equal(pokemonPrintingMatchesPublicReference('SV11-W', '027', 'SV11W', '161'), false);
  assert.equal(pokemonPrintingMatchesPublicReference('SV11-W', '027', 'SV11A', '027'), false);
});

test('ordinary Pokemon set SQL parameters match the uppercase catalog expression', () => {
  const filter = pokemonSetFilter(['SV11-W']);
  assert.deepEqual(filter.values, ['SV11W']);
});
