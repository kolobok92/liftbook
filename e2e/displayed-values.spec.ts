import { expect, openWith, pplua, test, tid, workout, typeSet } from './helpers';

/**
 * Checks the numbers the user actually reads, using data chosen to break naive formatting:
 * fractional plates (22.5, 52.5), a set with less volume but a higher e1RM, and a warm-up
 * heavier than any working set.
 */
const INCLINE = 'incline-chest-press-machine';
const LATERAL = 'lateral-raise-cable';
const before = workout({
  name: 'Push',
  daysAgo: 7,
  programRef: pplua(0),
  exercises: [
    { exerciseId: LATERAL, sets: [{ weight: 20, reps: 12 }] },
    { exerciseId: INCLINE, sets: [{ weight: 170, reps: 8 }] },
  ],
});
const after = workout({
  name: 'Push',
  daysAgo: 1,
  programRef: pplua(0),
  exercises: [
    { exerciseId: LATERAL, sets: [{ weight: 22.5, reps: 12 }, { weight: 52.5, reps: 2, type: 'warmup' }] },
    { exerciseId: INCLINE, sets: [{ weight: 170, reps: 8 }, { weight: 180, reps: 7 }] },
  ],
});

test.describe('displayed values', () => {
  test('summary after finishing: exact PR weight and true best set', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await openWith(page, { history: [before] });
    await tid(page, 'start-next-workout').click();
    await typeSet(page, 'weight-0-0', '22.5');
    await typeSet(page, 'reps-0-0', '12');
    await tid(page, 'check-0-0').click();
    await typeSet(page, 'weight-1-0', '170');
    await typeSet(page, 'reps-1-0', '8');
    await tid(page, 'check-1-0').click();
    await typeSet(page, 'weight-1-1', '180');
    await typeSet(page, 'reps-1-1', '7');
    await tid(page, 'check-1-1').click();
    await tid(page, 'finish-workout').click();

    const prs = tid(page, 'summary-prs');
    await expect(prs).toContainText('22.5 lb');
    await expect(prs).not.toContainText('23 lb');
    await expect(prs).toContainText('180 lb');
    await expect(page.getByText('180lb × 7')).toBeVisible();
    await expect(page.getByText('170lb × 8')).toHaveCount(0);
  });

  test('history card, workout detail and exercise records show logged weights exactly', async ({ page }) => {
    await openWith(page, { history: [before, after] });
    await page.getByText('History', { exact: true }).last().click();
    const card = tid(page, `history-card-${after.id}`);
    await expect(card).toContainText('22.5lb × 12'); // warm-up 52.5×2 isn't the best set
    await expect(card).toContainText('180lb × 7');

    await card.click();
    await expect(page.getByText('22.5lb × 12').last()).toBeVisible();
    await expect(page.getByText('52.5lb × 2').last()).toBeVisible(); // warm-up still listed
    await page.goBack();

    await page.getByText('Analytics', { exact: true }).last().click();
    await tid(page, 'open-exercises').click();
    await tid(page, 'exercise-search').fill('lateral cable');
    await page.getByText('Lateral Raise (Cable)', { exact: true }).filter({ visible: true }).first().click();
    await expect(tid(page, 'record-weight')).toContainText('22.5'); // warm-up 52.5 excluded
    await expect(tid(page, 'record-weight')).not.toContainText('52.5');
  });

  test('analytics weekly PR list shows the exact weight', async ({ page }) => {
    await openWith(page, { history: [before, { ...after, startedAt: Date.now() - 60_000, endedAt: Date.now() }] });
    await page.getByText('Analytics', { exact: true }).last().click();
    await expect(page.getByText('22.5 lb')).toBeVisible();
  });
});
