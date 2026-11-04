import { BUILTIN_EXERCISES } from './exercises';
import type { Exercise } from './types';

/** A name's identity: case, punctuation, word order and plurals ignored ("Rear Delt Skiers" = "Rear Delt Skier"). */
function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[()\-–,'’]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .sort()
    .join(' ');
}

const BUILTIN_BY_KEY = new Map(BUILTIN_EXERCISES.map((e) => [nameKey(e.name), e.id]));

function remap(v: unknown, ids: Record<string, string>): unknown {
  if (Array.isArray(v)) return v.map((x) => remap(x, ids));
  if (!v || typeof v !== 'object') return v;
  return Object.fromEntries(
    Object.entries(v).map(([k, x]) => [k, k === 'exerciseId' && typeof x === 'string' && ids[x] ? ids[x] : remap(x, ids)]),
  );
}

/**
 * Custom exercises that are now built in (same name, see nameKey) fold into the built-in one:
 * history, the running workout, programs, templates and 1RMs move to its id and the custom
 * copy goes, so nothing loses its past. Runs on every load and restore; a no-op once done.
 */
export function adoptBuiltinExercises<S extends { customExercises?: unknown[]; oneRepMaxes?: Record<string, number> }>(state: S): S {
  const ids: Record<string, string> = {};
  for (const e of (state.customExercises ?? []) as Exercise[]) {
    const builtin = e?.name ? BUILTIN_BY_KEY.get(nameKey(e.name)) : undefined;
    if (builtin && builtin !== e.id) ids[e.id] = builtin;
  }
  if (!Object.keys(ids).length) return state;
  const { customExercises, oneRepMaxes, ...rest } = state;
  const max: Record<string, number> = {};
  // A 1RM set on the custom copy wins only when the built-in has none.
  for (const [k, v] of Object.entries(oneRepMaxes ?? {})) if (!ids[k]) max[k] = v;
  for (const [k, v] of Object.entries(oneRepMaxes ?? {})) if (ids[k] && max[ids[k]] == null) max[ids[k]] = v;
  return {
    ...(remap(rest, ids) as object),
    customExercises: (customExercises as Exercise[]).filter((e) => !ids[e.id]),
    ...(oneRepMaxes ? { oneRepMaxes: max } : {}),
  } as S;
}
