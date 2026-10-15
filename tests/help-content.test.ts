import assert from 'node:assert/strict';
import test from 'node:test';
import {helpArticles, helpCategories} from '../lib/help/articles';

test('help articles have unique slugs, localized copy, and valid category references', () => {
  const slugs = new Set(helpArticles.map((article) => article.slug));
  const categoryIds: ReadonlySet<string> = new Set(helpCategories.map((category) => category.id));
  assert.equal(slugs.size, helpArticles.length, 'article slugs should be unique');
  for (const article of helpArticles) {
    assert.ok(categoryIds.has(article.category), `${article.slug} uses a known category`);
    for (const locale of ['en', 'id'] as const) {
      assert.ok(article.title[locale].trim(), `${article.slug} has a ${locale} title`);
      assert.ok(article.summary[locale].trim(), `${article.slug} has a ${locale} summary`);
      assert.ok(article.sections[locale].length, `${article.slug} has ${locale} instructions`);
      assert.ok(article.action.label[locale].trim(), `${article.slug} has a ${locale} action`);
    }
    for (const relatedSlug of article.related) {
      assert.ok(slugs.has(relatedSlug), `${article.slug} links to an existing article`);
    }
  }
});

test('order-problem guidance matches the current dispute window and evidence flow', () => {
  const article = helpArticles.find(({slug}) => slug === 'report-a-market-order-problem');
  assert.ok(article);
  for (const locale of ['en', 'id'] as const) {
    const text = article.sections[locale].flatMap((section) => [
      section.heading,
      ...(section.paragraphs ?? []),
      ...(section.steps ?? []),
      ...(section.bullets ?? []),
      section.note ?? '',
    ]).join(' ').toLowerCase();
    assert.match(text, /48 hours|48 jam/);
    assert.match(text, /video/);
    assert.match(text, /photos|foto/);
    assert.match(text, /order|pesanan/);
  }
});
