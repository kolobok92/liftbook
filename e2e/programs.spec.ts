import { expect, test, acceptDialogs, openWith, pplua, stored, tid, workout } from './helpers';

test.describe('programs', () => {
  test('build a loop program, start it, and run its first day with the prescribed targets', async ({ page }) => {
    acceptDialogs(page);
    await openWith(page);
    await page.getByText('Programs', { exact: true }).last().click();
    await tid(page, 'new-program').click();

    await tid(page, 'program-name').fill('Upper Lower');
    await tid(page, 'day-name-0').fill('Upper');
    await tid(page, 'builder-add-exercise-0').click();
    await tid(page, 'exercise-search').fill('bench barbell');
    await tid(page, 'pick-bench-press-barbell').click();
    await tid(page, 'picker-add').click();

    // Edit the first set's target and apply to all sets: 5 reps @ RPE 8.
    await tid(page, 'builder-set-0-0').click();
    await tid(page, 'target-kind-reps').click();
    await tid(page, 'target-a').fill('5');
    await tid(page, 'intensity-kind-rpe').click();
    await tid(page, 'intensity-a').fill('8');
    await tid(page, 'target-apply-all').click();
    await expect(tid(page, 'builder-set-0-2')).toContainText('5 reps');

    await tid(page, 'builder-add-day').click();
    await tid(page, 'day-name-1').fill('Lower');
    await tid(page, 'builder-add-exercise-1').click();
    await tid(page, 'exercise-search').fill('squat barbell');
    await tid(page, 'pick-squat-barbell').click();
    await tid(page, 'picker-add').click();

    await tid(page, 'save-program-bottom').click();
    await tid(page, 'start-program').click(); // confirms switching away from PPLUA

    await expect(page.getByText('CURRENT PROGRAM').locator('xpath=..')).toContainText('Upper Lower');
    await expect(page.getByText('UP NEXT · CYCLE 1 · DAY 1')).toBeVisible();
    await tid(page, 'start-next-workout').click();
    await expect(tid(page, 'exercise-card-0')).toContainText('Bench Press (Barbell)');
    await expect(tid(page, 'set-row-0-0')).toContainText('5 reps');
    await expect(tid(page, 'set-row-0-0')).toContainText('RPE 8');
  });

  test('refuses to save an unnamed program', async ({ page }) => {
    let msg = '';
    page.on('dialog', (d) => {
      msg = d.message();
      d.accept();
    });
    await openWith(page);
    await page.getByText('Programs', { exact: true }).last().click();
    await tid(page, 'new-program').click();
    await tid(page, 'save-program-bottom').click();
    expect(msg).toContain('name');
    await expect(tid(page, 'program-name')).toBeVisible(); // still in the builder
    // Storage is only written on change, so absent state also means nothing was saved.
    expect((await stored(page))?.programs?.map((p: { id: string }) => p.id) ?? ['pplua']).toEqual(['pplua']);
  });

  test('editing the active loop program changes the next workout', async ({ page }) => {
    acceptDialogs(page);
    await openWith(page);
    await page.getByText('PPLUA', { exact: true }).click();
    await tid(page, 'edit-program').click();
    await tid(page, 'builder-exercise-menu-0').first().click();
    await tid(page, 'builder-remove-exercise').click();
    await tid(page, 'save-program').click();
    await page.goBack();
    await expect(page.getByText('Incline Chest Press (Machine)').first()).toBeVisible();
    await tid(page, 'start-next-workout').click();
    await expect(tid(page, 'exercise-card-0')).toContainText('Incline Chest Press (Machine)');
  });

  test('loop wraps to cycle 2 after the last day; skipping advances too', async ({ page }) => {
    acceptDialogs(page);
    const done = [0, 1, 2, 3].map((d) => workout({ name: `D${d}`, daysAgo: 10 - d, programRef: pplua(d), exercises: [{ exerciseId: 'leg-press', sets: [{ weight: 100, reps: 10 }] }] }));
    await openWith(page, {
      history: done,
      activeProgram: { programId: 'pplua', startedAt: 0, completed: Object.fromEntries(done.map((w, d) => [`0-${d}`, w.id])) },
    });
    await expect(page.getByText('UP NEXT · CYCLE 1 · DAY 5')).toBeVisible();
    await tid(page, 'toggle-full-plan').click();
    await tid(page, 'program-day-0-4').click();
    await page.getByText('Skip This Workout').click();
    await expect(page.getByText('UP NEXT · CYCLE 2 · DAY 1')).toBeVisible();
  });
});

test('home: the current day is highlighted with one-tap Skip; the full plan is behind a toggle', async ({ page }) => {
  await openWith(page);
  await expect(tid(page, 'up-next')).toContainText('Push');
  await expect(tid(page, 'program-day-0-1')).toHaveCount(0); // collapsed by default
  await tid(page, 'skip-next-workout').click();
  await expect(tid(page, 'up-next')).toContainText('Pull'); // moved on
  await tid(page, 'toggle-full-plan').click();
  await expect(tid(page, 'program-day-0-0')).toContainText('Skipped');
  await expect(tid(page, 'program-day-0-1')).toContainText('Up next');
  await tid(page, 'toggle-full-plan').click();
  await expect(tid(page, 'program-day-0-1')).toHaveCount(0);
});
