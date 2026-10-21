import { describe, expect, it, type jest } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { Keypad } from './Keypad';
import { WorkoutEditor } from './WorkoutEditor';
import { useStore } from '@/lib/store';
import type { LoggedSet, Workout } from '@/lib/types';

// The tracker's behavior, without an emulator. What only a device proves (touch, gestures,
// navigation, pixels) stays in the Maestro flows.

const BENCH = 'bench-press-barbell';

/** The live tracker's editor and keypad, bound to the store like the workout screen. */
function Tracker() {
  const active = useStore((s) => s.active);
  const updateActive = useStore((s) => s.updateActive);
  return active ? (
    <>
      <WorkoutEditor workout={active} update={updateActive} mode="live" />
      <Keypad />
    </>
  ) : null;
}

const emptySets = (n: number): LoggedSet[] => Array.from({ length: n }, (_, j) => ({ id: `s${j}`, type: 'normal', weight: null, reps: null, rpe: null, done: false }));

async function startWith(exerciseIds: string[], { notes = '', history = [] as Workout[], sets = 3 } = {}) {
  await act(async () => {
    useStore.getState().resetAll();
    useStore.setState({ history });
    useStore.getState().startEmptyWorkout();
    useStore.getState().updateActive((w) => ({ ...w, exercises: exerciseIds.map((exerciseId, i) => ({ id: `row${i}`, exerciseId, notes, sets: emptySets(sets) })) }));
  });
  return await render(<Tracker />);
}

const lastWeek = (sets: [number, number][]): Workout => ({
  id: 'last',
  name: 'Workout',
  notes: '',
  startedAt: Date.now() - 7 * 86_400_000,
  endedAt: Date.now() - 7 * 86_400_000 + 3_600_000,
  pausedMs: 0,
  unit: 'lb',
  exercises: [{ id: 'e', exerciseId: BENCH, notes: '', sets: sets.map(([weight, reps], i) => ({ id: `p${i}`, type: 'normal', weight, reps, rpe: null, done: true })) }],
});

const sets = () => useStore.getState().active!.exercises[0].sets;
const row = (s: LoggedSet) => [s.weight, s.reps, s.done];
const el = (id: string) => screen.getByTestId(id);
/** What a field shows: its value (white) or its hint (grey). */
const shown = (id: string) => ({ value: screen.queryByTestId(`${id}-value`)?.props.children ?? '', hint: screen.queryByTestId(`${id}-hint`)?.props.children ?? '' });

async function keys(text: string) {
  for (const k of text) await fireEvent.press(el(`key-${k === '.' ? 'dot' : k}`));
}
async function type(id: string, text: string) {
  await fireEvent.press(el(id));
  await keys(text);
}
async function log(i: number, w: string, r: string) {
  await type(`weight-0-${i}`, w);
  await type(`reps-0-${i}`, r);
  await fireEvent.press(el(`check-0-${i}`));
}

