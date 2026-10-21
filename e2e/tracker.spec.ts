import { expect, test, acceptDialogs, openWith, pplua, setRow, stored, tid, workout, typeSet } from './helpers';

const LATERAL = 'lateral-raise-cable';

// Last time Push (day 0) was run: lateral raises 30x12, 30x10, 25x12, 25x11 @ RPE 9 on the last set.
const lastPush = workout({
  name: 'Push',
  daysAgo: 7,
  programRef: pplua(0),
  exercises: [
    {
      exerciseId: LATERAL,
      notes: 'Pause at the top',
      sets: [
        { weight: 30, reps: 12 },
        { weight: 30, reps: 10 },
        { weight: 25, reps: 12 },
        { weight: 25, reps: 11, rpe: 9 },
      ],
    },
  ],
});

test.describe('workout tracker', () => {
  test('first-ever session: log, finish, and the program advances', async ({ page }) => {
    acceptDialogs(page);
    await openWith(page);
    await tid(page, 'start-next-workout').click();
    await expect(page).toHaveURL(/\/workout$/);

    // No history → no hints, nothing prefilled on tap.
    await tid(page, 'weight-0-0').click();
    expect(await setRow(page, 0, 0)).toMatchObject({ weight: '', reps: '', weightHint: '', repsHint: '', previous: '—' });

    await typeSet(page, 'weight-0-0', '30');
    await typeSet(page, 'reps-0-0', '12');
    await tid(page, 'check-0-0').click();
    await expect(tid(page, 'check-0-0')).toHaveAttribute('aria-checked', 'true');

    await tid(page, 'finish-workout').click(); // confirms "sets not checked off"
    await expect(page).toHaveURL(/workout-summary/);
    await expect(page.getByText('Workout Complete')).toBeVisible();
    await tid(page, 'summary-done').click();

    // Loop program: next up is day 2 and the workout is in history with only the checked set.
    await expect(page.getByText('UP NEXT · CYCLE 1 · DAY 2')).toBeVisible();
    const s = await stored(page);
    expect(s.history).toHaveLength(1);
    expect(s.history[0].exercises).toHaveLength(1);
    expect(s.history[0].exercises[0].sets).toEqual([expect.objectContaining({ weight: 30, reps: 12, done: true })]);
  });

  test('previous session carries over: Previous column, hints, tap-to-fill, check-to-commit', async ({ page }) => {
    acceptDialogs(page);
    await openWith(page, { history: [lastPush] });
    await tid(page, 'start-next-workout').click();

    // Previous column and grey hints mirror last session set-by-set.
    expect(await setRow(page, 0, 0)).toMatchObject({ previous: '30lb × 12', weightHint: '30', repsHint: '12', weight: '', reps: '' });
    expect(await setRow(page, 0, 2)).toMatchObject({ previous: '25lb × 12', weightHint: '25', repsHint: '12' });
    expect((await setRow(page, 0, 3)).previous).toBe('25lb × 11 RPE 9');

    // Last session's note is offered.
    await expect(tid(page, 'last-note-0')).toContainText('Pause at the top');

    // Tapping a field fills nothing in: the hints stay hints (Boostcamp).
    await tid(page, 'reps-0-1').click();
    expect(await setRow(page, 0, 1)).toMatchObject({ weight: '', weightHint: '30', reps: '', repsHint: '10' });

    // Override one number, then check: the circle takes the other from its hint.
    await page.keyboard.type('11');
    await tid(page, 'check-0-1').click();
    expect(await setRow(page, 0, 1)).toMatchObject({ weight: '30', reps: '11' });

    // Checking an untouched set commits last session's numbers.
    await tid(page, 'check-0-0').click();
    expect(await setRow(page, 0, 0)).toMatchObject({ weight: '30', reps: '12' });

    // Tapping Previous copies it in (including RPE).
    await tid(page, 'prev-0-3').click();
    expect(await setRow(page, 0, 3)).toMatchObject({ weight: '25', reps: '11' });
    await tid(page, 'set-type-0-3').click();
    await expect(tid(page, 'set-rpe')).toContainText('RPE 9');
    await page.getByRole('button', { name: 'Close', exact: true }).last().click();

    // Set 3: the changed reps (11) carry down; the weight set 2 kept from last time doesn't, so
    // set 3 still hints its own last-session weight.
    expect(await setRow(page, 0, 2)).toMatchObject({ weight: '', weightHint: '25', reps: '', repsHint: '11' });
  });

  test('checking a set opens nothing and moves nothing (no keyboard, no focus jump)', async ({ page }) => {
    await openWith(page, { history: [lastPush] });
    await tid(page, 'start-next-workout').click();
    await typeSet(page, 'weight-0-0', '32.5');
    await tid(page, 'check-0-0').click();
    await expect(tid(page, 'keypad')).toHaveCount(0); // the pad closes with the check
    expect(await setRow(page, 0, 1)).toMatchObject({ weight: '', weightHint: '32.5', reps: '', repsHint: '10' });
    await tid(page, 'check-0-1').click();
    await expect(tid(page, 'keypad')).toHaveCount(0);
    expect(await setRow(page, 0, 1)).toMatchObject({ weight: '32.5', reps: '10' });
  });

  test('beating last time is recorded as a PR', async ({ page }) => {
    acceptDialogs(page);
    await openWith(page, { history: [lastPush] });
    await tid(page, 'start-next-workout').click();
    await typeSet(page, 'weight-0-0', '35');
    await typeSet(page, 'reps-0-0', '12');
    await tid(page, 'check-0-0').click();
    await tid(page, 'finish-workout').click();
    await expect(tid(page, 'summary-prs')).toContainText('Lateral Raise (Cable)');
    await expect(tid(page, 'summary-prs')).toContainText('Max Weight');
  });

  test('previous prefers the same program day over a more recent session', async ({ page }) => {
    acceptDialogs(page);
    const armsDay = workout({ name: 'Arms', daysAgo: 2, programRef: pplua(4), exercises: [{ exerciseId: LATERAL, sets: [{ weight: 15, reps: 20 }] }] });
    await openWith(page, { history: [lastPush, armsDay] });
    await tid(page, 'start-next-workout').click(); // Push (day 1)
    expect((await setRow(page, 0, 0)).previous).toBe('30lb × 12');
  });

  test('checking a set with nothing entered and nothing to hint from does nothing', async ({ page }) => {
    await openWith(page);
    await tid(page, 'start-next-workout').click();
    await tid(page, 'check-0-0').click();
    await expect(tid(page, 'check-0-0')).toHaveAttribute('aria-checked', 'false');
    await expect(tid(page, 'keypad')).toHaveCount(0); // stays put, nothing opens
    // "Complete all" skips sets that have nothing to log.
    await typeSet(page, 'reps-0-1', '10');
    await tid(page, 'complete-all-0').click();
    await expect(tid(page, 'check-0-1')).toHaveAttribute('aria-checked', 'true');
    await expect(tid(page, 'check-0-0')).toHaveAttribute('aria-checked', 'false');
  });

  test('set type and RPE sheets', async ({ page }) => {
    await openWith(page);
    await tid(page, 'start-next-workout').click();

    await tid(page, 'set-type-0-0').click();
    await tid(page, 'settype-warmup').click();
    await expect(tid(page, 'set-type-0-0')).toHaveText('W');
    // Working sets renumber from 1 after a warm-up.
    await expect(tid(page, 'set-type-0-1')).toHaveText('1');

    // RPE lives in the set's menu (no badge on the reps box, like Boostcamp).
    await tid(page, 'set-type-0-1').click();
    await tid(page, 'set-rpe').click();
    await tid(page, 'rpe-8.5').click();
    await tid(page, 'set-type-0-1').click();
    await expect(tid(page, 'set-rpe')).toContainText('RPE 8.5');
    await page.getByRole('button', { name: 'Close', exact: true }).last().click();

    await tid(page, 'set-type-0-3').click();
    await tid(page, 'remove-set').click();
    await expect(tid(page, 'set-row-0-3')).toHaveCount(0);
  });

  test('add, swap and remove exercises; add sets', async ({ page }) => {
    await openWith(page);
    await tid(page, 'start-empty-workout').click();
    await tid(page, 'add-exercise').click();
    await tid(page, 'exercise-search').fill('bench barbell');
    await tid(page, 'pick-bench-press-barbell').click();
    await tid(page, 'exercise-search').fill('squat barbell');
    await tid(page, 'pick-squat-barbell').click();
    await tid(page, 'picker-add').click();

    await expect(tid(page, 'exercise-card-0')).toContainText('Bench Press (Barbell)');
    await expect(tid(page, 'exercise-card-1')).toContainText('Squat (Barbell)');

    await tid(page, 'add-set-0').click();
    await expect(tid(page, 'set-row-0-3')).toBeVisible();

    await tid(page, 'swap-1').click();
    await tid(page, 'exercise-search').fill('front squat');
    await tid(page, 'pick-front-squat-barbell').click();
    await expect(tid(page, 'exercise-card-1')).toContainText('Front Squat (Barbell)');

    await tid(page, 'exercise-menu-0').click();
    await tid(page, 'menu-remove').click();
    await expect(tid(page, 'exercise-card-0')).toContainText('Front Squat (Barbell)');
    await expect(tid(page, 'exercise-card-1')).toHaveCount(0);
  });

  test('an in-progress workout survives minimizing and an app reload', async ({ page }) => {
    await openWith(page);
    await tid(page, 'start-next-workout').click();
    await typeSet(page, 'weight-0-0', '27.5');
    await tid(page, 'minimize-workout').click();
    await expect(tid(page, 'active-workout-bar')).toBeVisible();
    await page.reload();
    await tid(page, 'active-workout-bar').click();
    expect((await setRow(page, 0, 0)).weight).toBe('27.5');
  });

  test('discarding a workout leaves no history and keeps the program position', async ({ page }) => {
    acceptDialogs(page);
    await openWith(page);
    await tid(page, 'start-next-workout').click();
    await typeSet(page, 'weight-0-0', '30');
    await tid(page, 'check-0-0').click();
    await tid(page, 'discard-workout').click();
    await expect(page.getByText('UP NEXT · CYCLE 1 · DAY 1')).toBeVisible();
    expect((await stored(page)).history).toHaveLength(0);
  });

  test('finishing with nothing checked offers to discard instead', async ({ page }) => {
    acceptDialogs(page);
    await openWith(page);
    await tid(page, 'start-next-workout').click();
    await tid(page, 'finish-workout').click();
    await expect(page.getByText('UP NEXT · CYCLE 1 · DAY 1')).toBeVisible();
    expect((await stored(page)).history).toHaveLength(0);
  });

  test('starting a new workout while one is running asks first', async ({ page }) => {
    let asked = '';
    page.on('dialog', (d) => {
      asked = d.message();
      d.dismiss();
    });
    await openWith(page);
    await tid(page, 'start-next-workout').click();
    await typeSet(page, 'weight-0-0', '30');
    await tid(page, 'minimize-workout').click();
    await tid(page, 'start-empty-workout').click();
    expect(asked).toContain('Discard the current workout');
    // Dismissed → original workout still active.
    await tid(page, 'active-workout-bar').click();
    expect((await setRow(page, 0, 0)).weight).toBe('30');
  });
});

