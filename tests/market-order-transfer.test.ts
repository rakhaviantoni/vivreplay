import test from 'node:test';
import assert from 'node:assert/strict';
import {sellerVaultDebits} from '../lib/market/order-transfer';

test('seller Vault debits aggregate each sold instance once across order lines',()=>{
  assert.deepEqual([...sellerVaultDebits([
    {instanceId:'instance-a',quantity:1},
    {instanceId:'instance-b',quantity:2},
    {instanceId:'instance-a',quantity:1},
    {quantity:1},
  ])],[['instance-a',2],['instance-b',2]]);
});

test('invalid quantities do not debit seller inventory',()=>{
  assert.deepEqual([...sellerVaultDebits([
    {instanceId:'instance-a',quantity:0},
    {instanceId:'instance-b',quantity:-1},
    {instanceId:'instance-c',quantity:1.5},
  ])],[]);
});
