import type { Page } from '@playwright/test';
import { expect, openWith, pplua, test, tid, workout } from './helpers';

/**
 * Visual regression: approved baseline images of key screens. Any layout shift, overlap or
 * misalignment shows up as a failing diff (see e2e-report). Time is frozen and seed data is
 * relative to it, so dates and timers are stable. After an intended UI change, review the
 * diffs and re-approve with `npm run visual:update`.
 */
const NOW = new Date('2026-10-20T09:00:00').getTime();
const DAY = 86_400_000;

function at(daysAgo: number, w: ReturnType<typeof workout>) {
  const startedAt = NOW - daysAgo * DAY;
  return { ...w, startedAt, endedAt: startedAt + 62 * 60_000 };
}

const history = [
  at(7, workout({
    name: 'Push',
    daysAgo: 0,
    programRef: pplua(0),
    exercises: [
      { exerciseId: 'lateral-raise-cable', notes: 'Lean away from the stack and pause at the top of every rep', sets: [{ weight: 20, reps: 12 }, { weight: 20, reps: 12 }, { weight: 22.5, reps: 10 }, { weight: 22.5, reps: 9, rpe: 9.5 }] },
      { exerciseId: 'incline-chest-press-machine', sets: [{ weight: 90, reps: 12, type: 'warmup' }, { weight: 170, reps: 8 }, { weight: 180, reps: 6 }, { weight: 160, reps: 9, type: 'drop' }] },
    ],
  })),
  at(6, workout({ name: 'Pull', daysAgo: 0, programRef: pplua(1), exercises: [{ exerciseId: 't-bar-row', sets: [{ weight: 135, reps: 8 }, { weight: 135, reps: 7 }] }] })),
];

/**
 * Start the browser clock at a fixed date but let it run (setSystemTime, not setFixedTime):
 * dates on screen are deterministic, while a frozen clock would stall time-driven screen
 * transitions (blank frames). The running workout timer is masked in snapshots.
 */
async function open(page: Page) {
  await page.clock.setSystemTime(NOW);
  await openWith(page, { history });
}

const opts = { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.002 } as const;
/** Snapshot once `ready` is visible — a stable blank frame mid-transition would otherwise pass. */
async function snap(page: Page, name: string, ready: ReturnType<Page['getByTestId']>) {
  await expect(ready).toBeVisible();
  await expect(page).toHaveScreenshot(`${name}.png`, { ...opts, mask: [page.getByTestId('workout-elapsed')] });
}
/** Snapshot one element (e.g. a card) so scroll position can't change what's captured. */
async function snapEl(el: ReturnType<Page['getByTestId']>, name: string) {
  await el.scrollIntoViewIfNeeded();
  await expect(el).toHaveScreenshot(`${name}.png`, opts);
}

test.describe('visual @visual', () => {
  test.use({ deviceScaleFactor: 2 });

  test('home', async ({ page }) => {
    await open(page);
    await snap(page, 'home', tid(page, 'start-next-workout'));
  });

  test('tracker: fresh, then mid-set', async ({ page }) => {
    await open(page);
    await tid(page, 'start-next-workout').click();
    await snap(page, 'tracker-fresh', tid(page, 'set-row-0-0'));
    await tid(page, 'weight-0-0').click();
    await tid(page, 'check-0-0').click();
    await snapEl(tid(page, 'exercise-card-0'), 'tracker-active-set');
  });

  test('tracker: collapsed exercise and note', async ({ page }) => {
    await open(page);
    await tid(page, 'start-next-workout').click();
    await tid(page, 'complete-all-0').click();
    await tid(page, 'exercise-menu-1').click();
    await tid(page, 'menu-note').click();
    await tid(page, 'note-input').fill('Seat on 4, handles at chest height');
    await tid(page, 'note-ok').click();
    await snapEl(tid(page, 'exercise-card-0'), 'tracker-collapsed-card');
    await snapEl(tid(page, 'exercise-card-1'), 'tracker-card-with-note');
  });

  test('history and workout detail', async ({ page }) => {
    await open(page);
    await page.getByText('History', { exact: true }).last().click();
    await snap(page, 'history', tid(page, `history-card-${history[0].id}`));
    await tid(page, `history-card-${history[0].id}`).click();
    await snap(page, 'workout-detail', tid(page, 'edit-workout'));
  });

  test('exercise records', async ({ page }) => {
    await open(page);
    await page.getByText('Analytics', { exact: true }).last().click();
    await tid(page, 'open-exercises').click();
    await page.getByText('Incline Chest Press (Machine)', { exact: true }).filter({ visible: true }).first().click();
    await snap(page, 'exercise-records', tid(page, 'record-e1rm'));
  });

  test('program detail and builder', async ({ page }) => {
    await open(page);
    await page.getByText('Programs', { exact: true }).last().click();
    await tid(page, 'program-card-pplua').click();
    await snap(page, 'program-detail', tid(page, 'edit-program'));
    await tid(page, 'edit-program').click();
    await snap(page, 'builder', tid(page, 'program-name'));
  });
});

// Light mode (Appearance: System + a light OS). Covers the screens with the most colour roles:
// surfaces, accent fills vs accent text, set-type colours, PR badges, charts.
test.describe('visual light @visual', () => {
  test.use({ deviceScaleFactor: 2, colorScheme: 'light' });

  test('home, tracker, records and profile in light mode', async ({ page }) => {
    await open(page);
    await snap(page, 'light-home', tid(page, 'start-next-workout'));
    await tid(page, 'start-next-workout').click();
    await tid(page, 'weight-0-0').click();
    await tid(page, 'check-0-0').click();
    await snapEl(tid(page, 'exercise-card-0'), 'light-tracker-active-set');
    await snapEl(tid(page, 'exercise-card-1'), 'light-tracker-set-types');
    await tid(page, 'minimize-workout').click();
    await page.getByText('Analytics', { exact: true }).last().click();
    await tid(page, 'open-exercises').click();
    await page.getByText('Incline Chest Press (Machine)', { exact: true }).filter({ visible: true }).first().click();
    await snap(page, 'light-exercise-records', tid(page, 'record-e1rm'));
  });
});

test('appearance setting overrides the system scheme and persists', async ({ page }) => {
  await open(page); // system scheme: dark (config default)
  await page.getByText('Profile', { exact: true }).last().click();
  const heading = page.getByText('Weight unit', { exact: true }); // plain C.text label
  const ink = () => heading.evaluate((el) => getComputedStyle(el).color);
  const dark = await ink();
  await tid(page, 'appearance-light').click();
  await expect.poll(ink).toBe('rgb(20, 20, 22)'); // LIGHT.text
  // The tree remounts on a scheme change; the choice must also survive a reload.
  await page.reload();
  await expect.poll(ink).toBe('rgb(20, 20, 22)');
  await tid(page, 'appearance-dark').click();
  await expect.poll(ink).toBe(dark);
  expect(dark).toBe('rgb(244, 244, 245)'); // DARK.text
});
