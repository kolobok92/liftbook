import { describe, expect, it } from 'vitest';
import { newSetTarget } from './calc';
import { setSuperset } from './programOps';
import type { Program, ProgramDay } from './types';

const day = (w: number, ids = ['a', 'b', 'c']): ProgramDay => ({
  id: `d${w}`,
  name: 'Push',
  exercises: ids.map((x) => ({ id: `${x}${w}`, exerciseId: x, notes: '', sets: [newSetTarget()] })),
});
const program = (mode: Program['mode'], weeks: ProgramDay[][]): Program => ({
  id: 'p', name: 'P', description: '', mode, numWeeks: weeks.length, createdAt: 0, updatedAt: 0,
  weeks: weeks.map((days, i) => ({ id: `w${i}`, days })),
});
/** Each week's day 0 as "a+b c": exercises in a superset joined by "+". */
const shape = (p: Program) =>
  p.weeks.map((w) => w.days[0].exercises.map((e, i, a) => e.exerciseId + (e.superset && a[i + 1]?.superset === e.superset ? '+' : ' ')).join('').trim());

describe('builder supersets', () => {
  it('a superset made in one week of a periodized program carries to every week with the same day', () => {
    const p = setSuperset(program('periodized', [[day(0)], [day(1)], [day(2)]]), 0, 0, 1, true);
    expect(shape(p)).toEqual(['a b+c', 'a b+c', 'a b+c']);
  });

  it('weeks whose day differs at those positions are left alone', () => {
    const p = setSuperset(program('periodized', [[day(0)], [day(1, ['a', 'x', 'c'])]]), 0, 0, 1, true);
    expect(shape(p)).toEqual(['a b+c', 'a x c']);
  });

  it('removing from a superset applies across weeks too', () => {
    let p = setSuperset(program('periodized', [[day(0)], [day(1)]]), 1, 0, 0, true);
    expect(shape(p)).toEqual(['a+b c', 'a+b c']);
    p = setSuperset(p, 0, 0, 0, false);
    expect(shape(p)).toEqual(['a b c', 'a b c']);
  });

  it('joins the partner’s existing group (three-way superset)', () => {
    let p = setSuperset(program('periodized', [[day(0)], [day(1)]]), 0, 0, 1, true);
    p = setSuperset(p, 0, 0, 0, true);
    expect(shape(p)).toEqual(['a+b+c', 'a+b+c']);
  });

  it('a repeating program has one template week', () => {
    const p = setSuperset(program('repeating', [[day(0)]]), 0, 0, 0, true);
    expect(shape(p)).toEqual(['a+b c']);
  });
});
