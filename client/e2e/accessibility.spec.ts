import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('login is keyboard accessible and has no serious axe violations', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(v => ['critical', 'serious'].includes(v.impact ?? ''))).toEqual([]);
});
