import { describe, expect, it } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { WorkoutEditor } from './WorkoutEditor';
import { useStore } from '@/lib/store';
import type { LoggedSet } from '@/lib/types';

// The tracker's behavior, without an emulator. What only a device proves (the keyboard, caret and
// text selection, gestures, navigation, pixels) stays in the Maestro flows.

const BENCH = 'bench-press-barbell';

/** The live tracker's editor, bound to the store like the workout screen does. */
function Tracker() {
  const active = useStore((s) => s.active);
  const updateActive = useStore((s) => s.updateActive);
  return active ? <WorkoutEditor workout={active} update={updateActive} mode="live" /> : null;
}

const emptySets = (n: number): LoggedSet[] => Array.from({ length: n }, (_, j) => ({ id: `s${j}`, type: 'normal', weight: null, reps: null, rpe: null, done: false }));

async function startWith(exerciseIds: string[], notes = '') {
  await act(async () => {
    useStore.getState().resetAll();
    useStore.getState().startEmptyWorkout();
    useStore.getState().updateActive((w) => ({ ...w, exercises: exerciseIds.map((exerciseId, i) => ({ id: `row${i}`, exerciseId, notes, sets: emptySets(3) })) }));
  });
  return await render(<Tracker />);
}

const sets = () => useStore.getState().active!.exercises[0].sets;
const row = (s: LoggedSet) => [s.weight, s.reps, s.done];
const field = (id: string) => screen.getByTestId(id);

async function log(i: number, w: string, r: string) {
  await fireEvent.changeText(field(`weight-0-${i}`), w);
  await fireEvent.changeText(field(`reps-0-${i}`), r);
  await fireEvent.press(field(`check-0-${i}`));
}

describe('tracker', () => {
  it('logs sets, then folds into "3 sets · best 135lb × 8" (best by estimated 1RM)', async () => {
    await startWith([BENCH]);
    await log(0, '135', '8');
    await log(1, '135', '8');
    await log(2, '140', '6');
    expect(sets().map(row)).toEqual([
      [135, 8, true],
      [135, 8, true],
      [140, 6, true],
    ]);
    expect(field('collapsed-summary-0')).toHaveTextContent('3 sets · best 135lb × 8');
  });

  it('with no history, hints come from the set above and the circle accepts them', async () => {
    await startWith([BENCH]);
    await log(0, '135', '8');
    expect(field('weight-0-1').props.placeholder).toBe('135');
    expect(field('reps-0-1').props.placeholder).toBe('8');
    await fireEvent.press(field('check-0-1'));
    expect(row(sets()[1])).toEqual([135, 8, true]);
  });

  it('an empty circle with nothing to hint from does nothing', async () => {
    await startWith([BENCH]);
    await fireEvent.press(field('check-0-0'));
    expect(row(sets()[0])).toEqual([null, null, false]);
  });

  it('focusing a set fills it from the hint, shown grey in an empty field so typing starts fresh', async () => {
    await startWith([BENCH]);
    await log(0, '135', '8');
    await fireEvent(field('weight-0-1'), 'focus');
    expect(row(sets()[1])).toEqual([135, 8, false]); // prefilled
    expect(field('weight-0-1').props.value).toBe('');
    expect(field('weight-0-1').props.placeholder).toBe('135');
    expect(field('reps-0-1').props.value).toBe('8');
    await fireEvent.changeText(field('weight-0-1'), '140');
    expect(sets()[1].weight).toBe(140);
  });

  it('leaving a focused field without typing keeps its number', async () => {
    await startWith([BENCH]);
    await fireEvent.changeText(field('weight-0-0'), '100');
    await fireEvent(field('weight-0-0'), 'focus');
    expect(field('weight-0-0').props.value).toBe('');
    await fireEvent(field('weight-0-0'), 'blur');
    expect(field('weight-0-0').props.value).toBe('100');
    expect(sets()[0].weight).toBe(100);
  });

  it('checking a set while its field is focused shows the number as the value, not a hint', async () => {
    await startWith([BENCH]);
    await log(0, '135', '8');
    await fireEvent(field('weight-0-1'), 'focus'); // filled from set 1, shown as the hint
    await fireEvent.press(field('check-0-1')); // no blur: the field is swapped out
    expect(row(sets()[1])).toEqual([135, 8, true]);
    expect(field('weight-0-1').props.value).toBe('135');
  });

  it('note popup: OK saves trimmed, Delete clears', async () => {
    await startWith([BENCH], 'old note');
    await fireEvent.press(screen.getAllByTestId('note-0')[0]);
    expect(field('note-input').props.value).toBe('old note');
    await fireEvent.changeText(field('note-input'), '  pause at the bottom  ');
    await fireEvent.press(field('note-ok'));
    expect(useStore.getState().active!.exercises[0].notes).toBe('pause at the bottom');
    await fireEvent.press(screen.getAllByTestId('note-0')[0]);
    await fireEvent.press(field('note-delete'));
    expect(useStore.getState().active!.exercises[0].notes).toBe('');
  });
});
