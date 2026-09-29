import { test, expect } from '@playwright/test';

// Named to sort after smoke.spec.ts: one worker runs the files in order against one database,
// and smoke asserts the first-run "Plan your first week" link that planning removes.

/** Today's date as the server's settings see it (Asia/Karachi), in YYYY-MM-DD. */
const todayInKarachi = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());

test('plans a week: the nudge, three outcomes, a refused fourth, and a replace', async ({ page, request }) => {
  await page.goto('/plan');
  await expect(page.getByRole('heading', { level: 2, name: "This week's outcomes" })).toBeVisible();

  await page.getByLabel('Outcome', { exact: true }).fill('Work on supplier meetings');
  await expect(page.getByRole('note')).toHaveText('This sounds like an activity. What will exist when it is finished?');
  await expect(page.getByRole('button', { name: 'Add outcome 1' })).toBeDisabled();

  const choose = async (title: string, definition: string, button: string, category?: string) => {
    await page.getByLabel('Outcome', { exact: true }).fill(title);
    await page.getByLabel('Definition of done').fill(definition);
    if (category) await page.getByLabel('Category').selectOption({ label: category });
    await page.getByRole('button', { name: button }).click();
  };
  await choose('Supplier delivery plan confirmed', 'Dates confirmed for the top 20 suppliers', 'Add outcome 1');
  await expect(page.getByRole('button', { name: 'Add outcome 2' })).toBeVisible();
  await choose('Haleon purchase target finalised', 'Signed off by the commercial head', 'Add outcome 2');
  await expect(page.getByRole('button', { name: 'Add outcome 3' })).toBeVisible();
  await choose('Pinkbox P&L dashboard live', 'Shows live franchise data', 'Add outcome 3', 'Business');
  await expect(page.getByRole('heading', { level: 2, name: 'When will you actually work on these?' })).toBeVisible();
  await page.getByRole('button', { name: 'Done planning time' }).click();
  await expect(page.getByRole('heading', { level: 2, name: /^Week \d+ is planned\.$/ })).toBeVisible();

  const lookup = await (await request.get(`/api/exec/weeks?date=${todayInKarachi()}`)).json();
  const fourth = await request.post(`/api/exec/weeks/${lookup.data.current.week.id}/outcomes`, {
    data: { title: 'A fourth outcome', category: 'office' },
  });
  expect(fourth.status()).toBe(409);
  expect((await fourth.json()).code).toBe('WEEK_FULL');

  await page.goto('/week');
  await expect(page.getByRole('article')).toHaveCount(3);
  await page.getByRole('button', { name: 'Replace an outcome' }).click();
  await page.getByLabel('Outcome', { exact: true }).fill('Supplier risks identified');
  await page.getByRole('button', { name: 'Choose what it replaces' }).click();
  const picker = page.getByRole('form', { name: 'Replace an outcome' });
  await picker.getByRole('radio', { name: 'Haleon purchase target finalised' }).check();
  await picker.getByRole('button', { name: 'Replace' }).click();
  await expect(page.getByRole('article', { name: 'Supplier risks identified' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Haleon purchase target finalised' })).toHaveCount(0);

  await page.goto('/');
  await expect(page.getByRole('link', { name: '0 of 3 outcomes done' })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Plan (your first|this) week$/ })).toHaveCount(0);
});

test('creates a project and opens its page', async ({ page }) => {
  await page.goto('/projects');
  await page.getByRole('textbox', { name: 'Project name' }).fill('September supply plan');
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByRole('region', { name: 'Work' }).getByRole('link', { name: 'September supply plan' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'September supply plan' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Outcomes' })).toContainText('No outcomes yet.');
});
