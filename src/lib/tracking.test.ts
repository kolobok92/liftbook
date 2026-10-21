import { describe, expect, it } from 'vitest';
import { fmtSet, newSetTarget } from './calc';
import {
  autofillWorkout,
  carriedNote,
  carryNotes,
  completeSet,
  detectPRs,
  emptySet,
  findPrevious,
  hintFor,
  previousSetFor,
  suggestFor,
} from './tracking';
import type { LoggedSet, Workout } from './types';

let n = 0;
const set = (weight: number | null, reps: number | null, extra: Partial<LoggedSet> = {}): LoggedSet => ({
  id: `s${n++}`,
  type: 'normal',
  weight,
  reps,
  rpe: null,
  done: true,
  ...extra,
});

const workout = (startedAt: number, exercises: Workout['exercises'], extra: Partial<Workout> = {}): Workout => ({
  id: `w${startedAt}`,
  name: 'W',
  notes: '',
  startedAt,
  endedAt: startedAt + 3600_000,
  pausedMs: 0,
  exercises,
  unit: 'lb',
  ...extra,
});

const bench = (sets: LoggedSet[]) => ({ id: `e${n++}`, exerciseId: 'bench', notes: '', sets });

describe('findPrevious', () => {
  it('returns the most recent session with completed sets of the exercise', () => {
    const h = [workout(1000, [bench([set(100, 5)])]), workout(2000, [bench([set(105, 5)])]), workout(3000, [bench([set(999, 1, { done: false })])])];
    expect(findPrevious(h, 'bench')?.sets.map((s) => s.weight)).toEqual([105]);
  });

  it('prefers the same program day over a more recent session', () => {
    const h = [
      workout(1000, [bench([set(100, 5)])], { programRef: { programId: 'p', week: 0, day: 1 } }),
      workout(2000, [bench([set(60, 12)])], { programRef: { programId: 'p', week: 0, day: 3 } }),
    ];
    expect(findPrevious(h, 'bench', { programRef: { programId: 'p', week: 1, day: 1 } })?.sets[0].weight).toBe(100);
    expect(findPrevious(h, 'bench')?.sets[0].weight).toBe(60);
  });

});

describe('previousSetFor', () => {
  it('pairs sets by type so warm-ups do not shift working sets', () => {
    const prev = [set(45, 10, { type: 'warmup' }), set(100, 5), set(110, 3)];
    const cur = [emptySet('warmup'), emptySet('warmup'), emptySet(), emptySet()];
    expect(previousSetFor(cur, 0, prev)?.weight).toBe(45);
    expect(previousSetFor(cur, 1, prev)).toBeUndefined();
    expect(previousSetFor(cur, 2, prev)?.weight).toBe(100);
    expect(previousSetFor(cur, 3, prev)?.weight).toBe(110);
  });

  it('has no previous for sets beyond last session (no fallback to the last set)', () => {
    const prev = [set(100, 5), set(95, 5)];
    const cur = [emptySet(), emptySet(), emptySet()];
    expect(previousSetFor(cur, 1, prev)?.weight).toBe(95);
    expect(previousSetFor(cur, 2, prev)).toBeUndefined();
    expect(suggestFor({ sets: cur, index: 2, prev, rounding: 5 })).toMatchObject({ weight: null, reps: null });
  });
});

describe('suggestFor', () => {
  it('suggests last session numbers set-by-set', () => {
    const prev = [set(100, 8), set(95, 7)];
    const cur = [emptySet(), emptySet()];
    expect(suggestFor({ sets: cur, index: 0, prev, rounding: 5 })).toMatchObject({ weight: 100, reps: 8 });
    expect(suggestFor({ sets: cur, index: 1, prev, rounding: 5 })).toMatchObject({ weight: 95, reps: 7 });
  });




  it('computes weight from % of 1RM, rounded to the plate step', () => {
    const t = newSetTarget({ target: { kind: 'reps', reps: 5 }, intensity: { kind: 'pct', pct: 75 } });
    const cur = [{ ...emptySet(), target: t }];
    expect(suggestFor({ sets: cur, index: 0, prev: [set(100, 8)], oneRepMax: 300, rounding: 5 })).toMatchObject({ weight: 225, reps: 8 });
  });

});


