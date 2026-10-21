import type { Locator, Page } from '@playwright/test';
import { expect, openWith, pplua, setRow, stored, test, tid, workout, typeSet } from './helpers';

const lastPush = workout({
  name: 'Push',
  daysAgo: 7,
  programRef: pplua(0),
  exercises: [{ exerciseId: 'lateral-raise-cable', sets: [{ weight: 20, reps: 12 }, { weight: 20, reps: 12 }, { weight: 20, reps: 11 }, { weight: 20, reps: 10 }] }],
});

/** A real left swipe with the mouse, like a finger drag. */
async function swipeLeft(page: Page, target: Locator, startFrac = 1) {
  await target.scrollIntoViewIfNeeded();
  const box = (await target.boundingBox())!;
  const y = box.y + box.height / 2;
  // Drag from the right edge, as a thumb would (startFrac < 1 starts further in, e.g. to avoid a
  // button at the edge of that row).
  const startX = Math.min(page.viewportSize()!.width - 40, page.viewportSize()!.width * startFrac);
  await page.mouse.move(startX, y);
  await page.mouse.down();
  for (let dx = 0; dx <= 180; dx += 20) await page.mouse.move(startX - dx, y, { steps: 2 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

test.describe('exercise actions', () => {
  test('a finished exercise folds to “✓ name”; tapping reopens it', async ({ page }) => {
    await openWith(page, { history: [lastPush] });
    await tid(page, 'start-next-workout').click();
    for (const i of [0, 1, 2, 3]) await tid(page, `check-0-${i}`).click();
    await expect(tid(page, 'done-mark-0')).toBeVisible();
    await expect(tid(page, 'set-row-0-0')).toHaveCount(0);
    await expect(tid(page, 'keypad')).toHaveCount(0); // nothing jumps to the next exercise

    await tid(page, 'collapse-0').click(); // the chevron reopens it (the name opens the exercise)
    await expect(tid(page, 'set-row-0-0')).toBeVisible();
    // Unchecking a set keeps it open; finishing again folds it back up.
    await tid(page, 'check-0-3').click();
    await expect(tid(page, 'set-row-0-3')).toBeVisible();
    await tid(page, 'check-0-3').click();
    await expect(tid(page, 'set-row-0-3')).toHaveCount(0);
    await expect(tid(page, 'done-mark-0')).toBeVisible();
  });

  test('superset with any exercise of the day: it moves up next to it', async ({ page }) => {
    await openWith(page);
    await tid(page, 'start-next-workout').click(); // PPLUA Push
    await tid(page, 'exercise-menu-0').click();
    await tid(page, 'menu-superset').click();
    const third = (await tid(page, 'superset-pick-2').innerText()).trim().split('\n').pop()!; // the list shows the day's exercises
    await tid(page, 'superset-pick-2').click();
    // One superset card with a tab per exercise; the moved one is the second tab.
    await expect(tid(page, 'superset-box-0')).toContainText('SUPERSET A');
    await expect(tid(page, 'superset-tab-1')).toContainText(third.replace(/\s*\(.*\)$/, ''));
    // Tap B's tab (retrying while the list sheet fades out over it).
    await expect(async () => {
      await tid(page, 'superset-tab-1').click();
      await expect(tid(page, 'superset-tab-1')).toHaveAttribute('aria-selected', 'true', { timeout: 500 });
    }).toPass();
    await expect(tid(page, 'exercise-card-1')).toContainText(third);
    await expect(tid(page, 'exercise-card-2')).not.toContainText('SUPERSET');
  });

  test('reorder exercises from the Reorder sheet', async ({ page }) => {
    await openWith(page);
    await tid(page, 'start-next-workout').click();
    await expect(tid(page, 'exercise-card-0')).toContainText('Lateral Raise (Cable)');
    await tid(page, 'open-reorder').click();
    await tid(page, 'reorder-top-2').click(); // Seated Military Press → first
    await tid(page, 'reorder-down-1').click(); // Lateral Raise → third
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(tid(page, 'exercise-card-0')).toContainText('Seated Military Press (Barbell)');
    await expect(tid(page, 'exercise-card-1')).toContainText('Incline Chest Press (Machine)');
    await expect(tid(page, 'exercise-card-2')).toContainText('Lateral Raise (Cable)');
  });

  test('swipe a set left to delete it; numbering and hints follow', async ({ page }) => {
    await openWith(page, { history: [lastPush] });
    await tid(page, 'start-next-workout').click();
    await swipeLeft(page, tid(page, 'set-row-0-1'));
    await tid(page, 'swipe-delete-0-1').click();
    await expect(tid(page, 'set-row-0-3')).toHaveCount(0);
    await expect(tid(page, 'set-type-0-1')).toHaveText('2');
    // Remaining sets line up with last session by position.
    expect((await setRow(page, 0, 2)).previous).toBe('20lb × 11');
  });

  test('swipe an exercise left to delete it; asks first when sets are logged', async ({ page }) => {
    let asked = '';
    page.on('dialog', (d) => {
      asked = d.message();
      d.accept();
    });
    await openWith(page);
    await tid(page, 'start-next-workout').click();

    // Untouched exercise: deleted without asking.
    const second = tid(page, 'exercise-card-1');
    await expect(second).toContainText('Incline Chest Press (Machine)');
    await swipeLeft(page, second.getByText('Previous', { exact: true }), 0.6); // not on the complete-all button at the row's edge
    await tid(page, 'swipe-delete-exercise-1').click();
    await expect(tid(page, 'exercise-card-1')).toContainText('Seated Military Press (Barbell)');
    expect(asked).toBe('');

    // Exercise with a logged set: confirms, then deletes.
    await typeSet(page, 'weight-0-0', '20');
    await typeSet(page, 'reps-0-0', '12');
    await tid(page, 'check-0-0').click();
    await swipeLeft(page, tid(page, 'exercise-card-0').getByText('Previous', { exact: true }), 0.6); // not on the complete-all button at the row's edge
    await tid(page, 'swipe-delete-exercise-0').click();
    expect(asked).toContain('1 logged set');
    await expect(tid(page, 'exercise-card-0')).toContainText('Seated Military Press (Barbell)');
    expect((await stored(page)).active.exercises).toHaveLength(3);
  });
});
