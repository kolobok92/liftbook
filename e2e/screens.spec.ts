import { openWith, pplua, test, tid, workout } from './helpers';

/**
 * Not assertions: captures every main screen with realistic data into e2e-screens/
 * for visual review. Run with `npm run screens`.
 */
const weeks = [3, 2, 1, 0];
const history = weeks.flatMap((wk, k) => [
  workout({
    name: 'Push',
    daysAgo: wk * 7 + 4,
    programRef: pplua(0, k),
    exercises: [
      { exerciseId: 'lateral-raise-cable', sets: [{ weight: 20 + k * 2.5, reps: 12 }, { weight: 20 + k * 2.5, reps: 11 }, { weight: 20 + k * 2.5, reps: 10, rpe: 9 }] },
      { exerciseId: 'incline-chest-press-machine', sets: [{ weight: 90, reps: 12, type: 'warmup' }, { weight: 162.5 + k * 10, reps: 8 }, { weight: 172.5 + k * 10, reps: 6 }, { weight: 150 + k * 10, reps: 8, type: 'drop' }] },
      { exerciseId: 'seated-military-press-barbell', sets: [{ weight: 95 + k * 5, reps: 10 }, { weight: 95 + k * 5, reps: 9 }, { weight: 95 + k * 5, reps: 8 }] },
    ],
  }),
  workout({
    name: 'Legs',
    daysAgo: wk * 7 + 2,
    programRef: pplua(2, k),
    exercises: [
      { exerciseId: 'leg-press', sets: [{ weight: 270 + k * 20, reps: 8 }, { weight: 270 + k * 20, reps: 7 }, { weight: 270 + k * 20, reps: 7, rpe: 9 }, { weight: 250 + k * 20, reps: 8 }] },
      { exerciseId: 'leg-extension', sets: [{ weight: 120, reps: 12 }, { weight: 120, reps: 11 }, { weight: 120, reps: 10 }] },
    ],
  }),
  workout({
    name: 'Pull',
    daysAgo: wk * 7 + 3,
    programRef: pplua(1, k),
    exercises: [
      { exerciseId: 't-bar-row', sets: [{ weight: 135 + k * 10, reps: 8 }, { weight: 135 + k * 10, reps: 8 }, { weight: 135 + k * 10, reps: 7 }] },
      { exerciseId: 'hammer-curl-dumbbell', sets: [{ weight: 35, reps: 12 }, { weight: 35, reps: 10 }] },
    ],
  }),
]);

test('capture screens @screens', async ({ page }) => {
  const shot = (name: string) => page.screenshot({ path: `e2e-screens/${name}.png`, fullPage: false });
  await openWith(page, { history, activeProgram: { programId: 'pplua', startedAt: 0, completed: { '0-0': history[9].id, '0-1': history[11].id } } });
  await shot('01-home');
  await tid(page, 'start-next-workout').click();
  await tid(page, 'check-0-0').click();
  await tid(page, 'reps-0-1').click();
  await shot('02-workout');
  await tid(page, 'set-type-0-2').click();
  await tid(page, 'set-rpe').click();
  await shot('03-rpe-sheet');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await tid(page, 'minimize-workout').click();
  const tab = (name: string) => page.getByText(name, { exact: true }).last().click();

  await tab('Programs');
  await tid(page, 'program-card-pplua').click();
  await page.waitForTimeout(600);
  await shot('04-program');
  await tid(page, 'edit-program').click();
  await page.waitForTimeout(600);
  await shot('05-builder');
  await page.goBack();
  await page.goBack();

  await tab('History');
  await page.waitForTimeout(600);
  await shot('06-history');
  await tid(page, `history-card-${history[9].id}`).click();
  await page.waitForTimeout(600);
  await shot('07-workout-detail');
  await page.goBack();

  await tab('Analytics');
  await page.waitForTimeout(800);
  await shot('08-analytics');
  await tid(page, 'open-exercises').click();
  await page.getByText('Incline Chest Press (Machine)', { exact: true }).click();
  await page.waitForTimeout(800);
  await shot('09-exercise-records');
  await page.goBack();
  await page.goBack();

  await tab('Profile');
  await page.waitForTimeout(500);
  await shot('10-profile');
});
