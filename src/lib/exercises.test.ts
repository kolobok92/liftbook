import { describe, expect, it } from 'vitest';
import { BUILTIN_BY_ID, BUILTIN_EXERCISES, CURATED_EXERCISES, FREE_EXERCISES, exerciseDetails, matchExerciseByName } from './exercises';
import { pplua } from './seed';

describe('exercise library', () => {
  it('ids and names are unique across curated + imported exercises', () => {
    const ids = BUILTIN_EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const names = BUILTIN_EXERCISES.map((e) => e.name.toLowerCase());
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
  });

  it('every exercise has at least one primary muscle (the muscle map depends on it)', () => {
    expect(BUILTIN_EXERCISES.filter((e) => e.primary.length === 0).map((e) => e.name)).toEqual([]);
  });

  it('every PPLUA exercise resolves to a curated entry', () => {
    const ids = pplua().weeks[0].days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
    expect(ids.filter((id) => !BUILTIN_BY_ID[id])).toEqual([]);
    expect(ids.every((id) => CURATED_EXERCISES.some((c) => c.id === id))).toBe(true);
  });

  it('CSV import still matches common export names to curated entries, not imported duplicates', () => {
    for (const name of ['Bench Press (Barbell)', 'Barbell Bench Press', 'Squat (Barbell)', 'Lat Pulldown (Cable)']) {
      expect(matchExerciseByName(name, BUILTIN_EXERCISES)?.id.startsWith('fedb-'), name).toBe(false);
    }
  });

  it('imported exercises have lazily loaded details with images', () => {
    const withImages = FREE_EXERCISES.filter((e) => (exerciseDetails(e.id)?.images.length ?? 0) > 0);
    expect(withImages.length / FREE_EXERCISES.length).toBeGreaterThan(0.95);
    // Curated exercises get the photos of their free-exercise-db counterpart (exact or aliased).
    expect(exerciseDetails('bench-press-barbell')?.images[0]).toBe('Barbell_Bench_Press_-_Medium_Grip/0.jpg');
    expect(exerciseDetails('chest-fly-machine')?.images[0]).toBe('Butterfly/0.jpg');
    expect(exerciseDetails('bayesian-curl')).toBeUndefined(); // no faithful photo exists
  });
});
