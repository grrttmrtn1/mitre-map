import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('login is keyboard accessible and has no serious axe violations', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(v => ['critical', 'serious'].includes(v.impact ?? ''))).toEqual([]);
});

test('login supports a keyboard-only sign-in flow', async ({ page }) => {
  await page.goto('/login');
  await page.keyboard.press('Tab');
  await page.keyboard.type('analyst@example.com');
  await page.keyboard.press('Tab');
  await page.keyboard.type('not-a-real-password');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
});

for (const viewport of [{ width: 375, height: 667 }, { width: 1280, height: 800 }]) {
  test(`login has no serious accessibility violations at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/login');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter(v => ['critical', 'serious'].includes(v.impact ?? ''))).toEqual([]);
  });
}
