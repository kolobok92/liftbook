import { e1rm, fmtNum, roundTo, uid } from './calc';
import type {
  LoggedSet,
  Program,
  ProgramDay,
  ProgramExercise,
  ProgramRef,
  SetType,
  Template,
  Unit,
  Workout,
  WorkoutExercise,
} from './types';

type HistoryIndex = {
  /** Finished workouts, newest first. */
  sorted: Workout[];
  /** exerciseId → finished workouts containing it, newest first. */
  byExercise: Map<string, Workout[]>;
  /** Unfiltered records per exercise (the common case), filled lazily. */
  records: Map<string, ExerciseRecords>;
};

// History arrays are immutable (every change makes a new array), so index each version once
// instead of re-sorting/re-scanning all history per exercise card or per lookup.
const indexes = new WeakMap<Workout[], HistoryIndex>();

function historyIndex(history: Workout[]): HistoryIndex {
  let idx = indexes.get(history);
  if (idx) return idx;
  const sorted = history.filter((w) => w.endedAt).sort((a, b) => b.startedAt - a.startedAt);
  const byExercise = new Map<string, Workout[]>();
  for (const w of sorted) {
    for (const id of new Set(w.exercises.map((e) => e.exerciseId))) {
      const list = byExercise.get(id);
      if (list) list.push(w);
      else byExercise.set(id, [w]);
    }
  }
  idx = { sorted, byExercise, records: new Map() };
  indexes.set(history, idx);
  return idx;
}

/** Finished workouts, newest first. Shared and cached — don't mutate the result. */
export function sortedHistory(history: Workout[]): Workout[] {
  return historyIndex(history).sorted;
}

export type PreviousPerformance = {
  workout: Workout;
  exercise: WorkoutExercise;
  /** Only the sets that were completed. */
  sets: LoggedSet[];
};

/**
 * The last time this exercise was performed. When a program slot is given, the last
 * time that same program day was run wins, so "Previous" lines up with the week before.
 */
export function findPrevious(
  history: Workout[],
  exerciseId: string,
  opts: { programRef?: ProgramRef; excludeWorkoutId?: string; before?: number } = {},
): PreviousPerformance | undefined {
  const list = (historyIndex(history).byExercise.get(exerciseId) ?? []).filter(
    (w) => w.id !== opts.excludeWorkoutId && (opts.before == null || w.startedAt < opts.before),
  );
  const pick = (w: Workout): PreviousPerformance | undefined => {
    const exercise = w.exercises.find((e) => e.exerciseId === exerciseId && e.sets.some((s) => s.done));
    if (!exercise) return undefined;
    return { workout: w, exercise, sets: exercise.sets.filter((s) => s.done) };
  };
  if (opts.programRef) {
    const ref = opts.programRef;
    for (const w of list) {
      if (w.programRef && w.programRef.programId === ref.programId && w.programRef.day === ref.day) {
        const p = pick(w);
        if (p) return p;
      }
    }
  }
  for (const w of list) {
    const p = pick(w);
    if (p) return p;
  }
  return undefined;
}

/** nth set of the same type (0-based) within a list. */
function ordinalOfType(sets: { type: SetType }[], index: number): number {
  const type = sets[index].type;
  let n = 0;
  for (let i = 0; i < index; i++) if (sets[i].type === type) n++;
  return n;
}

/**
 * The previous-session set that corresponds to set `index` of the current exercise.
 * Sets are paired by type (2nd working set ↔ 2nd working set) so adding warm-ups
 * doesn't shift everything; falls back to position.
 */
export function previousSetFor(current: { type: SetType }[], index: number, prev: LoggedSet[] | undefined): LoggedSet | undefined {
  if (!prev || prev.length === 0) return undefined;
  const type = current[index].type;
  const ord = ordinalOfType(current, index);
  const sameType = prev.filter((s) => s.type === type);
  if (sameType[ord]) return sameType[ord];
  if (type !== 'warmup') {
    const working = prev.filter((s) => s.type !== 'warmup');
    const workingOrd = current.slice(0, index).filter((s) => s.type !== 'warmup').length;
    // No fallback to the last set: a set beyond last session's count has no "previous" (Boostcamp).
    return working[workingOrd];
  }
  return undefined;
}

