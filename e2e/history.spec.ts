/// <reference types="node" />
import { expect, test, acceptDialogs, openWith, pplua, setRow, stored, tid, workout, typeSet } from './helpers';

const BENCH = 'bench-press-barbell';
const older = workout({ name: 'Push A', daysAgo: 14, exercises: [{ exerciseId: BENCH, sets: [{ weight: 185, reps: 5 }, { weight: 185, reps: 5 }] }] });
const newer = workout({ name: 'Push B', daysAgo: 7, programRef: pplua(0), exercises: [{ exerciseId: BENCH, sets: [{ weight: 95, reps: 10, type: 'warmup' }, { weight: 205, reps: 3 }] }] });

test.describe('history, records and data', () => {
  test('edit a logged workout and the change flows into "Previous"', async ({ page }) => {
    acceptDialogs(page);
    await openWith(page, { history: [older] });
    await page.getByText('History', { exact: true }).last().click();
    await tid(page, `history-card-${older.id}`).click();
    await tid(page, 'edit-workout').click();
    await typeSet(page, 'reps-0-1', '6');
    await tid(page, 'save-workout-edit').click();
    await expect(page.getByText('185lb × 6').last()).toBeVisible(); // the history card behind shows it too

    await page.goBack();
    await page.getByText('Home', { exact: true }).last().click();
    await tid(page, 'start-empty-workout').click();
    await tid(page, 'add-exercise').click();
    await tid(page, 'exercise-search').fill('bench barbell');
    await tid(page, 'pick-bench-press-barbell').click();
    await tid(page, 'picker-add').click();
    expect((await setRow(page, 0, 1)).previous).toBe('185lb × 6');
  });

  test('delete a workout', async ({ page }) => {
    acceptDialogs(page);
    await openWith(page, { history: [older, newer] });
    await page.getByText('History', { exact: true }).last().click();
    await tid(page, `history-card-${newer.id}`).click();
    await tid(page, 'delete-workout').click();
    await expect(tid(page, `history-card-${newer.id}`)).toHaveCount(0);
    expect((await stored(page)).history.map((w: { id: string }) => w.id)).toEqual([older.id]);
  });

  test('exercise records ignore warm-ups and show PR history', async ({ page }) => {
    await openWith(page, { history: [older, newer] });
    await page.goto(`/exercise/${BENCH}`);
    await expect(tid(page, 'record-weight')).toContainText('205');
    await expect(tid(page, 'record-e1rm')).toContainText('226'); // 205 × (1 + 3/30) = 225.5
    await expect(page.getByText('PR History')).toBeVisible();
  });

  test('history card flags the PR session', async ({ page }) => {
    await openWith(page, { history: [older, newer] });
    await page.getByText('History', { exact: true }).last().click();
    await expect(tid(page, `history-card-${newer.id}`)).toContainText('PR');
    await expect(tid(page, `history-card-${older.id}`)).not.toContainText('PR');
  });

  test('import a Strong CSV (twice → no duplicates)', async ({ page }) => {
    acceptDialogs(page);
    await openWith(page);
    const csv = [
      'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE',
      '2026-09-01 18:00:00,Legs,1h 2m,Squat (Barbell),1,225,5,0,0,,,8',
      '2026-09-01 18:00:00,Legs,1h 2m,Squat (Barbell),2,225,5,0,0,,,',
      '2026-09-03 18:00:00,Upper,50m,Bench Press (Barbell),1,185,5,0,0,,,',
    ].join('\n');
    const file = { name: 'strong.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) };
    await page.getByText('Profile', { exact: true }).last().click();
    for (let i = 0; i < 2; i++) {
      const chooser = page.waitForEvent('filechooser');
      await tid(page, 'import-csv').click();
      await (await chooser).setFiles(file);
      await page.waitForTimeout(500);
    }
    const s = await stored(page);
    expect(s.history).toHaveLength(2);
    expect(s.history.map((w: { name: string }) => w.name).sort()).toEqual(['Legs', 'Upper']);
  });

  test('switching to kg converts logged weights', async ({ page }) => {
    acceptDialogs(page);
    await openWith(page, { history: [older] });
    await page.getByText('Profile', { exact: true }).last().click();
    await page.getByRole('button', { name: 'kg' }).click();
    const s = await stored(page);
    expect(s.settings.unit).toBe('kg');
    expect(s.history[0].exercises[0].sets[0].weight).toBeCloseTo(83.9, 1);
  });
});
