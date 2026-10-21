import { describe, expect, it } from 'vitest';
import { workoutActivity } from './liveActivityState';
import type { Exercise, LoggedSet, Workout } from './types';

const set = (done: boolean): LoggedSet => ({ id: Math.random().toString(), type: 'normal', weight: 100, reps: 5, rpe: null, done });
const byId = { bench: { id: 'bench', name: 'Bench Press (Barbell)' }, row: { id: 'row', name: 'T-Bar Row' } } as unknown as Record<string, Exercise>;
const w = (exercises: [string, boolean[]][], extra: Partial<Workout> = {}): Workout =>
  ({
    id: 'w', name: 'Push', notes: '', startedAt: 1_000_000, pausedMs: 0, unit: 'lb',
    exercises: exercises.map(([exerciseId, sets], i) => ({ id: `e${i}`, exerciseId, notes: '', sets: sets.map(set) })),
    ...extra,
  }) as Workout;

describe('workoutActivity', () => {
  it('names the first unchecked set, skipping done ones and finished exercises', () => {
    const a = workoutActivity(w([['bench', [true, true, true]], ['row', [true, false, false, false]]]), byId);
    expect(a).toEqual({ title: 'T-Bar Row', subtitle: 'Set 2 of 4', startedAt: 1_000_000 });
  });

  it('follows the exercise you started out of order, then moves on to the next unfinished one', () => {
    const plan: [string, boolean[]][] = [['bench', [false, false]], ['row', [true, false]], ['curl', [false]]];
    // Started with the second exercise: the lock screen shows it, not the untouched first one.
    expect(workoutActivity(w(plan, { currentRowId: 'e1' }), byId)).toMatchObject({ title: 'T-Bar Row', subtitle: 'Set 2 of 2' });
    // Finished it: the next unfinished exercise after it, wrapping to the top past the end.
    const rowDone: [string, boolean[]][] = [['bench', [false, false]], ['row', [true, true]], ['curl', [true]]];
    expect(workoutActivity(w(rowDone, { currentRowId: 'e1' }), byId)).toMatchObject({ title: 'Bench Press (Barbell)', subtitle: 'Set 1 of 2' });
  });

  it('counts up from the start minus time spent paused', () => {
    expect(workoutActivity(w([['bench', [false]]], { pausedMs: 90_000 }), byId).startedAt).toBe(1_090_000);
  });

  it('while paused shows progress instead of a clock that would keep running', () => {
    const a = workoutActivity(w([['bench', [true, false, false]], ['row', [true]]], { pausedAt: 2_000_000 }), byId);
    expect(a).toEqual({ title: 'Bench Press (Barbell)', subtitle: '2/4 sets done', progress: 0.5 });
  });

  it('all done, unknown exercise ids and empty workouts read sensibly', () => {
    expect(workoutActivity(w([['bench', [true, true]]]), byId)).toMatchObject({ title: 'Push', subtitle: 'All sets done · 2/2 sets' });
    expect(workoutActivity(w([['gone', [false]]]), byId)).toMatchObject({ title: 'Exercise', subtitle: 'Set 1 of 1' });
    expect(workoutActivity(w([], { pausedAt: 5 }), byId)).toMatchObject({ subtitle: '0/0 sets done', progress: 0 });
  });

  it('names the current exercise thumbnail only when one is bundled', () => {
    const has = (id: string) => id === 'row';
    expect(workoutActivity(w([['bench', [true]], ['row', [false]]]), byId, has).image).toBe('row');
    expect(workoutActivity(w([['bench', [false]], ['row', [false]]]), byId, has).image).toBeUndefined();
    expect(workoutActivity(w([['row', [true]]]), byId, has).image).toBeUndefined(); // all done: no current exercise
  });

  it('adds the set target in brackets, like Boostcamp: "Set 1 of 4 (5–8 reps)"', () => {
    const wk = w([['row', [false, false, false, false]]]);
    wk.exercises[0].sets[0].target = { id: 't', type: 'normal', target: { kind: 'range', min: 5, max: 8 } } as never;
    expect(workoutActivity(wk, byId).subtitle).toBe('Set 1 of 4 (5–8 reps)');
  });
});
