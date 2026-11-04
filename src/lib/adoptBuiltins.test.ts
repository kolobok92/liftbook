import { describe, expect, it } from 'vitest';
import { adoptBuiltinExercises } from './adoptBuiltins';
import { makeBackup, parseBackup } from './persistence';

const custom = (name: string) => ({ id: `custom-${name.toLowerCase().replace(/\W+/g, '-')}`, name, equipment: 'other', primary: [], secondary: [] });

describe('custom exercises that became built in', () => {
  it('move every reference to the built-in id and drop the custom copy', () => {
    const skiers = custom('Rear Delt Skiers'); // plural, as typed on the phone
    const own = custom('Banded Neck Thing'); // still custom
    const out = adoptBuiltinExercises({
      customExercises: [skiers, own],
      history: [{ id: 'w1', exercises: [{ id: 'r1', exerciseId: skiers.id, sets: [{ weight: 20, reps: 12 }] }, { id: 'r2', exerciseId: own.id, sets: [] }] }],
      active: { exercises: [{ exerciseId: skiers.id }] },
      programs: [{ days: [{ exercises: [{ exerciseId: skiers.id }] }] }],
      templates: [{ exercises: [{ exerciseId: skiers.id }] }],
      oneRepMaxes: { [skiers.id]: 50 },
    });
    expect(out.customExercises).toEqual([own]);
    expect(out.history[0].exercises.map((e) => e.exerciseId)).toEqual(['rear-delt-skier', own.id]);
    expect(out.history[0].exercises[0].sets).toEqual([{ weight: 20, reps: 12 }]);
    expect(out.active.exercises[0].exerciseId).toBe('rear-delt-skier');
    expect(out.programs[0].days[0].exercises[0].exerciseId).toBe('rear-delt-skier');
    expect(out.templates[0].exercises[0].exerciseId).toBe('rear-delt-skier');
    expect(out.oneRepMaxes).toEqual({ 'rear-delt-skier': 50 });
  });

  it("Boostcamp-imported names link to Boostcamp's built-in names; a built-in 1RM wins", () => {
    const jm = custom('JM Press (Smith Machine)');
    const out = adoptBuiltinExercises({ customExercises: [jm], history: [], oneRepMaxes: { [jm.id]: 100, 'jm-press-smith-machine': 120 } });
    expect(out.customExercises).toEqual([]);
    expect(out.oneRepMaxes).toEqual({ 'jm-press-smith-machine': 120 });
  });

  it('leaves state untouched when nothing matches (same object, safe on every load)', () => {
    const s = { customExercises: [custom('Banded Neck Thing')], history: [] };
    expect(adoptBuiltinExercises(s)).toBe(s);
  });

  it('applies to restored backups too', () => {
    const skiers = custom('Rear Delt Skier');
    const text = makeBackup({ programs: [], history: [{ exercises: [{ exerciseId: skiers.id }] }], customExercises: [skiers], templates: [], oneRepMaxes: {}, settings: {} });
    const parsed = parseBackup(text);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.data.customExercises).toEqual([]);
    expect(JSON.stringify(parsed.data.history)).toContain('"exerciseId":"rear-delt-skier"');
  });
});
