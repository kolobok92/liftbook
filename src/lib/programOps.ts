import { uid } from './calc';
import type { Program, ProgramDay, ProgramExercise, ProgramWeek } from './types';

export const MAX_WEEKS = 26;
export const MAX_DAYS = 7;

export function cloneExercise(e: ProgramExercise): ProgramExercise {
  return { ...e, id: uid(), sets: e.sets.map((s) => ({ ...s, id: uid() })) };
}

/** Deep copy with fresh ids; superset groups are re-keyed so copies don't link to originals. */
export function cloneDay(d: ProgramDay): ProgramDay {
  const groups = new Map<string, string>();
  return {
    ...d,
    id: uid(),
    exercises: d.exercises.map((e) => {
      const c = cloneExercise(e);
      if (e.superset) {
        if (!groups.has(e.superset)) groups.set(e.superset, uid());
        c.superset = groups.get(e.superset);
      }
      return c;
    }),
  };
}

export function cloneWeek(w: ProgramWeek): ProgramWeek {
  return { ...w, id: uid(), days: w.days.map(cloneDay) };
}

export function cloneProgram(p: Program, name = `${p.name} (Copy)`): Program {
  const now = Date.now();
  return { ...p, id: uid(), name, weeks: p.weeks.map(cloneWeek), createdAt: now, updatedAt: now };
}

/** Change program type, keeping the written workouts. */
export function setMode(p: Program, mode: Program['mode']): Program {
  if (mode === p.mode) return p;
  if (mode === 'periodized') {
    const weeks = Array.from({ length: p.numWeeks }, (_, i) => (i === 0 ? p.weeks[0] : (p.weeks[i] ?? cloneWeek(p.weeks[0]))));
    return { ...p, mode, weeks };
  }
  return { ...p, mode, weeks: [p.weeks[0]] };
}

export function setNumWeeks(p: Program, n: number): Program {
  const numWeeks = Math.max(1, Math.min(MAX_WEEKS, n));
  if (p.mode !== 'periodized') return { ...p, numWeeks };
  const weeks = [...p.weeks.slice(0, numWeeks)];
  while (weeks.length < numWeeks) weeks.push(cloneWeek(weeks[weeks.length - 1]));
  return { ...p, numWeeks, weeks };
}

export function updateWeek(p: Program, wi: number, fn: (w: ProgramWeek) => ProgramWeek): Program {
  return { ...p, weeks: p.weeks.map((w, i) => (i === wi ? fn(w) : w)) };
}

export function updateDay(p: Program, wi: number, di: number, fn: (d: ProgramDay) => ProgramDay): Program {
  return updateWeek(p, wi, (w) => ({ ...w, days: w.days.map((d, i) => (i === di ? fn(d) : d)) }));
}

/** Days must line up across weeks for periodized programs, so day add/remove/move apply to every week. */
export function forAllWeeks(p: Program, fn: (w: ProgramWeek) => ProgramWeek): Program {
  return { ...p, weeks: p.weeks.map(fn) };
}

export function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const a = [...arr];
  const [x] = a.splice(from, 1);
  a.splice(to, 0, x);
  return a;
}

export function validateProgram(p: Program): string | undefined {
  if (!p.name.trim()) return 'Give the program a name.';
  const days = p.weeks[0]?.days ?? [];
  if (days.length === 0) return 'Add at least one day.';
  for (const [wi, w] of p.weeks.entries())
    for (const d of w.days) {
      for (const e of d.exercises) if (e.sets.length === 0) return `${d.name}${p.mode === 'periodized' ? ` (week ${wi + 1})` : ''} has an exercise with no sets.`;
    }
  return undefined;
}