describe('autofillWorkout', () => {
  it('fills each set from its match in history; extra sets copy the set above', () => {
    const h = [workout(1000, [bench([set(100, 8), set(100, 7)])])];
    const w = workout(5000, [bench([emptySet(), emptySet(), emptySet()])], { endedAt: undefined, id: 'cur' });
    const filled = autofillWorkout(w, h, () => undefined, 5);
    expect(filled.exercises[0].sets.map((s) => [s.weight, s.reps])).toEqual([
      [100, 8],
      [100, 7],
      [100, 7],
    ]);
  });
});

describe('detectPRs', () => {
  it('flags weight and e1RM PRs against earlier history only', () => {
    const h = [workout(1000, [bench([set(100, 5)])])];
    const w = workout(2000, [bench([set(110, 5), set(100, 5)])]);
    const kinds = detectPRs(w, h).map((p) => p.kind).sort();
    expect(kinds).toEqual(['e1rm', 'volume', 'weight']);
  });


  it('ignores warm-up sets', () => {
    const h = [workout(1000, [bench([set(100, 5)])])];
    const w = workout(2000, [bench([set(200, 5, { type: 'warmup' }), set(95, 5)])]);
    expect(detectPRs(w, h)).toEqual([]);
  });
});



describe('display derivations', () => {
  it('best set is the highest e1RM, not the most volume, and ignores warm-ups', async () => {
    const { bestSet } = await import('./calc');
    const best = bestSet([set(200, 10, { type: 'warmup' }), set(170, 8), set(180, 7)]);
    expect([best?.weight, best?.reps]).toEqual([180, 7]); // 170×8 has more volume, 180×7 the higher e1RM
  });

  it('PR values keep logged weights exact and round only estimates', async () => {
    const { fmtPR } = await import('./tracking');
    expect(fmtPR({ kind: 'weight', value: 22.5 }, 'lb')).toBe('22.5 lb');
    expect(fmtPR({ kind: 'e1rm', value: 225.5 }, 'lb')).toBe('226 lb');
    expect(fmtPR({ kind: 'reps', value: 12 }, 'lb')).toBe('12 reps');
  });
});

describe('setLabels', () => {
  it('numbers only normal sets; warm-up, drop and failure get letters', async () => {
    const { setLabels } = await import('./calc');
    const t = (type: 'normal' | 'warmup' | 'drop' | 'failure') => ({ type });
    expect(setLabels([t('warmup'), t('warmup'), t('normal'), t('normal'), t('drop'), t('normal'), t('failure')])).toEqual(['W', 'W', '1', '2', 'D', '3', 'F']);
  });
});

describe('fmtSet (one set format everywhere)', () => {
  it('matches the Previous column: weight+unit × reps, BW, timed, decimals', () => {
    expect(fmtSet({ weight: 135, reps: 8 }, 'lb')).toBe('135lb × 8');
    expect(fmtSet({ weight: 22.5, reps: 12 }, 'lb')).toBe('22.5lb × 12');
    expect(fmtSet({ weight: 45.36, reps: 5 }, 'kg')).toBe('45.36kg × 5');
    expect(fmtSet({ weight: null, reps: 12 }, 'lb')).toBe('BW × 12');
    expect(fmtSet({ weight: null, seconds: 45 }, 'lb')).toBe('45s');
    expect(fmtSet({ weight: 20, seconds: 30 }, 'kg')).toBe('20kg × 30s');
    expect(fmtSet({ weight: 0, reps: 5 }, 'lb')).toBe('0lb × 5');
  });
});