describe('tracker', () => {
  it('logs sets with the keypad; a finished exercise folds to "✓ name" (Boostcamp)', async () => {
    await startWith([BENCH]);
    await log(0, '135', '8');
    await log(1, '135', '8');
    await log(2, '140', '6');
    expect(sets().map(row)).toEqual([
      [135, 8, true],
      [135, 8, true],
      [140, 6, true],
    ]);
    expect(el('done-mark-0')).toBeTruthy();
    expect(screen.queryByTestId('set-row-0-0')).toBeNull(); // folded
  });

  it('checking a set opens nothing and moves nothing; its numbers become the next hints', async () => {
    await startWith([BENCH]);
    await log(0, '135', '8');
    expect(screen.queryByTestId('keypad')).toBeNull();
    expect(shown('weight-0-1')).toEqual({ value: '', hint: '135' });
    expect(shown('reps-0-1')).toEqual({ value: '', hint: '8' });
    await fireEvent.press(el('check-0-1')); // one tap logs the hint
    expect(row(sets()[1])).toEqual([135, 8, true]);
  });

  it('Boostcamp (from a recording): blank to start; the first circle logs last time; then the set above carries', async () => {
    await startWith([BENCH], { history: [lastWeek([[360, 10], [450, 8], [450, 8]])], sets: 3 });
    expect([0, 1, 2].map((i) => shown(`weight-0-${i}`).hint)).toEqual(['', '', '']); // no hints from history
    await fireEvent.press(el('check-0-0'));
    expect(row(sets()[0])).toEqual([360, 10, true]);
    expect([shown('weight-0-1').hint, shown('weight-0-2').hint]).toEqual(['360', '360']); // not set 2's own 450
    await type('weight-0-1', '385');
    expect(shown('weight-0-2').hint).toBe('385');
    await fireEvent.press(el('check-0-1'));
    await fireEvent.press(el('check-0-2'));
    expect(sets().map(row)).toEqual([
      [360, 10, true],
      [385, 10, true],
      [385, 10, true],
    ]);
  });

  it('tapping a field fills nothing in; the first key replaces its number, delete clears it', async () => {
    await startWith([BENCH]);
    await type('weight-0-0', '100');
    await fireEvent.press(el('keypad-hide'));
    expect(sets()[0].weight).toBe(100);
    await fireEvent.press(el('weight-0-1')); // hint 100, but nothing is filled in
    expect(sets()[1].weight).toBeNull();
    await fireEvent.press(el('weight-0-0'));
    await keys('95');
    expect(sets()[0].weight).toBe(95);
    await fireEvent.press(el('weight-0-0'));
    await fireEvent.press(el('key-del'));
    expect(sets()[0].weight).toBeNull();
  });

  it('Next walks weight → reps → the next unfinished set, then Done closes', async () => {
    await startWith([BENCH], { sets: 2 });
    await type('weight-0-0', '60');
    await fireEvent.press(el('keypad-next'));
    await keys('12');
    await fireEvent.press(el('keypad-next'));
    await keys('65');
    await fireEvent.press(el('keypad-next'));
    await keys('10');
    expect(el('keypad-next')).toHaveTextContent('Done');
    await fireEvent.press(el('keypad-next'));
    expect(screen.queryByTestId('keypad')).toBeNull();
    expect(sets().map(row)).toEqual([
      [60, 12, false],
      [65, 10, false],
    ]);
  });

  it('the next unchecked set in the workout is marked, and the mark follows each check', async () => {
    await startWith([BENCH, BENCH], { sets: 2 });
    // Rows of a finished (folded) exercise are gone, so look only at the circles that exist.
    const marked = () =>
      [0, 1].flatMap((ex) =>
        [0, 1]
          .filter((i) => {
            const check = screen.queryByTestId(`check-${ex}-${i}`);
            return check && within(check).queryByTestId(`up-next-${ex}`);
          })
          .map((i) => `${ex}-${i}`),
      );
    expect(marked()).toEqual(['0-0']);
    await log(0, '100', '5');
    expect(marked()).toEqual(['0-1']);
    expect(screen.queryByTestId('keypad')).toBeNull(); // marked, not focused
    await fireEvent.press(el('check-0-1'));
    expect(marked()).toEqual(['1-0']); // on to the next exercise
  });

  it('a number typed with the keypad still open is what the circle logs (repro of 24 → 450)', async () => {
    await startWith([BENCH], { history: [lastWeek([[360, 10], [360, 10], [450, 8], [450, 8]])], sets: 4 });
    await fireEvent.press(el('prev-0-2')); // copy last time into set 3
    await fireEvent.press(el('check-0-2'));
    await type('weight-0-3', '24'); // keypad still open
    await fireEvent.press(el('check-0-3'));
    expect(row(sets()[3])).toEqual([24, 8, true]);
  });

  it('tapping Previous while typing closes the pad, so the field shows what will be logged', async () => {
    await startWith([BENCH], { history: [lastWeek([[450, 8]])], sets: 1 });
    await type('weight-0-0', '24');
    await fireEvent.press(el('prev-0-0')); // copies 450 × 8
    expect(screen.queryByTestId('keypad')).toBeNull();
    expect(shown('weight-0-0').value).toBe('450');
    await fireEvent.press(el('check-0-0'));
    expect(row(sets()[0])).toEqual([450, 8, true]);
  });

  it('the pad’s RPE tab sets the set’s RPE; Clear removes it', async () => {
    await startWith([BENCH], { sets: 1 });
    await fireEvent.press(el('reps-0-0'));
    expect(el('keypad-tab-number')).toHaveTextContent('Reps');
    await fireEvent.press(el('keypad-tab-rpe'));
    await fireEvent.press(el('keypad-rpe-8.5'));
    expect(sets()[0].rpe).toBe(8.5);
    await fireEvent.press(el('keypad-clear'));
    expect(sets()[0].rpe).toBeNull();
    await fireEvent.press(el('keypad-tab-number'));
    await keys('6');
    expect(sets()[0].reps).toBe(6);
  });

  it('each keypad key gives a light tick, unless haptics are off in Profile', async () => {
    const tick = Haptics.selectionAsync as unknown as jest.Mock;
    await startWith([BENCH], { sets: 1 });
    tick.mockClear();
    await type('weight-0-0', '135');
    await fireEvent.press(el('keypad-next'));
    expect(tick).toHaveBeenCalledTimes(4);
    await act(async () => useStore.getState().updateSettings({ haptics: false }));
    await keys('8');
    expect(tick).toHaveBeenCalledTimes(4);
  });

  it('the marker follows an exercise started out of order', async () => {
    await startWith([BENCH, BENCH], { sets: 2 });
    expect(within(el('check-0-0')).queryByTestId('up-next-0')).toBeTruthy(); // untouched: the first
    await type('weight-1-0', '60'); // start with exercise 2
    await type('reps-1-0', '10');
    await fireEvent.press(el('check-1-0'));
    expect(useStore.getState().active!.currentRowId).toBe('row1');
    expect(within(el('check-1-1')).queryByTestId('up-next-1')).toBeTruthy();
    expect(screen.queryByTestId('up-next-0')).toBeNull();
    await fireEvent.press(el('check-1-1')); // exercise 2 done: back to exercise 1
    expect(within(el('check-0-0')).queryByTestId('up-next-0')).toBeTruthy();
  });

  it('the pad closes when the field it types into goes away (set or exercise deleted, swapped to timed)', async () => {
    await startWith([BENCH, BENCH], { sets: 2 });
    const drop = (fn: (w: Workout) => Workout) => act(async () => useStore.getState().updateActive(fn));
    await fireEvent.press(el('weight-0-1'));
    await drop((w) => ({ ...w, exercises: [{ ...w.exercises[0], sets: w.exercises[0].sets.slice(0, 1) }, w.exercises[1]] }));
    expect(screen.queryByTestId('keypad')).toBeNull();
    await fireEvent.press(el('reps-0-0'));
    await drop((w) => ({ ...w, exercises: [{ ...w.exercises[0], exerciseId: 'plank' }, w.exercises[1]] }));
    expect(screen.queryByTestId('keypad')).toBeNull(); // would have kept typing into hidden reps
    await fireEvent.press(el('weight-1-0'));
    await drop((w) => ({ ...w, exercises: [w.exercises[0]] }));
    expect(screen.queryByTestId('keypad')).toBeNull();
  });

  it('zero reps is not a set: the circle does nothing', async () => {
    await startWith([BENCH], { sets: 1 });
    await type('reps-0-0', '0');
    await fireEvent.press(el('check-0-0'));
    expect(sets()[0].done).toBe(false);
  });

  it('a superset alternates A1, B1, A2…; fixing an earlier exercise doesn’t move the marker', async () => {
    await startWith([BENCH, BENCH, BENCH], { sets: 2 });
    await act(async () => useStore.getState().updateActive((w) => ({ ...w, exercises: w.exercises.map((e, i) => (i < 2 ? { ...e, superset: 'g' } : e)) })));
    const marked = () => [0, 1, 2].find((i) => screen.queryByTestId(`up-next-${i}`));
    await log(0, '50', '8');
    expect(marked()).toBe(1); // B1 next
    await type('weight-1-0', '40');
    await type('reps-1-0', '10');
    await fireEvent.press(el('check-1-0'));
    expect(marked()).toBe(0); // then A2
    await fireEvent.press(el('check-0-1'));
    await fireEvent.press(el('check-1-1'));
    expect(marked()).toBe(2); // superset done: the next exercise
    await fireEvent.press(el('collapse-0'));
    await fireEvent.press(el('weight-0-0')); // fix a checked set of exercise 1
    expect(marked()).toBe(2);
  });

  it('a superset is one card with a tab per exercise; the tab follows the set you’re due, a tapped tab holds until the next check', async () => {
    await startWith([BENCH, BENCH], { sets: 2 });
    await act(async () => useStore.getState().updateActive((w) => ({ ...w, exercises: w.exercises.map((e) => ({ ...e, superset: 'g' })) })));
    const selected = () => [0, 1].find((i) => el(`superset-tab-${i}`).props.accessibilityState?.selected);
    expect(selected()).toBe(0);
    expect(screen.queryByTestId('set-row-1-0')).toBeNull(); // only the chosen exercise's sets
    await log(0, '50', '8');
    expect(selected()).toBe(1); // flipped to B for B1
    await fireEvent.press(el('superset-tab-0')); // peek back at A
    expect(selected()).toBe(0);
    await fireEvent.press(el('superset-tab-1'));
    await type('weight-1-0', '40');
    await type('reps-1-0', '10');
    await fireEvent.press(el('check-1-0'));
    expect(selected()).toBe(0); // A2 next
    expect(el('superset-tab-1')).toHaveTextContent(/1\/2/); // B's progress
  });

  it('starting a superset with B: opening its field stays on B (keypad open); its check moves to A', async () => {
    await startWith([BENCH, BENCH], { sets: 2 });
    await act(async () => useStore.getState().updateActive((w) => ({ ...w, exercises: w.exercises.map((e) => ({ ...e, superset: 'g' })) })));
    await fireEvent.press(el('superset-tab-1'));
    await type('weight-1-0', '40'); // the keypad stays on B's field
    expect(useStore.getState().active!.exercises[1].sets[0].weight).toBe(40);
    await type('reps-1-0', '10');
    await fireEvent.press(el('check-1-0'));
    expect(el('superset-tab-0').props.accessibilityState?.selected).toBe(true);
  });

  it('an empty circle with nothing to hint from does nothing', async () => {
    await startWith([BENCH]);
    await fireEvent.press(el('check-0-0'));
    expect(row(sets()[0])).toEqual([null, null, false]);
  });

  it('reps take whole numbers only; weight takes decimals', async () => {
    await startWith([BENCH]);
    await type('weight-0-0', '22.5');
    await type('reps-0-0', '8.5');
    expect([sets()[0].weight, sets()[0].reps]).toEqual([22.5, 85]);
  });

  it('note popup: OK saves trimmed, Delete clears', async () => {
    await startWith([BENCH], { notes: 'old note' });
    await fireEvent.press(screen.getAllByTestId('note-0')[0]);
    expect(el('note-input').props.value).toBe('old note');
    await fireEvent.changeText(el('note-input'), '  pause at the bottom  ');
    await fireEvent.press(el('note-ok'));
    expect(useStore.getState().active!.exercises[0].notes).toBe('pause at the bottom');
    await fireEvent.press(screen.getAllByTestId('note-0')[0]);
    await fireEvent.press(el('note-delete'));
    expect(useStore.getState().active!.exercises[0].notes).toBe('');
  });
});
