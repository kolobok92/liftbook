import { e1rm, setVolume, startOfWeek, workoutDurationMs, workoutVolume } from './calc';
import type { Exercise, Muscle, Program, Workout } from './types';

const WEEK_MS = 7 * 24 * 3600 * 1000;

export type Summary = { workouts: number; durationMs: number; volume: number; sets: number };

export function summarize(workouts: Workout[]): Summary {
  let durationMs = 0;
  let volume = 0;
  let sets = 0;
  for (const w of workouts) {
    durationMs += workoutDurationMs(w);
    volume += workoutVolume(w);
    for (const e of w.exercises) for (const s of e.sets) if (s.done && s.type !== 'warmup') sets++;
  }
  return { workouts: workouts.length, durationMs, volume, sets };
}

export function inRange(history: Workout[], from: number, to: number): Workout[] {
  return history.filter((w) => w.endedAt && w.startedAt >= from && w.startedAt < to);
}

/** Consecutive weeks (ending this week or last week) with at least one workout. */
export function weekStreak(history: Workout[], now = Date.now()): number {
  const weeks = new Set(history.filter((w) => w.endedAt).map((w) => startOfWeek(w.startedAt)));
  let cursor = startOfWeek(now);
  if (!weeks.has(cursor)) cursor -= WEEK_MS;
  let n = 0;
  while (weeks.has(cursor)) {
    n++;
    cursor = startOfWeek(cursor - WEEK_MS / 2);
  }
  return n;
}

/**
 * Sets per muscle: a set counts 1 for each primary muscle and 0.5 for each secondary,
 * the usual convention for weekly volume landmarks.
 */
export function muscleSets(workouts: Workout[], byId: Record<string, Exercise>): Record<Muscle, number> {
  const out = {} as Record<Muscle, number>;
  for (const w of workouts)
    for (const e of w.exercises) {
      const ex = byId[e.exerciseId];
      if (!ex) continue;
      const n = e.sets.filter((s) => s.done && s.type !== 'warmup').length;
      if (!n) continue;
      for (const m of ex.primary) out[m] = (out[m] ?? 0) + n;
      for (const m of ex.secondary) out[m] = (out[m] ?? 0) + n * 0.5;
    }
  return out;
}

/** Share of planned sets hitting each muscle in a program week, like a program overview's "muscle engagement". */
export function programMuscleShare(program: Program, byId: Record<string, Exercise>): { muscle: Muscle; pct: number }[] {
  const counts = {} as Record<Muscle, number>;
  const week = program.weeks[0];
  if (!week) return [];
  for (const d of week.days)
    for (const pe of d.exercises) {
      const ex = byId[pe.exerciseId];
      if (!ex) continue;
      const n = pe.sets.filter((s) => s.type !== 'warmup').length;
      for (const m of ex.primary) counts[m] = (counts[m] ?? 0) + n;
      for (const m of ex.secondary) counts[m] = (counts[m] ?? 0) + n * 0.5;
    }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (!total) return [];
  return (Object.entries(counts) as [Muscle, number][])
    .map(([muscle, c]) => ({ muscle, pct: (c / total) * 100 }))
    .sort((a, b) => b.pct - a.pct);
}

export type Point = { t: number; v: number };

export type Bucket = 'daily' | 'weekly' | 'monthly';

function bucketStart(t: number, b: Bucket): number {
  const d = new Date(t);
  if (b === 'daily') {
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (b === 'weekly') return startOfWeek(t);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

function stepBucket(t: number, b: Bucket, dir: -1 | 1): number {
  const d = new Date(t);
  if (b === 'daily') d.setDate(d.getDate() + dir);
  else if (b === 'weekly') d.setDate(d.getDate() + 7 * dir);
  else d.setMonth(d.getMonth() + dir);
  return bucketStart(d.getTime(), b);
}

/** Total volume per bucket for the last `count` buckets (oldest first, zeros included). */
export function volumeSeries(history: Workout[], bucket: Bucket, count: number, now = Date.now()): Point[] {
  const sums = new Map<number, number>();
  for (const w of history) {
    if (!w.endedAt) continue;
    const k = bucketStart(w.startedAt, bucket);
    sums.set(k, (sums.get(k) ?? 0) + workoutVolume(w));
  }
  const out: Point[] = [];
  let k = bucketStart(now, bucket);
  for (let i = 0; i < count; i++) {
    out.unshift({ t: k, v: sums.get(k) ?? 0 });
    k = stepBucket(k, bucket, -1);
  }
  return out;
}

export type ExerciseSession = {
  workoutId: string;
  t: number;
  bestE1rm: number;
  maxWeight: number;
  volume: number;
  bestSet?: { weight: number; reps: number };
};

/** One row per workout containing the exercise, oldest first. */
export function exerciseSessions(history: Workout[], exerciseId: string): ExerciseSession[] {
  const out: ExerciseSession[] = [];
  for (const w of history) {
    if (!w.endedAt) continue;
    const sets = w.exercises.filter((e) => e.exerciseId === exerciseId).flatMap((e) => e.sets);
    const done = sets.filter((s) => s.done && s.type !== 'warmup' && s.reps);
    if (!done.length) continue;
    let bestE1rm = 0;
    let maxWeight = 0;
    let volume = 0;
    let bestSet: ExerciseSession['bestSet'];
    for (const s of done) {
      const est = e1rm(s.weight ?? 0, s.reps ?? 0);
      if (est > bestE1rm || !bestSet) {
        bestE1rm = Math.max(bestE1rm, est);
        bestSet = { weight: s.weight ?? 0, reps: s.reps ?? 0 };
      }
      maxWeight = Math.max(maxWeight, s.weight ?? 0);
      volume += setVolume(s);
    }
    out.push({ workoutId: w.id, t: w.startedAt, bestE1rm, maxWeight, volume, bestSet });
  }
  return out.sort((a, b) => a.t - b.t);
}