export type Suggestion = { weight: number | null; reps: number | null; seconds: number | null; rpe: number | null };

export type SuggestCtx = {
  sets: LoggedSet[];
  index: number;
  prev: LoggedSet[] | undefined;
  /** Training max / 1RM for %-based targets. */
  oneRepMax?: number;
  rounding: number;
};

type HintField = 'weight' | 'reps' | 'seconds';

/**
 * The grey hint in a set's fields, as Boostcamp shows it: the numbers in the nearest set above
 * (same type) this session, whether typed or taken from last session. Nothing comes from history
 * here: until a set above has numbers, the fields are blank (the Previous column shows last
 * time). A "% of 1RM" set's weight is the program's.
 */
export function hintFor(ctx: SuggestCtx): Suggestion {
  const { sets, index, oneRepMax, rounding } = ctx;
  const intensity = sets[index].target?.intensity;
  const pctWeight = intensity?.kind === 'pct' && oneRepMax ? roundTo((oneRepMax * intensity.pct) / 100, rounding) : null;
  return { weight: pctWeight ?? fromAbove(sets, index, 'weight'), reps: fromAbove(sets, index, 'reps'), seconds: fromAbove(sets, index, 'seconds'), rpe: null };
}

/**
 * What one tap on a set's circle logs into its empty fields: the hint, or with no hint yet (e.g.
 * set 1), last session's matching set (Boostcamp: the first tap logs last time's numbers).
 */
export function suggestFor(ctx: SuggestCtx): Suggestion {
  const hint = hintFor(ctx);
  const last = previousSetFor(ctx.sets, ctx.index, ctx.prev);
  return { weight: hint.weight ?? last?.weight ?? null, reps: hint.reps ?? last?.reps ?? null, seconds: hint.seconds ?? last?.seconds ?? null, rpe: null };
}

function fromAbove(sets: LoggedSet[], index: number, f: HintField): number | null {
  const type = sets[index].type;
  for (let j = index - 1; j >= 0; j--) {
    const v = sets[j].type === type ? sets[j][f] : null;
    if (v != null) return v;
  }
  return null;
}

/** Commit a set: fill any empty inputs from the suggestion and mark done. */
export function completeSet(set: LoggedSet, s: Suggestion): LoggedSet {
  return {
    ...set,
    weight: set.weight ?? s.weight,
    reps: set.reps ?? s.reps,
    seconds: set.seconds ?? s.seconds,
    done: true,
  };
}

export function emptySet(type: SetType = 'normal'): LoggedSet {
  return { id: uid(), type, weight: null, reps: null, rpe: null, done: false };
}

export function programDayAt(program: Program, week: number, day: number): ProgramDay | undefined {
  const w = program.mode === 'periodized' ? program.weeks[week] : program.weeks[0];
  return w?.days[day];
}

/** Loop programs have no end; `week` is then the cycle number. */
function weekLimit(program: Program): number {
  return program.mode === 'loop' ? Number.MAX_SAFE_INTEGER : program.numWeeks;
}

export function daysPerWeek(program: Program): number {
  return program.weeks[0]?.days.length ?? 0;
}

export function workoutExerciseFromProgram(pe: ProgramExercise): WorkoutExercise {
  return {
    id: uid(),
    exerciseId: pe.exerciseId,
    notes: '',
    instructions: pe.notes || undefined,
    programExerciseId: pe.id,
    superset: pe.superset,
    sets: pe.sets.map((t) => ({ id: uid(), type: t.type, weight: null, reps: null, rpe: null, done: false, target: t })),
  };
}

export function newWorkout(name: string, unit: Unit, exercises: WorkoutExercise[] = [], programRef?: ProgramRef): Workout {
  return { id: uid(), name, notes: '', startedAt: Date.now(), pausedMs: 0, exercises, unit, programRef };
}

/** Copy a past workout's exercises and set structure (not numbers) into a new session. */
export function repeatWorkout(w: Workout, unit: Unit): Workout {
  return newWorkout(
    w.name,
    unit,
    w.exercises.map((e) => ({
      id: uid(),
      exerciseId: e.exerciseId,
      notes: '',
      instructions: e.instructions,
      superset: e.superset,
      sets: e.sets.map((s) => ({ id: uid(), type: s.type, weight: null, reps: null, rpe: null, done: false, target: s.target })),
    })),
  );
}

