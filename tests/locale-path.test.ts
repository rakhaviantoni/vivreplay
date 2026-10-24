import assert from 'node:assert/strict';
import test from 'node:test';
import {localeFromPath, localeHref} from '../lib/locale-path';

test('Indonesian page links keep the locale across public sections', () => {
  for (const path of ['/about', '/cards', '/pokemon/cards', '/vault', '/profile', '/market/ABC123', '/checkout/order/123', '/legal/terms', '/help']) {
    assert.equal(localeHref(path, 'ID'), `/id${path}`);
    assert.equal(localeHref(`/id${path}`, 'ID'), `/id${path}`);
    assert.equal(localeHref(`/id${path}`, 'EN'), path);
  }
});

test('language changes preserve query parameters and anchors, including the homepage', () => {
  assert.equal(localeHref('/market?game=pokemon&q=keldeo%20ex#cards', 'ID'), '/id/market?game=pokemon&q=keldeo%20ex#cards');
  assert.equal(localeHref('/id?game=pokemon#top', 'EN'), '/?game=pokemon#top');
  assert.equal(localeHref('/?game=pokemon#top', 'ID'), '/id?game=pokemon#top');
  assert.equal(localeHref('/id', 'ID'), '/id');
  assert.equal(localeHref('/players/rakha.viantoni', 'ID'), '/id/players/rakha.viantoni');
});

test('assets, API calls, callbacks and external destinations are never localized', () => {
  for (const href of ['/api/checkout/orders/mine', '/admin/emails', '/assets/logo.png', '/ST18/jp/ST18-004.webp', '/pokemon/art/id/S8a/201', '/auth/callback', 'https://ipaymu.com/payment', '//example.com/path', 'mailto:support@vivreplay.com', '#details', '?lang=JP']) {
    assert.equal(localeHref(href, 'ID'), href);
  }
});

test('locale detection matches an entire path segment', () => {
  for (const path of ['/id', '/id/about', '/id?game=pokemon']) assert.equal(localeFromPath(path), 'ID');
  for (const path of ['/', '/ideas', '/identity', '/cards?lang=ID']) assert.equal(localeFromPath(path), 'EN');
});
