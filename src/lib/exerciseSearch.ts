import type { Equipment, Exercise, Muscle } from './types';

export type Filters = { q: string; muscle?: Muscle; equipment?: Equipment };

const wordsOf = (s: string): string[] => s.toLowerCase().match(/[a-z0-9]+/g) ?? [];

/**
 * Filters by muscle/equipment and query words (every word must appear in the name). With a
 * query, best matches come first, so typing a main lift ("squat barbell") puts that lift on top
 * rather than whatever sorts first alphabetically ("Front Barbell Squat To A Bench"):
 * whole-word matches, then names starting with the first word, then curated over imported,
 * then the fewest extra words. Without a query: alphabetical.
 */
export function filterExercises(list: Exercise[], f: Filters): Exercise[] {
  const q = f.q.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = list.filter((e) => {
    if (f.muscle && !e.primary.includes(f.muscle) && !e.secondary.includes(f.muscle)) return false;
    if (f.equipment && e.equipment !== f.equipment) return false;
    const name = e.name.toLowerCase();
    return q.every((w) => name.includes(w));
  });
  if (!q.length) return matches.sort((a, b) => a.name.localeCompare(b.name));

  const rank = (e: Exercise) => {
    const words = wordsOf(e.name);
    const whole = q.filter((w) => words.includes(w)).length;
    return {
      whole,
      starts: words[0]?.startsWith(q[0]) ? 1 : 0,
      curated: e.id.startsWith('fedb-') ? 0 : 1,
      extra: words.length - whole,
    };
  };
  const ranked = matches.map((e) => ({ e, r: rank(e) }));
  ranked.sort(
    (a, b) =>
      b.r.whole - a.r.whole || b.r.starts - a.r.starts || b.r.curated - a.r.curated || a.r.extra - b.r.extra || a.e.name.localeCompare(b.e.name),
  );
  return ranked.map((x) => x.e);
}