/** Pre-fill every empty input with its suggestion (the "autofill values" setting). */
export function autofillWorkout(w: Workout, history: Workout[], oneRepMaxFor: (id: string) => number | undefined, rounding: number): Workout {
  return {
    ...w,
    exercises: w.exercises.map((e) => {
      const prev = findPrevious(history, e.exerciseId, { programRef: w.programRef, excludeWorkoutId: w.id })?.sets;
      const sets = [...e.sets];
      for (let i = 0; i < sets.length; i++) {
        // Each set from its own match last time (past that, the set above), not carried down;
        // a "% of 1RM" set's weight is the program's.
        const own = previousSetFor(sets, i, prev);
        const hint = hintFor({ sets, index: i, prev, oneRepMax: oneRepMaxFor(e.exerciseId), rounding });
        const pctWeight = sets[i].target?.intensity.kind === 'pct' ? hint.weight : null;
        sets[i] = {
          ...sets[i],
          weight: sets[i].weight ?? pctWeight ?? own?.weight ?? hint.weight,
          reps: sets[i].reps ?? own?.reps ?? hint.reps,
          seconds: sets[i].seconds ?? own?.seconds ?? hint.seconds,
        };
      }
      return { ...e, sets };
    }),
  };
}

/** Program slot after the given one, or undefined at the end of the program. */
export function nextSlot(program: Program, ref: { week: number; day: number }): { week: number; day: number } | undefined {
  const perWeek = daysPerWeek(program);
  if (ref.day + 1 < perWeek) return { week: ref.week, day: ref.day + 1 };
  if (ref.week + 1 < weekLimit(program)) return { week: ref.week + 1, day: 0 };
  return undefined;
}

/** First program slot that hasn't been completed (or skipped). */
/** Key of a program slot in ActiveProgram.completed (persisted: don't change the format). */
export const slotKey = (week: number, day: number) => `${week}-${day}`;

export function firstIncompleteSlot(program: Program, completed: Record<string, string>): { week: number; day: number } | undefined {
  const perWeek = daysPerWeek(program);
  if (perWeek === 0) return undefined;
  // Every completed key covers at most one slot, so the answer is within this bound even for loops.
  const limit = Math.min(weekLimit(program), Math.ceil(Object.keys(completed).length / perWeek) + 1);
  for (let w = 0; w < limit; w++) for (let d = 0; d < perWeek; d++) if (!completed[slotKey(w, d)]) return { week: w, day: d };
  return undefined;
}

// ---------- Personal records ----------

export type ExerciseRecords = {
  bestE1rm: number;
  maxWeight: number;
  maxVolumeSet: number;
  maxReps: number;
  /** reps → heaviest weight lifted for exactly that many reps. */
  repMaxes: Record<number, number>;
};

export function emptyRecords(): ExerciseRecords {
  return { bestE1rm: 0, maxWeight: 0, maxVolumeSet: 0, maxReps: 0, repMaxes: {} };
}

function addSet(r: ExerciseRecords, s: LoggedSet) {
  if (!s.done || s.type === 'warmup' || !s.reps) return;
  const w = s.weight ?? 0;
  r.bestE1rm = Math.max(r.bestE1rm, e1rm(w, s.reps));
  r.maxWeight = Math.max(r.maxWeight, w);
  r.maxVolumeSet = Math.max(r.maxVolumeSet, w * s.reps);
  r.maxReps = Math.max(r.maxReps, s.reps);
  if (w > 0) r.repMaxes[s.reps] = Math.max(r.repMaxes[s.reps] ?? 0, w);
}

