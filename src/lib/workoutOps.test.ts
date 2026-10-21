import { describe, expect, it } from 'vitest';
import { makeBackup, mergePersisted, migrate, parseBackup } from './persistence';
import type { ActiveProgram, Exercise, LoggedSet, Settings, Workout } from './types';
import { convertWorkoutUnit, dedupeImported, finishWorkout, keepCompletedSets, markSlotDone, supersetWith, trainingMax, unmarkWorkout } from './workoutOps';

let n = 0;
const set = (weight: number | null, reps: number | null, done = true): LoggedSet => ({ id: `s${n++}`, type: 'normal', weight, reps, rpe: null, done });
const workout = (exercises: [string, LoggedSet[]][], extra: Partial<Workout> = {}): Workout =>
  ({
    id: `w${n++}`,
    name: 'Push',
    notes: '',
    startedAt: 1_000_000,
    pausedMs: 0,
    unit: 'lb',
    exercises: exercises.map(([exerciseId, sets], i) => ({ id: `e${i}`, exerciseId, notes: '', sets })),
    ...extra,
  }) as Workout;

describe('finishing a workout', () => {
  it('keeps only checked sets, drops exercises with none, counts an open pause', () => {
    const w = workout([['bench', [set(135, 8), set(135, null, false)]], ['row', [set(null, null, false)]]], { pausedMs: 30_000, pausedAt: 1_500_000 });
    const f = finishWorkout(w, 1_800_000);
    expect(f.exercises.map((e) => [e.exerciseId, e.sets.length])).toEqual([['bench', 1]]);
    expect(f).toMatchObject({ endedAt: 1_800_000, pausedMs: 330_000, pausedAt: undefined });
    expect(keepCompletedSets(workout([['x', [set(1, 1, false)]]])).exercises).toEqual([]);
  });

  it("marks the running program's slot, and only that program's", () => {
    const active: ActiveProgram = { programId: 'pplua', startedAt: 0, completed: { '0-0': 'w-old' } };
    const f = workout([], { programRef: { programId: 'pplua', week: 1, day: 3 } });
    expect(markSlotDone(active, f)?.completed).toEqual({ '0-0': 'w-old', '1-3': f.id });
    expect(markSlotDone(active, workout([], { programRef: { programId: 'other', week: 0, day: 1 } }))).toBe(active);
    expect(markSlotDone(undefined, f)).toBeUndefined();
    expect(unmarkWorkout({ ...active, completed: { '0-0': 'w-old', '0-1': 'skipped' } }, 'w-old')?.completed).toEqual({ '0-1': 'skipped' });
  });
});

describe('unit conversion', () => {
  it('converts every set to 0.1, keeps empty weights, and leaves workouts already in that unit', () => {
    const w = workout([['bench', [set(100, 5), set(null, 12), set(22.5, 10)]]]);
    expect(convertWorkoutUnit(w, 'lb', 'kg').exercises[0].sets.map((s) => s.weight)).toEqual([45.4, null, 10.2]);
    const kg = workout([], { unit: 'kg' });
    expect(convertWorkoutUnit(kg, 'lb', 'kg')).toBe(kg);
  });
});

describe('importing workouts', () => {
  it('skips ones already in history and adds only the custom exercises the new ones use', () => {
    const have = workout([['bench', [set(1, 1)]]], { startedAt: 5, name: 'Push' });
    const dup = workout([['jm-press', [set(1, 1)]]], { startedAt: 5, name: 'Push' });
    const fresh = workout([['y-raise', [set(1, 1)]]], { startedAt: 6, name: 'Pull' });
    const ex = (id: string) => ({ id, name: id }) as Exercise;
    const r = dedupeImported([have], [dup, fresh], [ex('already-custom')], [ex('jm-press'), ex('y-raise'), ex('already-custom')]);
    expect(r.fresh).toEqual([fresh]);
    expect(r.addCustom.map((e) => e.id)).toEqual(['y-raise']);
  });
});

