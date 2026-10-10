import AxeBuilder from '@axe-core/playwright';
import {expect, test} from '@playwright/test';

const routes = ['/market', '/checkout/pro'];
const viewports = [
  {name: 'desktop', width: 1440, height: 1000},
  {name: 'mobile', width: 390, height: 844},
];

for (const route of routes) {
  for (const viewport of viewports) {
    test(`${route} has no axe violations at ${viewport.name} width`, async ({page}) => {
      await page.setViewportSize({width: viewport.width, height: viewport.height});
      if (route === '/market') {
        await page.route('**/api/listings', request => request.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({listings: []}),
        }));
      }
      await page.goto(route, {waitUntil: 'domcontentloaded'});
      await page.locator('main').waitFor({state: 'visible'});
      await page.getByRole('heading', {level: 1}).waitFor({state: 'attached'});

      const results = await new AxeBuilder({page})
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
        .analyze();

      const violations = results.violations.map(({id, impact, nodes}) => ({
        id,
        impact,
        nodes: nodes.map(node => ({target: node.target, checks: node.any.map(check => check.data)})),
      }));
      expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
    });
  }
}
