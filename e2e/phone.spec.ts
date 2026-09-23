import { test, expect } from '@playwright/test';

test('the capture page stands alone at phone width', async ({ page }) => {
  await page.goto('/capture');
  await expect(page.getByRole('heading', { level: 1, name: 'Capture' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(0);
});

test('Today shows its navigation as a bottom bar on a phone', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await expect(nav).toBeVisible();
  const box = await nav.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.y + box!.height).toBeGreaterThan(viewport!.height - 2);
});
