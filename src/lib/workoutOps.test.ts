import { describe, expect, it } from 'vitest';
import { makeBackup, mergePersisted, migrate, parseBackup } from './persistence';
import type { ActiveProgram, Exercise, LoggedSet, Settings, Workout } from './types';
import { convertWorkoutUnit, dedupeImported, finishWorkout, keepCompletedSets, markSlotDone, restAfterLoggedSet, resumeOnLoggedSet, supersetWith, trainingMax, unmarkWorkout } from './workoutOps';

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

  it('a set logged during a pause ends the pause without counting it; other edits leave it', () => {
    const paused = workout([['bench', [set(135, 8, false), set(135, 8, false)]]], { pausedMs: 30_000, pausedAt: 1_500_000 });
    const logged = { ...paused, exercises: [{ ...paused.exercises[0], sets: [{ ...paused.exercises[0].sets[0], done: true }, paused.exercises[0].sets[1]] }] };
    expect(resumeOnLoggedSet(paused, logged, 1_800_000)).toMatchObject({ pausedMs: 330_000, pausedAt: undefined });
    expect(resumeOnLoggedSet(paused, { ...paused, notes: 'x' }, 1_800_000).pausedAt).toBe(1_500_000);
    expect(resumeOnLoggedSet(logged, paused, 1_800_000).pausedAt).toBe(1_500_000); // unchecked
    const running = { ...logged, pausedAt: undefined };
    expect(resumeOnLoggedSet({ ...paused, pausedAt: undefined }, running, 1_800_000)).toBe(running);
  });

  it('checking a set starts that exercise’s rest; not after the last set, not mid-superset, not on other edits', () => {
    const check = (w: Workout, row: number, i: number): Workout => ({ ...w, exercises: w.exercises.map((e, r) => (r === row ? { ...e, sets: e.sets.map((s, k) => (k === i ? { ...s, done: true } : s)) } : e)) });
    const secs = (id: string) => ({ bench: 180, row: 90, curl: 0 })[id] ?? 120;
    const w = workout([['bench', [set(135, 8, false), set(135, 8, false)]], ['row', [set(90, 10, false)]], ['curl', [set(30, 10, false)]]]);
    const a = restAfterLoggedSet(w, check(w, 0, 0), 1_000_000, secs);
    expect(a.rest).toEqual({ endsAt: 1_180_000, seconds: 180 });
    // An edit that logs nothing keeps the running countdown; an exercise set to 0 clears it.
    expect(restAfterLoggedSet(a, { ...a, notes: 'x' }, 1_050_000, secs).rest).toEqual(a.rest);
    expect(restAfterLoggedSet(a, check(a, 2, 0), 1_050_000, secs).rest).toBeUndefined();
    // The workout's last set: nothing left to rest for.
    const one = workout([['bench', [set(135, 8, false)]]]);
    expect(restAfterLoggedSet(one, check(one, 0, 0), 1_000_000, secs).rest).toBeUndefined();
    // Superset A+B: no rest after A, rest (B's time) after B.
    const ss = { ...w, exercises: w.exercises.map((e, r) => (r < 2 ? { ...e, superset: 'g' } : e)) };
    expect(restAfterLoggedSet(ss, check(ss, 0, 0), 1_000_000, secs).rest).toBeUndefined();
    expect(restAfterLoggedSet(ss, check(ss, 1, 0), 1_000_000, secs).rest).toEqual({ endsAt: 1_090_000, seconds: 90 });
    // A finished workout doesn't keep a countdown.
    expect('rest' in finishWorkout(a, 1_100_000)).toBe(false);
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
    const withRest = { ...data, restByExercise: { bench: 180, curl: 0 } }; // per-exercise rest times travel too
    const back = parseBackup(makeBackup(withRest, new Date('2026-10-20T10:00:00Z')));
    expect(back).toEqual({ ok: true, exportedAt: '2026-10-20T10:00:00.000Z', data: { ...withRest, activeProgram: undefined } });
    const v0 = parseBackup(JSON.stringify({ app: 'liftbook', programs: [], history: [{ id: 'old' }] }));
    expect(v0.ok && v0.data).toMatchObject({ history: [{ id: 'old' }], customExercises: [], templates: [], oneRepMaxes: {}, restByExercise: {}, settings: {} });
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
