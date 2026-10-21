import { newSetTarget, uid } from './calc';
import { programDayAt } from './tracking';
import type { Program, ProgramDay, ProgramExercise, SetTarget, Workout } from './types';

/**
 * Applying in-workout edits (swap, add/remove sets or exercises, reorder, supersets, set
 * types) back to the program, chosen per exercise. Only structure is compared — sets that
 * were simply not checked off still exist in the workout, so skipping a set isn't "removing" it.
 */

export type ApplyScope = 'template' | 'week' | 'fromWeek';

/** One selectable change: everything that changed about one exercise, or a day-level change. */
export type ChangeItem = {
  key: string;
  kind: 'exercise' | 'order' | 'superset';
  /** Program exercise id (original or newly added) for exercise items. */
  peId?: string;
  title: string;
  details: string[];
};

/**
 * The program day as this workout would have it. Kept sets keep their prescribed targets;
 * added sets copy the previous set's target; added exercises get default targets.
 */
export function dayFromWorkout(workout: Workout, day: ProgramDay): ProgramDay {
  const byId = new Map(day.exercises.map((pe) => [pe.id, pe]));
  const exercises: ProgramExercise[] = workout.exercises.map((we) => {
    const base = we.programExerciseId ? byId.get(we.programExerciseId) : undefined;
    let last: SetTarget | undefined = base?.sets[base.sets.length - 1];
    const sets = we.sets.map((s) => {
      const t: SetTarget = s.target ? { ...s.target, type: s.type } : { ...(last ?? newSetTarget()), id: uid(), type: s.type };
      last = t;
      return t;
    });
    return { id: base?.id ?? `new-${we.id}`, exerciseId: we.exerciseId, notes: base?.notes ?? we.instructions ?? '', superset: we.superset, sets };
  });
  return { ...day, exercises };
}

/** Superset grouping as a comparable shape: group ids renamed by first appearance. */
function supersetShape(ids: (string | undefined)[]): string {
  const names = new Map<string, number>();
  return ids
    .map((id) => {
      if (!id) return '-';
      if (!names.has(id)) names.set(id, names.size);
      return `g${names.get(id)}`;
    })
    .join(',');
}

export function changeItems(original: ProgramDay, updated: ProgramDay, nameOf: (exerciseId: string) => string): ChangeItem[] {
  const items: ChangeItem[] = [];
  const orig = new Map(original.exercises.map((pe) => [pe.id, pe]));
  const upd = new Map(updated.exercises.map((pe) => [pe.id, pe]));

  for (const pe of original.exercises) {
    const u = upd.get(pe.id);
    if (!u) {
      items.push({ key: `ex:${pe.id}`, kind: 'exercise', peId: pe.id, title: nameOf(pe.exerciseId), details: ['Removed'] });
      continue;
    }
    const details: string[] = [];
    if (u.exerciseId !== pe.exerciseId) details.push(`Swapped for ${nameOf(u.exerciseId)}`);
    if (u.sets.length !== pe.sets.length) details.push(`${pe.sets.length} → ${u.sets.length} sets`);
    else if (u.sets.some((s, i) => s.type !== pe.sets[i].type)) details.push('Set types changed');
    if (details.length) items.push({ key: `ex:${pe.id}`, kind: 'exercise', peId: pe.id, title: nameOf(pe.exerciseId), details });
  }
  for (const u of updated.exercises) {
    if (!orig.has(u.id)) items.push({ key: `ex:${u.id}`, kind: 'exercise', peId: u.id, title: nameOf(u.exerciseId), details: [`Added (${u.sets.length} sets)`] });
  }

  const shared = updated.exercises.filter((u) => orig.has(u.id)).map((u) => u.id);
  const sharedInOriginal = original.exercises.filter((pe) => upd.has(pe.id)).map((pe) => pe.id);
  if (shared.join() !== sharedInOriginal.join()) items.push({ key: 'order', kind: 'order', title: 'Exercise order', details: ['Reordered'] });

  const origSs = supersetShape(sharedInOriginal.map((id) => orig.get(id)!.superset));
  const updSs = supersetShape(sharedInOriginal.map((id) => upd.get(id)!.superset));
  const addedInSuperset = updated.exercises.some((u) => !orig.has(u.id) && u.superset && updated.exercises.filter((x) => x.superset === u.superset).length > 1);
  if (origSs !== updSs || addedInSuperset) items.push({ key: 'superset', kind: 'superset', title: 'Supersets', details: ['Changed'] });
  return items;
}

/**
 * The original day with only the accepted changes taken from `updated`. Unaccepted exercise
 * changes keep the original exercise; without "order", kept exercises stay in their original
 * positions and accepted additions go at the end; without "superset", groupings stay as they were.
 */
