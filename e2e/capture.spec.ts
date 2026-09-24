import { test, expect, devices } from '@playwright/test';
import { BASE_URL } from './ports';

const CAPTURED = 'Captured. It is in the Inbox, not on Today.';

test('a capture on the phone appears in the desktop Inbox when its tab regains focus', async ({ page, browser }) => {
  await page.goto('/inbox');
  await expect(page.getByText('Inbox zero.')).toBeVisible();

  const phone = await browser.newContext({ ...devices['Pixel 7'], baseURL: BASE_URL });
  const phonePage = await phone.newPage();
  await phonePage.goto('/capture');
  await phonePage.getByRole('textbox', { name: 'Capture' }).fill('Call the supplier');
  await phonePage.keyboard.press('Enter');
  await expect(phonePage.getByRole('status')).toHaveText(CAPTURED);
  await expect(phonePage.getByText('1 in inbox')).toBeVisible();
  await expect(phonePage.getByRole('list', { name: 'Recent captures' })).toContainText('Call the supplier');
  await phone.close();

  // TanStack Query's focus manager listens for visibilitychange on the window.
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByRole('option').filter({ hasText: 'Call the supplier' })).toBeVisible();
  await expect(page.getByText('1 to process')).toBeVisible();

  // Leave the inbox empty for the next journey.
  await page.keyboard.press('x');
  await expect(page.getByText('Inbox zero.')).toBeVisible();
});

test('captures from Today and processes them with the keys', async ({ page }) => {
  await page.goto('/');
  const bar = page.getByRole('textbox', { name: 'Capture' });
  for (const title of ['Approve pricing', 'Review Haleon target', 'Chase the courier']) {
    await bar.fill(title);
    await bar.press('Enter');
    await expect(bar).toHaveValue('');
  }

  await page.goto('/inbox');
  await expect(page.getByText('3 to process')).toBeVisible();
  const options = page.getByRole('option');
  await expect(options).toHaveText([/Chase the courier/, /Review Haleon target/, /Approve pricing/]);

  await page.keyboard.press('t');
  await expect(page.getByText('2 to process')).toBeVisible();
  await expect(options.filter({ hasText: 'Chase the courier' })).toHaveCount(0);

  await page.keyboard.press('l');
  await expect(page.getByText('1 to process')).toBeVisible();

  await page.keyboard.press('x');
  await expect(page.getByText('Inbox zero.')).toBeVisible();

  await page.getByRole('tab', { name: 'Later' }).click();
  await expect(page.getByText('1 parked')).toBeVisible();
  await expect(page.getByRole('option')).toHaveText([/Review Haleon target/]);
});

test('serves the home-screen manifest', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBeTruthy();
  expect(await res.json()).toMatchObject({ start_url: '/capture', display: 'standalone' });
});
