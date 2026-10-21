import { describe, expect, it } from 'vitest';
import { newSetTarget } from './calc';
import { applyWorkoutToProgram, changeItems, dayFromWorkout } from './programSync';
import { emptySet, newWorkout, workoutExerciseFromProgram } from './tracking';
import type { Program, ProgramDay, Workout } from './types';

const t = (min: number, max: number, pct?: number) =>
  newSetTarget({ target: { kind: 'range', min, max }, intensity: pct ? { kind: 'pct', pct } : { kind: 'none' } });

function program(mode: Program['mode'] = 'loop'): Program {
  const day = (w: number): ProgramDay => ({
    id: `d${w}`,
    name: 'Push',
    exercises: [
      { id: `bench${w}`, exerciseId: 'bench', notes: 'pause', sets: [t(5, 5, 70 + w * 5), t(5, 5, 70 + w * 5), t(5, 5, 70 + w * 5)] },
      { id: `fly${w}`, exerciseId: 'fly', notes: '', sets: [t(10, 15), t(10, 15)] },
      { id: `dip${w}`, exerciseId: 'dip', notes: '', sets: [t(8, 12)] },
    ],
  });
  const weeks = mode === 'periodized' ? [0, 1, 2].map((w) => ({ id: `w${w}`, days: [day(w)] })) : [{ id: 'w0', days: [day(0)] }];
  return { id: 'p', name: 'P', description: '', mode, numWeeks: 3, weeks, createdAt: 0, updatedAt: 0 };
}

function workoutFor(p: Program, week = 0): Workout {
  const d = p.mode === 'periodized' ? p.weeks[week].days[0] : p.weeks[0].days[0];
  return newWorkout('Push', 'lb', d.exercises.map(workoutExerciseFromProgram), { programId: 'p', week, day: 0 });
}

const name = (id: string) => id;
const items = (p: Program, w: Workout) => changeItems(p.weeks[w.programRef!.week]?.days[0] ?? p.weeks[0].days[0], dayFromWorkout(w, p.weeks[w.programRef!.week]?.days[0] ?? p.weeks[0].days[0]), name);

describe('program sync', () => {
  it('unchecked (skipped) sets are not a change', () => {
    const p = program();
    const w = workoutFor(p);
    w.exercises[0].sets[0].done = true; // others left unchecked
    expect(items(p, w)).toEqual([]);
  });

  it('one item per changed exercise, combining its changes', () => {
    const p = program();
    const w = workoutFor(p);
    w.exercises[0] = { ...w.exercises[0], exerciseId: 'incline', sets: [...w.exercises[0].sets, emptySet()] };
    w.exercises.splice(2, 1); // remove dips
    const list = items(p, w);
    expect(list.map((i) => [i.title, i.details])).toEqual([
      ['bench', ['Swapped for incline', '3 → 4 sets']],
      ['dip', ['Removed']],
    ]);
  });

  it('applies only the accepted exercises', () => {
    const p = program();
    const w = workoutFor(p);
    w.exercises[0] = { ...w.exercises[0], exerciseId: 'incline' };
    w.exercises.splice(2, 1);
    const next = applyWorkoutToProgram(p, w, 'template', new Set(['ex:bench0'])).weeks[0].days[0];
    expect(next.exercises.map((e) => e.exerciseId)).toEqual(['incline', 'fly', 'dip']); // dip removal rejected
    expect(next.exercises[0].notes).toBe('pause'); // program instructions kept on a swap
  });

  it('a rejected reorder keeps program order while accepting other changes', () => {
    const p = program();
    const w = workoutFor(p);
    w.exercises.reverse();
    w.exercises[0] = { ...w.exercises[0], sets: [...w.exercises[0].sets, emptySet()] }; // dip +1 set
    const list = items(p, w);
    expect(list.map((i) => i.key)).toEqual(['ex:dip0', 'order']);
    const next = applyWorkoutToProgram(p, w, 'template', new Set(['ex:dip0'])).weeks[0].days[0];
    expect(next.exercises.map((e) => [e.exerciseId, e.sets.length])).toEqual([
      ['bench', 3],
      ['fly', 2],
      ['dip', 2],
    ]);
  });

  it('an added set copies the previous set target', () => {
    const p = program();
    const w = workoutFor(p);
    w.exercises[1].sets.push(emptySet());
    const next = applyWorkoutToProgram(p, w, 'template', new Set(['ex:fly0'])).weeks[0].days[0];
    expect(next.exercises[1].sets.map((s) => s.target)).toEqual([0, 1, 2].map(() => ({ kind: 'range', min: 10, max: 15 })));
  });

  it('periodized "this and later weeks" applies the edit but keeps each week\'s own targets', () => {
    const p = program('periodized');
    const w = workoutFor(p, 1);
    w.exercises[0].sets.push(emptySet()); // bench 3 → 4 in week 2
    const next = applyWorkoutToProgram(p, w, 'fromWeek', new Set(['ex:bench1']));
    const pct = (week: number) => next.weeks[week].days[0].exercises[0].sets.map((s) => (s.intensity.kind === 'pct' ? s.intensity.pct : 0));
    expect(pct(0)).toEqual([70, 70, 70]); // earlier week untouched
    expect(pct(1)).toEqual([75, 75, 75, 75]);
    expect(pct(2)).toEqual([80, 80, 80, 80]); // later week: its own 80%, one more set
  });

  it('periodized "this week only" leaves other weeks alone', () => {
    const p = program('periodized');
    const w = workoutFor(p, 1);
    w.exercises[0].sets.push(emptySet());
    const next = applyWorkoutToProgram(p, w, 'week', new Set(['ex:bench1']));
    expect(next.weeks.map((wk) => wk.days[0].exercises[0].sets.length)).toEqual([3, 4, 3]);
  });
});
