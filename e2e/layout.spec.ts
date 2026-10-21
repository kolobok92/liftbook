import { expect, expectIconAligned, openWith, pplua, test, tid, workout } from './helpers';

const withNote = workout({
  name: 'Push',
  daysAgo: 7,
  programRef: pplua(0),
  exercises: [{ exerciseId: 'lateral-raise-cable', notes: 'Lean away from the stack and pause at the top of every rep', sets: [{ weight: 20, reps: 12 }] }],
});

test.describe('layout', () => {
  test('note rows: icons are centered on the first line of text', async ({ page }) => {
    await openWith(page, { history: [withNote] });
    await tid(page, 'start-next-workout').click();

    await expectIconAligned(page, 'workout-note'); // empty (placeholder)
    await tid(page, 'workout-note').fill('Felt strong today.\nSlept 8h.');
    await expectIconAligned(page, 'workout-note'); // multi-line

    await expectIconAligned(page, 'note-0'); // the carried-over note, wraps to two lines

    await tid(page, 'exercise-menu-0').click();
    await tid(page, 'menu-note').click();
    await tid(page, 'note-input').fill('Cable at hip height');
    await tid(page, 'note-ok').click();
    await expectIconAligned(page, 'note-0');
  });
});

// iOS merges a pressable's children into one accessibility element, so a button nested in
// another pressable is unreachable for VoiceOver (and Maestro). react-native-web renders
// every Pressable as focusable (tabindex=0), like iOS treats every Pressable as accessible.
test('no button is nested inside another pressable, on any main screen', async ({ page }) => {
  await openWith(page, { history: [withNote] });
  const nested = async (where: string) => {
    const found = await page.locator('[tabindex="0"] [tabindex="0"], [tabindex="0"] [role="button"]').evaluateAll((els) =>
      els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => (e.textContent || e.getAttribute('aria-label') || '').slice(0, 40)),
    );
    expect(found, `nested buttons on ${where}`).toEqual([]);
  };
  await nested('Home');
  for (const tab of ['Programs', 'History', 'Analytics', 'Profile']) {
    await page.getByText(tab, { exact: true }).last().click();
    await nested(tab);
  }
  await page.getByText('Home', { exact: true }).last().click();
  await tid(page, 'start-next-workout').click();
  await nested('Workout');
  await tid(page, 'add-exercise').click();
  await nested('Exercise picker');
});
