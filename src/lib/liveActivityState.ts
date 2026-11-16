import { fmtTargetLong } from './calc';
import { currentRow } from './tracking';
import type { Exercise, Workout } from './types';

/** What the lock screen / Dynamic Island shows for a running workout. */
export type WorkoutActivity = {
  title: string;
  subtitle: string;
  /** Running: the effective start (pauses excluded), shown as a count-up clock. */
  startedAt?: number;
  /** Resting: when the rest ends, shown as a countdown instead of the workout clock. The
   * subtitle then starts with "Rest", which is how the lock-screen view knows (LiveActivityView.swift). */
  restEndsAt?: number;
  /** Paused: share of sets done, shown as a bar (the clock can't be frozen). */
  progress?: number;
  /** The current exercise's bundled thumbnail (asset name = exercise id), when it has one. */
  image?: string;
};

export function workoutActivity(w: Workout, byId: Record<string, Exercise>, hasThumb: (exerciseId: string) => boolean = () => false): WorkoutActivity {
  const all = w.exercises.flatMap((e) => e.sets);
  const done = all.filter((s) => s.done).length;
  const total = all.length;
  // The exercise you're on (out of order too), at its first unchecked set.
  const row = currentRow(w);
  const i = row ? row.sets.findIndex((s) => !s.done) : -1;
  const s = row && i >= 0 ? row.sets[i] : undefined;
  const next = row && s ? { id: row.exerciseId, name: byId[row.exerciseId]?.name ?? 'Exercise', set: i + 1, of: row.sets.length, target: s.target && fmtTargetLong(s.target.target) } : undefined;
  const sets = `${done}/${total} sets`;
  // Boostcamp's card: the exercise you're on, then "Set 1 of 4 (5–8 reps)".
  const title = next?.name ?? w.name;
  const image = next && hasThumb(next.id) ? { image: next.id } : {};
  if (w.pausedAt) return { title, subtitle: `${sets} done`, progress: total ? done / total : 0, ...image };
  const upNext = next ? `Set ${next.set} of ${next.of}` : '';
  if (w.rest && next) return { title, subtitle: `Rest · then ${upNext}`, restEndsAt: w.rest.endsAt, ...image };
  return {
    title,
    subtitle: next ? `Set ${next.set} of ${next.of}${next.target ? ` (${next.target})` : ''}` : `All sets done · ${sets}`,
    startedAt: w.startedAt + (w.pausedMs ?? 0),
    ...image,
  };
}
