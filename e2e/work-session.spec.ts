import { test, expect } from '@playwright/test';

// These journeys run on the real clock: a block's timestamps come from the server, so a fixed browser
// clock would disagree with them. Whether the session is work or build depends on the hour the suite
// runs, so both of today's Must Ships exist and the assertions never name the context.
// The file sorts after week.spec.ts on purpose: the grid journey assigns blocks to the three outcomes it plans.

const WORK = 'Supplier tracker sent to the top 20';
const BUILD = 'Healify landing page live';
const NEXT = 'Call Bilal about the tracker';

/** Today's date in the server's time zone (Asia/Karachi), as YYYY-MM-DD. */
const todayInKarachi = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
const dayAfter = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
const seconds = (text: string | null) => {
  const [minutes, rest] = (text ?? '').replace('+', '').split(':').map(Number);
  return minutes * 60 + rest;
};

test('runs a session: the timer survives a reload and a pause, and Blocked files a waiting task', async ({ page, request }) => {
  const today = todayInKarachi();
  for (const [title, context] of [[WORK, 'work'], [BUILD, 'build']]) {
    const created = await request.post('/api/exec/must-ships', { data: { title, context, date: today, definitionOfDone: 'It exists' } });
    expect(created.status()).toBe(201);
  }

  await page.goto('/focus');
  const timer = page.getByRole('timer', { name: 'Time remaining' });
  await expect(timer).toBeVisible();
  const first = seconds(await timer.textContent());
  await expect.poll(async () => seconds(await timer.textContent()), { timeout: 10_000 }).toBeLessThan(first);
  const beforeReload = seconds(await timer.textContent());

  await page.reload();
  await expect(timer).toBeVisible();
  expect(seconds(await timer.textContent())).toBeLessThanOrEqual(beforeReload);

  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
  const frozen = await timer.textContent();
  await page.waitForTimeout(1500); // a paused timer must not move, and only elapsed time can show that it did not
  await expect(timer).toHaveText(frozen ?? '');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
  await expect(timer).toHaveText(frozen ?? '');
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();

  await page.getByRole('button', { name: 'Blocked' }).click();
  await page.getByLabel('What blocks it?').fill('Supplier has not replied');
  await page.getByLabel('Who owns the unblock?').fill('Bilal');
  await page.getByLabel('What is the next action?').fill(NEXT);
  await page.getByRole('button', { name: 'File the next action and stop' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();

  const waiting = (await (await request.get('/api/exec/tasks?status=waiting')).json()).data;
  expect(waiting).toEqual(expect.arrayContaining([expect.objectContaining({ title: NEXT, ownerName: 'Bilal', status: 'waiting', followUpDate: dayAfter(today) })]));
  const ships = (await (await request.get(`/api/exec/must-ships?date=${today}`)).json()).data as { status: string; blockerOwner: string | null; blockerNextAction: string | null }[];
  const blocked = ships.filter((ship) => ship.status === 'blocked');
  expect(blocked).toHaveLength(1);
  expect(blocked[0]).toMatchObject({ blockerOwner: 'Bilal', blockerNextAction: NEXT });
  const blocks = (await (await request.get(`/api/exec/deep-work?from=${today}&to=${today}`)).json()).data;
  expect(blocks).toHaveLength(1);
  expect(blocks[0]).toMatchObject({ result: 'blocked' });
  expect(blocks[0].endedAt).not.toBeNull();
});

test('assigns a suggested block to an outcome on the Week grid and shows the time on its card', async ({ page }) => {
  await page.goto('/week');
  const grid = page.getByRole('region', { name: 'Deep work', exact: true });
  await expect(grid).toBeVisible();
  await grid.getByRole('button', { name: /suggested$/ }).first().click();
  const outcome = page.getByLabel('Outcome', { exact: true });
  const options = await outcome.locator('option').allTextContents();
  expect(options.length).toBeGreaterThan(1);
  const chosen = options[1];
  await outcome.selectOption({ label: chosen });
  await page.getByRole('button', { name: 'Save block' }).click();
  await expect(page.getByRole('form', { name: 'Deep work block' })).toHaveCount(0);
  await expect(page.getByRole('article', { name: chosen })).toContainText('min planned');
});