describe('hints and the circle (as Boostcamp, from a screen recording)', () => {
  const prev = [set(360, 10), set(450, 8), set(450, 8), set(450, 8)];
  const hint = (cur: LoggedSet[], i: number) => hintFor({ sets: cur, index: i, prev, rounding: 5 });
  const tap = (cur: LoggedSet[], i: number) => (cur[i] = completeSet(cur[i], suggestFor({ sets: cur, index: i, prev, rounding: 5 })));

  it('no grey hints from history: fields start blank; the first circle logs last session', () => {
    const cur = [emptySet(), emptySet(), emptySet(), emptySet()];
    expect([0, 1, 2, 3].map((i) => hint(cur, i))).toEqual(Array(4).fill({ weight: null, reps: null, seconds: null, rpe: null }));
    tap(cur, 0);
    expect([cur[0].weight, cur[0].reps]).toEqual([360, 10]);
  });

  it('every set below hints the set above, even over its own history (360 shown on a 450 set)', () => {
    const cur = [emptySet(), emptySet(), emptySet(), emptySet()];
    tap(cur, 0);
    expect([1, 2, 3].map((i) => [hint(cur, i).weight, hint(cur, i).reps])).toEqual([
      [360, 10],
      [360, 10],
      [360, 10],
    ]);
    tap(cur, 1);
    expect([cur[1].weight, cur[1].reps]).toEqual([360, 10]);
    cur[2] = { ...cur[2], weight: 400 }; // typed, not yet checked
    expect([hint(cur, 3).weight, hint(cur, 3).reps]).toEqual([400, 10]);
    tap(cur, 2);
    expect([cur[2].weight, cur[2].reps]).toEqual([400, 10]);
  });

  it('never crosses set types; a warm-up above hints nothing for a working set', () => {
    const cur = [set(45, 10, { type: 'warmup', done: true }), emptySet(), emptySet()];
    expect(hint(cur, 1)).toMatchObject({ weight: null, reps: null });
    cur[1] = completeSet(cur[1], suggestFor({ sets: cur, index: 1, prev: [set(45, 10, { type: 'warmup' }), set(100, 5)], rounding: 5 }));
    expect([cur[1].weight, cur[1].reps]).toEqual([100, 5]); // its own last-session match
  });

  it('a % of 1RM weight is the program’s, even under a changed set', () => {
    const t = newSetTarget({ target: { kind: 'reps', reps: 5 }, intensity: { kind: 'pct', pct: 75 } });
    const cur = [set(200, 5, { done: false }), { ...emptySet(), target: t }];
    expect(hintFor({ sets: cur, index: 1, prev: undefined, oneRepMax: 300, rounding: 5 })).toMatchObject({ weight: 225, reps: 5 });
  });

  it('an empty set with no hint and no history logs nothing', () => {
    const cur = [emptySet()];
    const c = completeSet(cur[0], suggestFor({ sets: cur, index: 0, prev: undefined, rounding: 5 }));
    expect([c.weight, c.reps]).toEqual([null, null]);
  });
});

describe('notes carry over (Boostcamp)', () => {
  const legPress = (notes: string, startedAt: number): Workout => workout(startedAt, [{ id: 'e', exerciseId: 'leg-press', notes, sets: [set(360, 10)] }]);
  it('each new session starts with the exercise’s latest note; a deleted note stays deleted', () => {
    const h = [legPress('Set at 2 depth', 1000), legPress('Set at 3 depth', 2000)];
    expect(carriedNote(h, 'leg-press')).toBe('Set at 3 depth');
    const next = carryNotes(workout(3000, [{ id: 'n', exerciseId: 'leg-press', notes: '', sets: [] }], { endedAt: undefined }), h);
    expect(next.exercises[0].notes).toBe('Set at 3 depth');
    expect(carriedNote([...h, legPress('', 3000)], 'leg-press')).toBe(''); // cleared last time
    expect(carriedNote(h, 'squat')).toBe('');
  });
  it('a note typed in the new session is kept, not overwritten', () => {
    const next = carryNotes(workout(3000, [{ id: 'n', exerciseId: 'leg-press', notes: 'Seat 4', sets: [] }], { endedAt: undefined }), [legPress('Set at 3 depth', 1000)]);
    expect(next.exercises[0].notes).toBe('Seat 4');
  });
});
