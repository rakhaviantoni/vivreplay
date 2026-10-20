import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCatalogRange } from '../lib/card-catalog-query';

test('omitted HP bounds do not become zero filters', () => {
  assert.equal(parseCatalogRange(null), undefined);
  assert.equal(parseCatalogRange(''), undefined);
  assert.equal(parseCatalogRange('   '), undefined);
});

test('explicit HP bounds preserve zero and valid values only', () => {
  assert.equal(parseCatalogRange('0'), 0);
  assert.equal(parseCatalogRange('120'), 120);
  assert.equal(parseCatalogRange('1000'), undefined);
  assert.equal(parseCatalogRange('-1'), undefined);
  assert.equal(parseCatalogRange('12x'), undefined);
});
