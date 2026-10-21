// Pure state transforms behind the store's actions (store.ts keeps only the wiring), so they can be
// unit-tested without zustand or storage.
import { convertWeight } from './calc';
import { recordsFor, slotKey } from './tracking';
import type { ActiveProgram, Exercise, Unit, Workout } from './types';

/** Drop unchecked sets, then exercises left with none: what a finished or edited workout keeps. */
export function keepCompletedSets(w: Workout): Workout {
  return { ...w, exercises: w.exercises.map((e) => ({ ...e, sets: e.sets.filter((s) => s.done) })).filter((e) => e.sets.length > 0) };
}

/** Close the workout at `now`: completed sets only, an open pause counted into pausedMs. */
export function finishWorkout(w: Workout, now: number): Workout {
  const pausedMs = w.pausedMs + (w.pausedAt ? now - w.pausedAt : 0);
  return { ...keepCompletedSets(w), endedAt: now, pausedMs, pausedAt: undefined };
}

/** Mark the finished workout's program slot as done (only for the program that's running). */
export function markSlotDone(active: ActiveProgram | undefined, finished: Workout): ActiveProgram | undefined {
  const ref = finished.programRef;
  if (!ref || !active || active.programId !== ref.programId) return active;
  return { ...active, completed: { ...active.completed, [slotKey(ref.week, ref.day)]: finished.id } };
}

/** Un-mark any slot that pointed at a deleted workout. */
export function unmarkWorkout(active: ActiveProgram | undefined, workoutId: string): ActiveProgram | undefined {
  if (!active) return active;
  return { ...active, completed: Object.fromEntries(Object.entries(active.completed).filter(([, v]) => v !== workoutId)) };
}

const roundTenth = (n: number) => Math.round(n * 10) / 10;

/** A weight in `from` units as `to`, rounded to 0.1 (100 lb → 45.4 kg). */
export function convertStoredWeight(n: number | null, from: Unit, to: Unit): number | null {
  return n == null ? n : roundTenth(convertWeight(n, from, to));
}

/** The workout with every set weight in `to` units (unchanged if it already is). */
export function convertWorkoutUnit(w: Workout, from: Unit, to: Unit): Workout {
  if (w.unit === to) return w;
  return { ...w, unit: to, exercises: w.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, weight: convertStoredWeight(s.weight, from, to) })) })) };
}

/** Imported workouts not already in history (same start time + name), and the custom exercises they need. */
export function dedupeImported(
  history: Workout[],
  imported: Workout[],
  customExercises: Exercise[],
  newExercises: Exercise[],
): { fresh: Workout[]; addCustom: Exercise[] } {
  const seen = new Set(history.map((w) => `${w.startedAt}|${w.name}`));
  const fresh = imported.filter((w) => !seen.has(`${w.startedAt}|${w.name}`));
  const known = new Set(customExercises.map((e) => e.id));
  const used = new Set(fresh.flatMap((w) => w.exercises.map((e) => e.exerciseId)));
  return { fresh, addCustom: newExercises.filter((e) => !known.has(e.id) && used.has(e.id)) };
}

/** Training max for %-based sets: the entered 1RM, else the best estimated 1RM from history. */
export function trainingMax(oneRepMaxes: Record<string, number>, history: Workout[], exerciseId: string): number | undefined {
  return oneRepMaxes[exerciseId] || recordsFor(history, exerciseId).bestE1rm || undefined;
}

/**
 * Put `otherId` in a superset with `rowId` (joining rowId's superset if it has one, leaving
 * its own), and move it to sit right after that group so the pair is done back to back.
 */
export function supersetWith<T extends { id: string; superset?: string }>(rows: T[], rowId: string, otherId: string, newGroup: string): T[] {
  const me = rows.find((r) => r.id === rowId);
  const other = rows.find((r) => r.id === otherId);
  if (!me || !other || me === other) return rows;
  const group = me.superset && rows.some((r) => r !== me && r.superset === me.superset) ? me.superset : newGroup;
  const rest = rows.filter((r) => r !== other).map((r) => (r === me ? { ...r, superset: group } : r));
  const lastOfGroup = rest.reduce((at, r, i) => (r.superset === group ? i : at), -1);
  rest.splice(lastOfGroup + 1, 0, { ...other, superset: group });
  return rest;
}