/** Records for an exercise. Only scans workouts containing it; the unfiltered case is cached. Don't mutate. */
export function recordsFor(history: Workout[], exerciseId: string, opts: { before?: number; excludeWorkoutId?: string } = {}): ExerciseRecords {
  const idx = historyIndex(history);
  const unfiltered = opts.before == null && opts.excludeWorkoutId == null;
  if (unfiltered && idx.records.has(exerciseId)) return idx.records.get(exerciseId)!;
  const r = emptyRecords();
  for (const w of idx.byExercise.get(exerciseId) ?? []) {
    if (w.id === opts.excludeWorkoutId) continue;
    if (opts.before != null && w.startedAt >= opts.before) continue;
    for (const e of w.exercises) if (e.exerciseId === exerciseId) for (const s of e.sets) addSet(r, s);
  }
  if (unfiltered) idx.records.set(exerciseId, r);
  return r;
}

export type PRKind = 'e1rm' | 'weight' | 'volume' | 'reps';
export type PR = { exerciseId: string; kind: PRKind; value: number; setId: string };

export const PR_LABEL: Record<PRKind, string> = { e1rm: 'Est. 1RM', weight: 'Max Weight', volume: 'Max Volume', reps: 'Max Reps' };

/** PRs set in `workout` compared with everything logged before it. */
export function detectPRs(workout: Workout, history: Workout[]): PR[] {
  const prs: PR[] = [];
  const seen = new Set<string>();
  for (const e of workout.exercises) {
    if (seen.has(e.exerciseId)) continue;
    seen.add(e.exerciseId);
    const before = recordsFor(history, e.exerciseId, { before: workout.startedAt, excludeWorkoutId: workout.id });
    // Nothing logged before → first session establishes a baseline, not a PR.
    const hadHistory = before.maxReps > 0;
    if (!hadHistory) continue;
    const sets = workout.exercises.filter((x) => x.exerciseId === e.exerciseId).flatMap((x) => x.sets);
    const best = { e1rm: { v: 0, id: '' }, weight: { v: 0, id: '' }, volume: { v: 0, id: '' }, reps: { v: 0, id: '' } };
    for (const s of sets) {
      if (!s.done || s.type === 'warmup' || !s.reps) continue;
      const w = s.weight ?? 0;
      const vals = { e1rm: e1rm(w, s.reps), weight: w, volume: w * s.reps, reps: s.reps };
      for (const k of Object.keys(vals) as PRKind[]) if (vals[k] > best[k].v) best[k] = { v: vals[k], id: s.id };
    }
    const prior = { e1rm: before.bestE1rm, weight: before.maxWeight, volume: before.maxVolumeSet, reps: before.maxReps };
    for (const k of Object.keys(prior) as PRKind[]) {
      if (best[k].v > prior[k] + 1e-9) prs.push({ exerciseId: e.exerciseId, kind: k, value: best[k].v, setId: best[k].id });
    }
  }
  return prs;
}

/** One line per exercise: its PR kinds (most meaningful first) and the headline value. */
export function groupPRs(prs: PR[]): { exerciseId: string; kinds: PRKind[]; headline: PR }[] {
  const order: PRKind[] = ['weight', 'e1rm', 'volume', 'reps'];
  const by = new Map<string, PR[]>();
  for (const p of prs) by.set(p.exerciseId, [...(by.get(p.exerciseId) ?? []), p]);
  return [...by.entries()].map(([exerciseId, list]) => {
    const sorted = [...list].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
    return { exerciseId, kinds: sorted.map((p) => p.kind), headline: sorted[0] };
  });
}

/** Display a PR value. Logged weights are shown exactly; only estimates are rounded. */
export function fmtPR(pr: Pick<PR, 'kind' | 'value'>, unit: Unit): string {
  if (pr.kind === 'reps') return `${pr.value} reps`;
  const v = pr.kind === 'weight' ? pr.value : Math.round(pr.value);
  return `${fmtNum(v)} ${unit}`;
}

/** A template that repeats a logged workout: each set keeps its program target, else "N reps" from what was done. */
export function templateFromWorkout(w: Workout, name: string, now: number): Template {
  return {
    id: uid(),
    name,
    createdAt: now,
    exercises: w.exercises.map((e) => ({
      id: uid(),
      exerciseId: e.exerciseId,
      notes: e.instructions ?? '',
      superset: e.superset,
      sets: e.sets.map((s) => s.target ?? { id: uid(), type: s.type, target: { kind: 'reps', reps: s.reps ?? 8 }, intensity: { kind: 'none' } }),
    })),
  };
}