describe('training max', () => {
  it('prefers the entered 1RM, else the best estimate from history', () => {
    const h = [workout([['bench', [set(205, 3), set(185, 5)]]], { endedAt: 2 })];
    expect(trainingMax({ bench: 250 }, h, 'bench')).toBe(250);
    expect(trainingMax({}, h, 'bench')).toBeCloseTo(225.5);
    expect(trainingMax({}, h, 'squat')).toBeUndefined();
  });
});

describe('persistence', () => {
  const defaults = { unit: 'lb', haptics: true, appearance: 'system' } as Settings;
  it('fills settings added after the data was saved, keeping the stored ones', () => {
    const merged = mergePersisted({ settings: { unit: 'kg' } as Settings }, { settings: defaults, history: [] }, defaults);
    expect(merged.settings).toEqual({ unit: 'kg', haptics: true, appearance: 'system' });
    expect(mergePersisted(undefined, { settings: defaults }, defaults).settings).toEqual(defaults);
  });
  it('migrates v0 data without changing it, and returns a copy', () => {
    const v0 = { history: [], programs: [] };
    const out = migrate(v0, 0);
    expect(out).toEqual(v0);
    expect(out).not.toBe(v0);
  });
});

describe('backups', () => {
  const data = {
    programs: [{ id: 'p' }],
    history: [{ id: 'w', notes: 'Slept badly', exercises: [{ exerciseId: 'leg-press', notes: 'Set at 3 depth', sets: [] }] }],
    customExercises: [],
    templates: [],
    oneRepMaxes: { bench: 225 },
    settings: { unit: 'kg' as const },
  };
  it('round-trips, and old (unversioned) backups go through migrate', () => {
    const back = parseBackup(makeBackup(data, new Date('2026-10-20T10:00:00Z')));
    expect(back).toEqual({ ok: true, exportedAt: '2026-10-20T10:00:00.000Z', data: { ...data, activeProgram: undefined } });
    const v0 = parseBackup(JSON.stringify({ app: 'liftbook', programs: [], history: [{ id: 'old' }] }));
    expect(v0.ok && v0.data).toMatchObject({ history: [{ id: 'old' }], customExercises: [], templates: [], oneRepMaxes: {}, settings: {} });
  });
  it('refuses other files and backups from a newer app', () => {
    expect(parseBackup('not json')).toMatchObject({ ok: false });
    expect(parseBackup(JSON.stringify({ app: 'strong', history: [], programs: [] }))).toMatchObject({ ok: false });
    expect(parseBackup(JSON.stringify({ app: 'liftbook', version: 999, history: [], programs: [] }))).toMatchObject({ ok: false, error: expect.stringContaining('newer version') });
  });
});

describe('superset with any exercise', () => {
  const rows = (...ids: string[]) => ids.map((id) => ({ id, superset: undefined as string | undefined }));
  const view = (r: { id: string; superset?: string }[]) => r.map((x) => x.id + (x.superset ? `:${x.superset}` : '')).join(' ');
  it('pairs with a later exercise and moves it right below', () => {
    expect(view(supersetWith(rows('a', 'b', 'c', 'd'), 'a', 'c', 'g'))).toBe('a:g c:g b d');
  });
  it('pairs with an earlier exercise, and a third joins the same group', () => {
    const two = supersetWith(rows('a', 'b', 'c', 'd'), 'd', 'a', 'g');
    expect(view(two)).toBe('b c d:g a:g');
    expect(view(supersetWith(two, 'd', 'b', 'h'))).toBe('c d:g a:g b:g');
  });
  it('an exercise leaves its old superset to join the new one', () => {
    const r = [{ id: 'a', superset: 'x' }, { id: 'b', superset: 'x' }, { id: 'c' }];
    expect(view(supersetWith(r, 'c', 'b', 'g'))).toBe('a:x c:g b:g');
  });
});
