import { expect, openWith, setRow, stored, test, tid, typeSet } from './helpers';

/** Finish a Push day with a swap, an extra set and a removed exercise, then choose what to keep. */
async function editAndFinish(page: import('@playwright/test').Page) {
  page.on('dialog', (d) => d.accept());
  await openWith(page);
  await tid(page, 'start-next-workout').click();
  // Lateral raise: add a 5th set.
  await tid(page, 'add-set-0').click();
  // Incline chest press → swap for incline dumbbell press.
  await tid(page, 'swap-1').click();
  await tid(page, 'exercise-search').fill('incline dumbbell');
  await tid(page, 'pick-incline-bench-press-dumbbell').click();
  // Remove the last exercise (tricep pushdown).
  await tid(page, 'exercise-menu-4').click();
  await tid(page, 'menu-remove').click();
  // Log one set and finish (other sets just unchecked — not a change).
  await typeSet(page, 'weight-0-0', '20');
  await typeSet(page, 'reps-0-0', '12');
  await tid(page, 'check-0-0').click();
  await tid(page, 'finish-workout').click();
  await expect(tid(page, 'program-changes')).toBeVisible();
}

const pushDay = async (page: import('@playwright/test').Page) => (await stored(page)).programs.find((p: { id: string }) => p.id === 'pplua').weeks[0].days[0];

test.describe('applying workout changes to the program', () => {
  test('lists one change per exercise; skipped sets are not listed', async ({ page }) => {
    await editAndFinish(page);
    const card = tid(page, 'program-changes');
    await expect(card).toContainText('Lateral Raise (Cable)');
    await expect(card).toContainText('4 → 5 sets');
    await expect(card).toContainText('Swapped for Incline Bench Press (Dumbbell)');
    await expect(card).toContainText('Removed');
    await expect(card.locator('[role="checkbox"]')).toHaveCount(3);
  });

  test('applies only the checked exercises, and the next Push day uses them', async ({ page }) => {
    await editAndFinish(page);
    // Keep the swap and the extra set; don't remove the pushdown.
    await page.locator('[data-testid^="change-item-ex:"]').filter({ hasText: 'Removed' }).click();
    await tid(page, 'apply-program').click();
    await expect(tid(page, 'program-changes-result')).toContainText('Program updated');

    const day = await pushDay(page);
    expect(day.exercises.map((e: { exerciseId: string; sets: unknown[] }) => [e.exerciseId, e.sets.length])).toEqual([
      ['lateral-raise-cable', 5],
      ['incline-bench-press-dumbbell', 4],
      ['seated-military-press-barbell', 3],
      ['chest-fly-machine', 3],
      ['tricep-rope-push-down-cable', 3],
    ]);

    // The next Push workout is built from the updated program and remembers today's numbers.
    await tid(page, 'summary-done').click();
    await tid(page, 'toggle-full-plan').click();
    await tid(page, 'program-day-0-0').click();
    await tid(page, 'start-preview-workout').click();
    await expect(tid(page, 'exercise-card-1')).toContainText('Incline Bench Press (Dumbbell)');
    await expect(tid(page, 'set-row-0-4')).toBeVisible();
    expect((await setRow(page, 0, 0)).previous).toBe('20lb × 12');
  });

  test('"Just this workout" leaves the program unchanged', async ({ page }) => {
    await editAndFinish(page);
    await tid(page, 'keep-oneoff').click();
    await expect(tid(page, 'program-changes-result')).toContainText('unchanged');
    const day = await pushDay(page);
    expect(day.exercises.map((e: { exerciseId: string }) => e.exerciseId)).toEqual([
      'lateral-raise-cable',
      'incline-chest-press-machine',
      'seated-military-press-barbell',
      'chest-fly-machine',
      'tricep-rope-push-down-cable',
    ]);
  });

  test('an unedited program workout asks nothing', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await openWith(page);
    await tid(page, 'start-next-workout').click();
    await typeSet(page, 'weight-0-0', '20');
    await typeSet(page, 'reps-0-0', '12');
    await tid(page, 'check-0-0').click();
    await tid(page, 'finish-workout').click();
    await expect(page.getByText('Workout Complete')).toBeVisible();
    await expect(tid(page, 'program-changes')).toHaveCount(0);
  });
});
