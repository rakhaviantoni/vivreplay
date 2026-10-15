import test from 'node:test';
import assert from 'node:assert/strict';
import {paymentReminderDue,shippingReminderStage} from '../lib/market/reminder-windows';

const minute=60_000;
const hour=60*minute;

test('pending payment reminder is sent once inside the 45-minute window',()=>{
  assert.equal(paymentReminderDue(45*minute),true);
  assert.equal(paymentReminderDue(1),true);
  assert.equal(paymentReminderDue(45*minute+1),false);
  assert.equal(paymentReminderDue(0),false);
  assert.equal(paymentReminderDue(-minute),false);
});

test('seller receives a day-ahead or near-deadline reminder, never after the deadline',()=>{
  assert.equal(shippingReminderStage(24*hour+15*minute),'day');
  assert.equal(shippingReminderStage(12*hour),'day');
  assert.equal(shippingReminderStage(3*hour+15*minute),'soon');
  assert.equal(shippingReminderStage(10*minute),'soon');
  assert.equal(shippingReminderStage(24*hour+15*minute+1),null);
  assert.equal(shippingReminderStage(0),null);
  assert.equal(shippingReminderStage(-1),null);
});
