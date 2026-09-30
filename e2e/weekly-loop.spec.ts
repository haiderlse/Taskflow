import { test, expect, type Page } from '@playwright/test';

// The full weekly loop on a fixed browser clock in June 2027, far from every other journey's dates, so it can share
// the run's database. The server stamps its own clock, so this journey asserts only what follows from dates: the
// Must Ships, the strip, the grades and the carry-over, never the timestamp counts (rolled, killed, delegated).
const SUNDAY_1000 = new Date('2027-06-06T05:00:00Z'); // Karachi is UTC+5
const MONDAY_1730 = new Date('2027-06-07T12:30:00Z');
const FRIDAY_1600 = new Date('2027-06-11T11:00:00Z');
const NEXT_SUNDAY_1000 = new Date('2027-06-13T05:00:00Z');
const MONDAY = '2027-06-07';
const OUTCOMES = ['Warehouse audit closed', 'Distributor terms signed', 'Healify beta shipped'];
const MUST_SHIP = 'Audit findings sent to the COO';
const MEMO = 'Pricing memo for the distributors';

async function choose(page: Page, title: string, definition: string, button: string, category?: string) {
  await page.getByLabel('Outcome', { exact: true }).fill(title);
  await page.getByLabel('Definition of done').fill(definition);
  if (category) await page.getByLabel('Category').selectOption({ label: category });
  await page.getByRole('button', { name: button }).click();
}

async function planTheWeek(page: Page) {
  await page.clock.setFixedTime(SUNDAY_1000);
  await page.goto('/plan');
  await expect(page.getByRole('heading', { level: 2, name: "This week's outcomes" })).toBeVisible();
  await choose(page, OUTCOMES[0], 'Every finding closed or owned', 'Add outcome 1');
  await expect(page.getByRole('button', { name: 'Add outcome 2' })).toBeVisible();
  await choose(page, OUTCOMES[1], 'Signed by both sides', 'Add outcome 2');
  await expect(page.getByRole('button', { name: 'Add outcome 3' })).toBeVisible();
  await choose(page, OUTCOMES[2], 'Ten beta users active', 'Add outcome 3', 'Business');
  await page.getByRole('button', { name: 'Done planning time' }).click();
  const monday = page.getByRole('region', { name: 'Next Must Ship' });
  await expect(monday.getByRole('heading', { name: 'Must Ship for Monday 7 June' })).toBeVisible();
  await monday.getByLabel('Must Ship', { exact: true }).fill(MUST_SHIP);
  await monday.getByLabel('Definition of done').fill('Sent with owners and dates');
  await monday.getByRole('button', { name: 'Set Must Ship' }).click();
  await expect(monday.getByText(MUST_SHIP)).toBeVisible();
}

async function shutDownMonday(page: Page) {
  await page.clock.setFixedTime(MONDAY_1730);
  await page.goto('/');
  await page.getByRole('link', { name: 'Close the day' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Shutdown' })).toBeVisible();
  const grade = page.getByRole('region', { name: 'What shipped today?' });
  await grade.getByRole('button', { name: 'Partial' }).click();
  await expect(grade.getByRole('checkbox', { name: 'Roll to Tuesday 8 June' })).toBeChecked();
  await grade.getByRole('button', { name: 'Save' }).click();

  const open = page.getByRole('region', { name: 'What remains open?' });
  await open.getByRole('button', { name: `Move "${MEMO}" to tomorrow` }).click();
  // Earlier journeys in this run left delegated items whose follow-up dates have passed by June 2027: answer each.
  const received = open.getByRole('button', { name: /^Received "/ });
  for (let left = await received.count(); left > 0; left = await received.count()) {
    await received.first().click();
    await expect(received).toHaveCount(left - 1);
  }
  const next = open.getByRole('button', { name: "Next: tomorrow's Must Ship" });
  await expect(next).toBeEnabled();
  await next.click();

  const tomorrow = page.getByRole('region', { name: "Tomorrow's Must Ship" });
  await expect(tomorrow.getByText(MUST_SHIP)).toBeVisible();
  await expect(tomorrow.getByText('Rolled forward once')).toBeVisible();
  await tomorrow.getByRole('button', { name: 'Continue' }).click();
  const secondaries = page.getByRole('region', { name: "Tomorrow's secondaries" });
  await secondaries.getByRole('button', { name: 'Add a secondary' }).click();
  await secondaries.getByRole('list', { name: 'Choose a secondary' }).getByRole('button', { name: MEMO }).click();
  await expect(secondaries.getByRole('checkbox', { name: MEMO })).toBeVisible();
  await secondaries.getByRole('button', { name: 'Close the day' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Tomorrow is ready' })).toBeVisible();
  await expect(page.getByText(`Tuesday 8 June: ${MUST_SHIP}`)).toBeVisible();
}

async function reviewFriday(page: Page) {
  await page.clock.setFixedTime(FRIDAY_1600);
  await page.goto('/review');
  const board = page.getByRole('region', { name: 'Scoreboard' });
  await expect(board.locator('dd').nth(1)).toHaveText('0 of 2');
  await expect(page.getByRole('list', { name: 'Day strip' }).getByRole('listitem')).toHaveText([
    'Mon · Partial',
    'Tue · Planned',
    'Wed · None',
    'Thu · None',
    'Fri · None',
  ]);
  const review = page.getByRole('region', { name: 'Friday review' });
  let form = review.getByRole('form', { name: `Review "${OUTCOMES[0]}"` });
  await form.getByRole('radio', { name: 'Done' }).check();
  await form.getByRole('button', { name: 'Save grade' }).click();
  form = review.getByRole('form', { name: `Review "${OUTCOMES[1]}"` });
  await form.getByRole('radio', { name: 'Partial' }).check();
  await form.getByLabel('Why did it slip?').selectOption({ label: 'Priority changed' });
  await form.getByRole('radio', { name: 'Roll into next week' }).check();
  await form.getByRole('button', { name: 'Save grade' }).click();
  form = review.getByRole('form', { name: `Review "${OUTCOMES[2]}"` });
  await form.getByRole('radio', { name: 'Missed' }).check();
  await form.getByRole('radio', { name: 'Kill' }).check();
  await form.getByRole('button', { name: 'Save grade' }).click();
  await review.getByRole('button', { name: 'Review done' }).click();
  await expect(review.getByText('Reviewed.')).toBeVisible();
  await expect(board.locator('dd').first()).toHaveText('1 of 3');
}

test('runs the weekly loop: plan, shut down, review, and carry forward', async ({ page, request }) => {
  await planTheWeek(page);

  const memo = (await (await request.post('/api/exec/tasks', { data: { title: MEMO, context: 'work' } })).json()).data;
  const scheduled = await request.patch(`/api/exec/tasks/${memo.id}`, { data: { status: 'this_week', scheduledDate: MONDAY } });
  expect(scheduled.status()).toBe(200);
  const early = await request.post(`/api/exec/days/${MONDAY}/shutdown`, { data: {} });
  expect(early.status()).toBe(409);
  expect((await early.json()).code).toBe('SHUTDOWN_NOT_READY');

  await shutDownMonday(page);
  await reviewFriday(page);

  await page.clock.setFixedTime(NEXT_SUNDAY_1000);
  await page.goto('/plan');
  await expect(page.getByRole('heading', { level: 2, name: 'Last week' })).toBeVisible();
  await expect(page.getByText('Last week: 1 of 3 outcomes · 0 of 2 Must Ships · 0 min deep work')).toBeVisible();
  await expect(page.getByRole('button', { name: `Carry "${OUTCOMES[1]}" into this week` })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Carry "/ })).toHaveCount(1);
});