// Regression: a weight typed right after writing a note came out as "" or "00" (focus handed
// back to the menu's "…" button; select-on-focus landing after the first keystroke).
test('after a note, the next field gets every keystroke', async ({ page }) => {
  await openWith(page);
  await tid(page, 'start-empty-workout').click();
  await tid(page, 'add-exercise').click();
  await tid(page, 'exercise-search').fill('bench barbell');
  await tid(page, 'pick-bench-press-barbell').click();
  await tid(page, 'picker-add').click();
  await tid(page, 'exercise-menu-0').click();
  await tid(page, 'menu-note').click();
  await expect(tid(page, 'note-input')).toBeFocused();
  await page.keyboard.type('Pause on chest');
  await tid(page, 'note-ok').click();
  await tid(page, 'weight-0-0').click();
  await page.keyboard.type('100');
  await tid(page, 'reps-0-0').click();
  await page.keyboard.type('5');
  await expect(tid(page, 'weight-0-0-value')).toHaveText('100');
  await expect(tid(page, 'note-0')).toContainText('Pause on chest');
});

// Boostcamp: once set 1 is logged, later sets with no history show its numbers as hints, and
// tapping the circle accepts them.
test('first session: logging set 1 hints the rest, and the circle accepts the hint', async ({ page }) => {
  await openWith(page);
  await tid(page, 'start-next-workout').click(); // PPLUA Push, no history
  await typeSet(page, 'weight-0-0', '12.5');
  await typeSet(page, 'reps-0-0', '10');
  await tid(page, 'check-0-0').click();
  await expect(tid(page, 'weight-0-2-hint')).toHaveText('12.5');
  await expect(tid(page, 'reps-0-2-hint')).toHaveText('10');
  await tid(page, 'check-0-2').click();
  await expect(tid(page, 'check-0-2')).toHaveAttribute('aria-checked', 'true');
  await expect(tid(page, 'weight-0-2-value')).toHaveText('12.5');
  await expect(tid(page, 'reps-0-2-value')).toHaveText('10');
});

