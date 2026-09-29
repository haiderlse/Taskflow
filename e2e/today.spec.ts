import { test, expect } from '@playwright/test';

// A fixed browser clock makes Today's moment deterministic: Tuesday 2 March 2027, 09:00 in Karachi.
// The date is far from any week week.spec.ts plans, and one worker runs the files in order on one database.
// Playwright matches role names by substring unless told otherwise, so "Must Ship" is exact where other regions share the words.
const TUESDAY_0900 = new Date('2027-03-02T04:00:00Z');
const DATE = '2027-03-02';
const NUDGE = 'This sounds like an activity. What will exist when it is finished?';
const SECONDARIES = ['Price list sent to Hilal', 'Dashboard numbers checked', 'Venue booked for the offsite'];
const DEFAULT_SCHEDULE = {
  workDays: [1, 2, 3, 4, 5],
  deepWorkStart: '08:35',
  deepWorkMinutes: 90,
  shutdownTime: '17:00',
  officeStart: '08:15',
  officeEnd: '18:00',
  buildBlocks: [
    { weekday: 2, start: '06:30', minutes: 50 },
    { weekday: 4, start: '06:30', minutes: 50 },
    { weekday: 6, start: '09:00', minutes: 180 },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(TUESDAY_0900);
});

test('chooses the Must Ship, refuses a second, and holds two secondaries', async ({ page, request }) => {
  for (const title of SECONDARIES) await request.post('/api/exec/tasks', { data: { title, context: 'work' } });

  await page.goto('/');
  const choose = page.getByRole('region', { name: "Choose today's Must Ship" });
  await expect(choose).toBeVisible();
  const title = choose.getByLabel('Must Ship', { exact: true });
  await title.fill('Follow up with suppliers');
  await expect(choose.getByRole('note')).toHaveText(NUDGE);
  await title.fill('Delivery tracker sent to the top 20');
  await choose.getByLabel('Definition of done').fill('Sent and acknowledged by all 20');
  await choose.getByRole('button', { name: 'Set Must Ship' }).click();

  const card = page.getByRole('region', { name: 'Must Ship', exact: true });
  await expect(card.getByRole('heading', { level: 2, name: 'Delivery tracker sent to the top 20' })).toBeVisible();
  await expect(card.getByRole('link', { name: 'Start deep work' })).toHaveAttribute('href', '/focus');

  const second = await request.post('/api/exec/must-ships', { data: { title: 'Another one', context: 'work', date: DATE } });
  expect(second.status()).toBe(409);
  expect((await second.json()).code).toBe('DAY_TAKEN');

  const secondary = page.getByRole('region', { name: 'Secondary' });
  for (const name of SECONDARIES.slice(0, 2)) {
    await secondary.getByRole('button', { name: 'Add a secondary' }).click();
    await secondary.getByRole('list', { name: 'Choose a secondary' }).getByRole('button', { name }).click();
    await expect(secondary.getByRole('checkbox', { name })).toBeVisible();
  }
  await expect(secondary.getByRole('button', { name: 'Add a secondary' })).toHaveCount(0);

  const tasks = (await (await request.get('/api/exec/tasks')).json()).data as { id: string; title: string }[];
  const ids = SECONDARIES.map((name) => tasks.find((task) => task.title === name)?.id);
  const third = await request.put(`/api/exec/days/${DATE}/slots`, { data: { taskIds: ids } });
  expect(third.status()).toBe(400);
  expect((await third.json()).code).toBe('SLOT_LIMIT');
});

test('moves through the day: Build before the office, Close the day after shutdown time', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-03-02T01:00:00Z'));
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Build' })).toContainText('Build block 06:30 · 50 min');

  await page.clock.setFixedTime(new Date('2027-03-02T12:30:00Z'));
  await page.reload();
  await expect(page.getByRole('link', { name: 'Close the day' })).toHaveAttribute('href', '/shutdown');
  await expect(page.getByRole('region', { name: 'Must Ship', exact: true })).toContainText('Delivery tracker sent to the top 20');
});

test('edits the schedule and Today follows it', async ({ page, request }) => {
  await page.goto('/settings');
  await page.getByRole('checkbox', { name: 'Tuesday' }).uncheck();
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByText('Settings saved.')).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Build' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Must Ship', exact: true })).toHaveCount(0);

  const restored = await request.put('/api/exec/settings', { data: DEFAULT_SCHEDULE });
  expect(restored.status()).toBe(200);
});
