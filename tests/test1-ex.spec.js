import { test, expect } from '@playwright/test';

test('home → get started', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Playwright/);
  await page.getByRole('link', { name: 'Get started' }).click();
  await expect(page).toHaveURL(/.*intro/);
});
