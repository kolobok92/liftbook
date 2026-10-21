import { fmtTargetLong } from './calc';
import type { Exercise, Workout } from './types';

/** What the lock screen / Dynamic Island shows for a running workout. */
export type WorkoutActivity = {
  title: string;
  subtitle: string;
  /** Running: the effective start (pauses excluded), shown as a count-up clock. */
  startedAt?: number;
  /** Paused: share of sets done, shown as a bar (the clock can't be frozen). */
  progress?: number;
  /** The current exercise's bundled thumbnail (asset name = exercise id), when it has one. */
  image?: string;
};

export function workoutActivity(w: Workout, byId: Record<string, Exercise>, hasThumb: (exerciseId: string) => boolean = () => false): WorkoutActivity {
  let done = 0;
  let total = 0;
  let next: { id: string; name: string; set: number; of: number; target?: string } | undefined;
  for (const e of w.exercises) {
    e.sets.forEach((s, i) => {
      total++;
      if (s.done) done++;
      else if (!next) next = { id: e.exerciseId, name: byId[e.exerciseId]?.name ?? 'Exercise', set: i + 1, of: e.sets.length, target: s.target && fmtTargetLong(s.target.target) };
    });
  }
  const sets = `${done}/${total} sets`;
  // Boostcamp's card: the exercise you're on, then "Set 1 of 4 (5–8 reps)".
  const title = next?.name ?? w.name;
  const image = next && hasThumb(next.id) ? { image: next.id } : {};
  if (w.pausedAt) return { title, subtitle: `${sets} done`, progress: total ? done / total : 0, ...image };
  return {
    title,
    subtitle: next ? `Set ${next.set} of ${next.of}${next.target ? ` (${next.target})` : ''}` : `All sets done · ${sets}`,
    startedAt: w.startedAt + (w.pausedMs ?? 0),
    ...image,
  };
}
