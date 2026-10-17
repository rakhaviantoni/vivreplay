import assert from 'node:assert/strict';
import test from 'node:test';
import {formatDeliveryAddress} from '../lib/market/address-format';

test('delivery address omits locality fields already included in the street line',()=>{
  const address=formatDeliveryAddress([
    'Gg. Glagah 183A, Warungboto, Umbulharjo, Yogyakarta',
    'Special Region of Yogyakarta',
    'Yogyakarta',
    'Warungboto',
    'Warungboto',
    'Yogyakarta',
    '55164',
  ]);
  assert.equal(address,'Gg. Glagah 183A, Warungboto, Umbulharjo, Yogyakarta, 55164');
});

test('delivery address removes repeated values without modifying saved fields',()=>{
  const addressLine='Jl. Sample 12';
  assert.equal(formatDeliveryAddress([addressLine,'Jakarta','Jakarta','12345']),'Jl. Sample 12, Jakarta, 12345');
  assert.equal(addressLine,'Jl. Sample 12');
});