export function mergeAccepted(original: ProgramDay, updated: ProgramDay, accepted: Set<string>): ProgramDay {
  const orig = new Map(original.exercises.map((pe) => [pe.id, pe]));
  const upd = new Map(updated.exercises.map((pe) => [pe.id, pe]));
  const takeUpdated = (id: string) => accepted.has(`ex:${id}`);
  const keepSuperset = !accepted.has('superset');

  const pick = (id: string): ProgramExercise | undefined => {
    const o = orig.get(id);
    const u = upd.get(id);
    if (o && !u) return takeUpdated(id) ? undefined : o; // removed
    if (!o && u) return takeUpdated(id) ? { ...u, id: uid(), superset: keepSuperset ? undefined : u.superset } : undefined; // added
    if (!o || !u) return undefined;
    const base = takeUpdated(id) ? { ...u } : { ...o };
    base.superset = keepSuperset ? o.superset : u.superset;
    return base;
  };

  let order: string[];
  if (accepted.has('order')) {
    // Updated order, with rejected removals put back where they were relative to their neighbours.
    order = updated.exercises.map((u) => u.id);
    original.exercises.forEach((pe, i) => {
      if (upd.has(pe.id)) return;
      const prevKept = original.exercises.slice(0, i).reverse().find((x) => order.includes(x.id));
      order.splice(prevKept ? order.indexOf(prevKept.id) + 1 : 0, 0, pe.id);
    });
  } else {
    order = [...original.exercises.map((pe) => pe.id), ...updated.exercises.filter((u) => !orig.has(u.id)).map((u) => u.id)];
  }
  const exercises = order.map(pick).filter((x): x is ProgramExercise => !!x);
  return { ...original, exercises };
}

/**
 * Apply the same edit to another week's version of this day, keeping that week's own targets
 * (so a periodized progression survives). Exercises line up by position, which holds because
 * days are cloned week to week.
 */
function applyToOtherWeek(target: ProgramDay, original: ProgramDay, merged: ProgramDay): ProgramDay {
  const indexOf = new Map(original.exercises.map((pe, i) => [pe.id, i]));
  const groupIds = new Map<string, string>();
  const exercises = merged.exercises.map((pe) => {
    const k = indexOf.get(pe.id);
    const base = k != null ? target.exercises[k] : undefined;
    let superset: string | undefined;
    if (pe.superset) {
      if (!groupIds.has(pe.superset)) groupIds.set(pe.superset, uid());
      superset = groupIds.get(pe.superset);
    }
    if (!base) return { ...pe, id: uid(), superset, sets: pe.sets.map((s) => ({ ...s, id: uid() })) };
    const sets = pe.sets.map((s, j) => {
      const t = base.sets[j] ?? base.sets[base.sets.length - 1] ?? s;
      return { ...t, id: j < base.sets.length ? t.id : uid(), type: s.type };
    });
    return { ...base, exerciseId: pe.exerciseId, superset, sets };
  });
  return { ...target, exercises };
}

/** Program with the accepted edits from `workout` applied to the chosen scope. */
export function applyWorkoutToProgram(program: Program, workout: Workout, scope: ApplyScope, accepted: Set<string>): Program {
  const ref = workout.programRef;
  if (!ref) return program;
  const original = programDayAt(program, ref.week, ref.day);
  if (!original) return program;
  const merged = mergeAccepted(original, dayFromWorkout(workout, original), accepted);
  const replaceDay = (days: ProgramDay[], next: ProgramDay) => days.map((d, i) => (i === ref.day ? next : d));
  if (program.mode !== 'periodized' || scope === 'template') {
    return { ...program, weeks: program.weeks.map((w, i) => (i === 0 ? { ...w, days: replaceDay(w.days, merged) } : w)) };
  }
  return {
    ...program,
    weeks: program.weeks.map((w, i) => {
      if (i === ref.week) return { ...w, days: replaceDay(w.days, merged) };
      if (scope === 'fromWeek' && i > ref.week && w.days[ref.day]) return { ...w, days: replaceDay(w.days, applyToOtherWeek(w.days[ref.day], original, merged)) };
      return w;
    }),
  };
}

export type PendingProgramChange = { programId: string; workout: Workout; items: ChangeItem[]; periodized: boolean; week: number };

/** What, if anything, to offer applying back after finishing `workout` (pass the pre-cleanup workout). */
export function pendingChangeFor(program: Program | undefined, workout: Workout, nameOf: (id: string) => string): PendingProgramChange | undefined {
  const ref = workout.programRef;
  if (!program || !ref || program.id !== ref.programId) return undefined;
  const original = programDayAt(program, ref.week, ref.day);
  if (!original) return undefined;
  const items = changeItems(original, dayFromWorkout(workout, original), nameOf);
  if (!items.length) return undefined;
  return { programId: program.id, workout, items, periodized: program.mode === 'periodized', week: ref.week };
}