// Boostcamp-style note popup: OK saves, tapping the note edits it, Delete clears, outside cancels.
test('exercise note popup: OK, edit, cancel, Delete', async ({ page }) => {
  await openWith(page);
  await tid(page, 'start-next-workout').click();
  await tid(page, 'exercise-menu-0').click();
  await tid(page, 'menu-note').click();
  await expect(tid(page, 'note-input')).toBeFocused(); // opens once the menu has closed
  await page.keyboard.type('Seat on 4');
  await tid(page, 'note-ok').click();
  await expect(tid(page, 'note-input')).toHaveCount(0);
  await expect(tid(page, 'note-0')).toContainText('Seat on 4');
  // Tap the note: popup opens with it; an edit cancelled by tapping outside is discarded.
  await tid(page, 'note-0').click();
  await expect(tid(page, 'note-input')).toHaveValue('Seat on 4');
  await tid(page, 'note-input').fill('Seat on 5');
  await page.getByLabel('Cancel note').click({ position: { x: 10, y: 10 } });
  await expect(tid(page, 'note-0')).toContainText('Seat on 4');
  // Delete clears it entirely.
  await tid(page, 'note-0').click();
  await tid(page, 'note-delete').click();
  await expect(tid(page, 'note-0')).toHaveCount(0);
});
