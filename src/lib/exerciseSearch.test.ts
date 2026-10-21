import { describe, expect, it } from 'vitest';
import { filterExercises } from './exerciseSearch';
import { BUILTIN_EXERCISES } from './exercises';

// Against the real library (curated + ~800 imported): the lift you typed should be first.
const top = (q: string, n = 1) => filterExercises(BUILTIN_EXERCISES, { q }).slice(0, n).map((e) => e.name);

describe('exercise search ranking', () => {
  it('puts the main lift first for "<lift> <equipment>" queries', () => {
    expect(top('squat barbell')).toEqual(['Squat (Barbell)']);
    expect(top('bench barbell')).toEqual(['Bench Press (Barbell)']);
    expect(top('deadlift')).toEqual(['Deadlift (Barbell)']);
    expect(top('lateral raise')[0]).toMatch(/^Lateral Raise \(/);
  });

  it('still requires every word, and lists alphabetically without a query', () => {
    expect(filterExercises(BUILTIN_EXERCISES, { q: 'squat barbell' }).every((e) => /squat/i.test(e.name) && /barbell/i.test(e.name))).toBe(true);
    const all = filterExercises(BUILTIN_EXERCISES, { q: '' }).map((e) => e.name);
    expect(all).toEqual([...all].sort((a, b) => a.localeCompare(b)));
  });
});
