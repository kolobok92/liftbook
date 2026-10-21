import { newSetTarget, uid } from './calc';
import { slugify } from './exercises';
import type { Program, ProgramDay, ProgramExercise } from './types';

type Row = [name: string, sets: number, min: number, max: number];

function pe([name, sets, min, max]: Row): ProgramExercise {
  return {
    id: uid(),
    exerciseId: slugify(name),
    notes: '',
    sets: Array.from({ length: sets }, () =>
      newSetTarget({ target: { kind: 'range', min, max }, intensity: { kind: 'rpeRange', min: 8, max: 10 } }),
    ),
  };
}

function day(name: string, rows: Row[]): ProgramDay {
  return { id: uid(), name, exercises: rows.map(pe) };
}

/** The user's own PPLUA program: 5 days that loop indefinitely. */
export function pplua(): Program {
  const now = Date.now();
  return {
    id: 'pplua',
    name: 'PPLUA',
    description: 'Push / Pull / Legs / Upper / Arms, on a loop.',
    mode: 'loop',
    numWeeks: 12,
    createdAt: now,
    updatedAt: now,
    weeks: [
      {
        id: uid(),
        days: [
          day('Push', [
            ['Lateral Raise (Cable)', 4, 8, 12],
            ['Incline Chest Press (Machine)', 4, 5, 8],
            ['Seated Military Press (Barbell)', 3, 8, 12],
            ['Chest Fly (Machine)', 3, 10, 15],
            ['Tricep Rope Push Down (Cable)', 3, 8, 12],
          ]),
          day('Pull', [
            ['Pull-Up (Assisted)', 4, 5, 8],
            ['T-Bar Row', 4, 5, 8],
            ['Rear Delt Fly (Cable)', 4, 8, 12],
            ['Seated Row (Cable)', 3, 10, 12],
            ['Hammer Curl (Dumbbell)', 3, 8, 12],
          ]),
          day('Legs', [
            ['Leg Press', 4, 5, 8],
            ['Leg Extension', 4, 10, 12],
            ['Leg Curl', 4, 10, 12],
          ]),
          day('Upper', [
            ['Lateral Raise (Machine)', 4, 8, 12],
            ['Incline Bench Press (Dumbbell)', 4, 8, 10],
            ['Lat Pulldown (Neutral Grip)', 3, 8, 12],
            ['Seated Military Press (Barbell)', 3, 8, 12],
            ['Rear Delt Row', 3, 12, 15],
          ]),
          day('Arms', [
            ['Lateral Raise (Cable)', 4, 8, 12],
            ['Bayesian Curl', 3, 10, 12],
            ['Tricep Rope Push Down (Cable)', 3, 10, 12],
            ['Concentration Curl', 3, 8, 12],
            ['Overhead Tricep Extension (Cable)', 3, 10, 12],
            ['Hammer Curl (Dumbbell)', 3, 10, 12],
          ]),
        ],
      },
    ],
  };
}
