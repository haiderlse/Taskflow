import { test, expect } from '@playwright/test';

test('Today opens with the first-week banner and a working API', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Plan your first week' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link')).toHaveText([
    'Today',
    'Week',
    'Inbox',
    'Projects',
    'Review',
  ]);
  await expect(page.getByRole('status')).toHaveCount(0);
});

test('the primary navigation reaches every screen', async ({ page }) => {
  await page.goto('/');
  for (const name of ['Week', 'Inbox', 'Projects', 'Review']) {
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name }).click();
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  }
});

test('the old workspace still renders at /legacy with no login screen', async ({ page }) => {
  await page.goto('/legacy');
  await expect(page.getByText('Home Dashboard')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /sign in|log in/i })).toHaveCount(0);
});
