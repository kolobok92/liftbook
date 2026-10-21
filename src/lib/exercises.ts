import freeExerciseIndex from '../data/free-exercises.json';
import type { Equipment, Exercise, Muscle } from './types';

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Chest',
  frontDelts: 'Front Delts',
  sideDelts: 'Middle Delts',
  rearDelts: 'Rear Delts',
  triceps: 'Triceps',
  biceps: 'Biceps',
  forearms: 'Forearms',
  lats: 'Lats',
  upperBack: 'Upper Back',
  traps: 'Traps',
  lowerBack: 'Lower Back',
  abs: 'Abs',
  obliques: 'Obliques',
  quads: 'Quadriceps',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  adductors: 'Adductors',
  abductors: 'Abductors',
};

export const ALL_MUSCLES = Object.keys(MUSCLE_LABEL) as Muscle[];

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  cable: 'Cable',
  machine: 'Machine',
  bodyweight: 'Bodyweight',
  kettlebell: 'Kettlebell',
  band: 'Band',
  smith: 'Smith Machine',
  ezbar: 'EZ Bar',
  other: 'Other',
};

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type Flags = { bw?: boolean; timed?: boolean };

function ex(name: string, equipment: Equipment, primary: Muscle[], secondary: Muscle[] = [], flags: Flags = {}): Exercise {
  return { id: slugify(name), name, equipment, primary, secondary, bodyweight: flags.bw, timed: flags.timed };
}

const BW: Flags = { bw: true };
const T: Flags = { timed: true };

/** Hand-curated, Boostcamp-style names; these are what programs and CSV imports match first. */
export const CURATED_EXERCISES: Exercise[] = [
  // Chest
  ex('Bench Press (Barbell)', 'barbell', ['chest'], ['frontDelts', 'triceps']),
  ex('Bench Press (Dumbbell)', 'dumbbell', ['chest'], ['frontDelts', 'triceps']),
  ex('Bench Press (Smith Machine)', 'smith', ['chest'], ['frontDelts', 'triceps']),
  ex('Close Grip Bench Press (Barbell)', 'barbell', ['triceps', 'chest'], ['frontDelts']),
  ex('Incline Bench Press (Barbell)', 'barbell', ['chest', 'frontDelts'], ['triceps']),
  ex('Incline Bench Press (Dumbbell)', 'dumbbell', ['chest', 'frontDelts'], ['triceps']),
  ex('Incline Bench Press (Smith Machine)', 'smith', ['chest', 'frontDelts'], ['triceps']),
  ex('Decline Bench Press (Barbell)', 'barbell', ['chest'], ['triceps']),
  ex('Chest Press (Machine)', 'machine', ['chest'], ['frontDelts', 'triceps']),
  ex('Incline Chest Press (Machine)', 'machine', ['chest', 'frontDelts'], ['triceps']),
  ex('Chest Fly (Machine)', 'machine', ['chest'], ['frontDelts']),
  ex('Chest Fly (Dumbbell)', 'dumbbell', ['chest'], ['frontDelts']),
  ex('Incline Chest Fly (Dumbbell)', 'dumbbell', ['chest'], ['frontDelts']),
  ex('Cable Crossover', 'cable', ['chest'], ['frontDelts']),
  ex('Low to High Cable Fly', 'cable', ['chest'], ['frontDelts']),
  ex('Push-Up', 'bodyweight', ['chest'], ['triceps', 'frontDelts'], BW),
  ex('Dip', 'bodyweight', ['chest', 'triceps'], ['frontDelts'], BW),
  ex('Dip (Assisted)', 'machine', ['chest', 'triceps'], ['frontDelts']),
  ex('Pec Deck', 'machine', ['chest'], []),

  // Shoulders
  ex('Overhead Press (Barbell)', 'barbell', ['frontDelts'], ['sideDelts', 'triceps']),
  ex('Seated Military Press (Barbell)', 'barbell', ['frontDelts'], ['sideDelts', 'triceps']),
  ex('Shoulder Press (Dumbbell)', 'dumbbell', ['frontDelts'], ['sideDelts', 'triceps']),
  ex('Shoulder Press (Machine)', 'machine', ['frontDelts'], ['sideDelts', 'triceps']),
  ex('Arnold Press (Dumbbell)', 'dumbbell', ['frontDelts'], ['sideDelts', 'triceps']),
  ex('Lateral Raise (Dumbbell)', 'dumbbell', ['sideDelts'], []),
  ex('Lateral Raise (Cable)', 'cable', ['sideDelts'], []),
  ex('Lateral Raise (Machine)', 'machine', ['sideDelts'], []),
  ex('Front Raise (Dumbbell)', 'dumbbell', ['frontDelts'], []),
  ex('Rear Delt Fly (Dumbbell)', 'dumbbell', ['rearDelts'], ['upperBack']),
  ex('Rear Delt Fly (Cable)', 'cable', ['rearDelts'], ['upperBack']),
  ex('Rear Delt Fly (Machine)', 'machine', ['rearDelts'], ['upperBack']),
  ex('Rear Delt Row', 'dumbbell', ['rearDelts', 'upperBack'], ['biceps']),
  ex('Face Pull (Cable)', 'cable', ['rearDelts'], ['upperBack', 'traps']),
  ex('Upright Row (Barbell)', 'barbell', ['sideDelts', 'traps'], ['biceps']),
  ex('Shrug (Barbell)', 'barbell', ['traps'], []),
  ex('Shrug (Dumbbell)', 'dumbbell', ['traps'], []),

  // Back
  ex('Deadlift (Barbell)', 'barbell', ['hamstrings', 'glutes', 'lowerBack'], ['upperBack', 'traps', 'forearms', 'quads']),
  ex('Sumo Deadlift (Barbell)', 'barbell', ['glutes', 'hamstrings', 'adductors'], ['lowerBack', 'quads', 'traps']),
  ex('Romanian Deadlift (Barbell)', 'barbell', ['hamstrings', 'glutes'], ['lowerBack']),
  ex('Romanian Deadlift (Dumbbell)', 'dumbbell', ['hamstrings', 'glutes'], ['lowerBack']),
  ex('Pull-Up', 'bodyweight', ['lats'], ['biceps', 'upperBack'], BW),
  ex('Pull-Up (Assisted)', 'machine', ['lats'], ['biceps', 'upperBack']),
  ex('Chin-Up', 'bodyweight', ['lats', 'biceps'], ['upperBack'], BW),
  ex('Lat Pulldown (Cable)', 'cable', ['lats'], ['biceps', 'upperBack']),
  ex('Lat Pulldown (Neutral Grip)', 'cable', ['lats'], ['biceps', 'upperBack']),
  ex('Lat Pulldown (Machine)', 'machine', ['lats'], ['biceps', 'upperBack']),
  ex('Straight Arm Pulldown (Cable)', 'cable', ['lats'], []),
  ex('Bent Over Row (Barbell)', 'barbell', ['upperBack', 'lats'], ['biceps', 'rearDelts', 'lowerBack']),
  ex('Pendlay Row (Barbell)', 'barbell', ['upperBack', 'lats'], ['biceps', 'rearDelts']),
  ex('Dumbbell Row', 'dumbbell', ['lats', 'upperBack'], ['biceps', 'rearDelts']),
  ex('T-Bar Row', 'barbell', ['upperBack', 'lats'], ['biceps', 'rearDelts']),
  ex('Seated Row (Cable)', 'cable', ['upperBack', 'lats'], ['biceps', 'rearDelts']),
  ex('Seated Row (Machine)', 'machine', ['upperBack', 'lats'], ['biceps', 'rearDelts']),
  ex('Chest Supported Row (Dumbbell)', 'dumbbell', ['upperBack', 'lats'], ['biceps', 'rearDelts']),
  ex('Chest Supported Row (Machine)', 'machine', ['upperBack', 'lats'], ['biceps', 'rearDelts']),
  ex('Back Extension', 'bodyweight', ['lowerBack'], ['glutes', 'hamstrings'], BW),
  ex('Good Morning (Barbell)', 'barbell', ['hamstrings', 'lowerBack'], ['glutes']),
  ex('Rack Pull (Barbell)', 'barbell', ['upperBack', 'traps', 'lowerBack'], ['glutes', 'forearms']),

  // Arms
  ex('Bicep Curl (Barbell)', 'barbell', ['biceps'], ['forearms']),
  ex('Bicep Curl (Dumbbell)', 'dumbbell', ['biceps'], ['forearms']),
  ex('Bicep Curl (Cable)', 'cable', ['biceps'], ['forearms']),
  ex('EZ Bar Curl', 'ezbar', ['biceps'], ['forearms']),
  ex('Hammer Curl (Dumbbell)', 'dumbbell', ['biceps', 'forearms'], []),
  ex('Hammer Curl (Cable)', 'cable', ['biceps', 'forearms'], []),
  ex('Incline Curl (Dumbbell)', 'dumbbell', ['biceps'], []),
  ex('Preacher Curl (EZ Bar)', 'ezbar', ['biceps'], []),
  ex('Preacher Curl (Machine)', 'machine', ['biceps'], []),
  ex('Bayesian Curl', 'cable', ['biceps'], []),
  ex('Concentration Curl', 'dumbbell', ['biceps'], []),
  ex('Spider Curl (Dumbbell)', 'dumbbell', ['biceps'], []),
  ex('Reverse Curl (EZ Bar)', 'ezbar', ['forearms'], ['biceps']),
  ex('Wrist Curl (Dumbbell)', 'dumbbell', ['forearms'], []),
  ex('Tricep Pushdown (Cable)', 'cable', ['triceps'], []),
  ex('Tricep Rope Push Down (Cable)', 'cable', ['triceps'], []),
  ex('Overhead Tricep Extension (Cable)', 'cable', ['triceps'], []),
  ex('Overhead Tricep Extension (Dumbbell)', 'dumbbell', ['triceps'], []),
  ex('Skull Crusher (EZ Bar)', 'ezbar', ['triceps'], []),
  ex('Tricep Extension (Machine)', 'machine', ['triceps'], []),
  ex('Tricep Kickback (Dumbbell)', 'dumbbell', ['triceps'], []),
  ex('JM Press (Barbell)', 'barbell', ['triceps'], ['chest']),

  // Legs
  ex('Squat (Barbell)', 'barbell', ['quads', 'glutes'], ['adductors', 'lowerBack', 'hamstrings']),
  ex('Front Squat (Barbell)', 'barbell', ['quads'], ['glutes', 'upperBack']),
  ex('Pause Squat (Barbell)', 'barbell', ['quads', 'glutes'], ['adductors', 'lowerBack']),
  ex('Squat (Smith Machine)', 'smith', ['quads', 'glutes'], ['adductors']),
  ex('Hack Squat', 'machine', ['quads'], ['glutes']),
  ex('Pendulum Squat', 'machine', ['quads'], ['glutes']),
  ex('Goblet Squat', 'dumbbell', ['quads', 'glutes'], ['adductors']),
  ex('Leg Press', 'machine', ['quads', 'glutes'], ['adductors']),
  ex('Bulgarian Split Squat (Dumbbell)', 'dumbbell', ['quads', 'glutes'], ['adductors']),
  ex('Walking Lunge (Dumbbell)', 'dumbbell', ['quads', 'glutes'], ['adductors', 'hamstrings']),
  ex('Reverse Lunge (Dumbbell)', 'dumbbell', ['quads', 'glutes'], ['hamstrings']),
  ex('Step-Up (Dumbbell)', 'dumbbell', ['quads', 'glutes'], []),
  ex('Leg Extension', 'machine', ['quads'], []),
  ex('Leg Curl', 'machine', ['hamstrings'], []),
  ex('Seated Leg Curl', 'machine', ['hamstrings'], []),
  ex('Lying Leg Curl', 'machine', ['hamstrings'], []),
  ex('Nordic Hamstring Curl', 'bodyweight', ['hamstrings'], [], BW),
  ex('Hip Thrust (Barbell)', 'barbell', ['glutes'], ['hamstrings']),
  ex('Hip Thrust (Machine)', 'machine', ['glutes'], ['hamstrings']),
  ex('Glute Bridge', 'bodyweight', ['glutes'], ['hamstrings'], BW),
  ex('Cable Kickback', 'cable', ['glutes'], []),
  ex('Hip Abduction (Machine)', 'machine', ['abductors'], ['glutes']),
  ex('Hip Adduction (Machine)', 'machine', ['adductors'], []),
  ex('Standing Calf Raise', 'machine', ['calves'], []),
  ex('Seated Calf Raise', 'machine', ['calves'], []),
  ex('Calf Press (Leg Press)', 'machine', ['calves'], []),

  // Core
  ex('Plank', 'bodyweight', ['abs'], ['obliques'], T),
  ex('Side Plank', 'bodyweight', ['obliques'], ['abs'], T),
  ex('Crunch', 'bodyweight', ['abs'], [], BW),
  ex('Cable Crunch', 'cable', ['abs'], []),
  ex('Hanging Leg Raise', 'bodyweight', ['abs'], ['obliques'], BW),
  ex('Ab Wheel Rollout', 'other', ['abs'], ['lats'], BW),
  ex('Russian Twist', 'bodyweight', ['obliques'], ['abs'], BW),
  ex('Pallof Press (Cable)', 'cable', ['obliques'], ['abs']),
  ex('Decline Sit-Up', 'bodyweight', ['abs'], [], BW),

  // Full body / misc
  ex('Power Clean (Barbell)', 'barbell', ['quads', 'glutes', 'traps'], ['hamstrings', 'upperBack', 'lowerBack']),
  ex('Kettlebell Swing', 'kettlebell', ['glutes', 'hamstrings'], ['lowerBack']),
  ex("Farmer's Carry", 'dumbbell', ['forearms', 'traps'], ['abs'], T),
];

/** ~700 more from free-exercise-db (public domain), generated by scripts/import-free-exercise-db.mjs. */
export const FREE_EXERCISES = freeExerciseIndex as Exercise[];

export const BUILTIN_EXERCISES: Exercise[] = [...CURATED_EXERCISES, ...FREE_EXERCISES];

export const BUILTIN_BY_ID: Record<string, Exercise> = Object.fromEntries(BUILTIN_EXERCISES.map((e) => [e.id, e]));

export type ExerciseDetails = { instructions: string[]; images: string[]; level?: string; mechanic?: string };

let details: Record<string, ExerciseDetails> | undefined;

/**
 * Instructions and photos for free-exercise-db entries. The 600 KB details file is loaded on
 * first use (Metro evaluates a required module only when first required), not at startup.
 */
/** Photos and steps from free-exercise-db: imported exercises, and curated ones it also covers. */
export function exerciseDetails(id: string): ExerciseDetails | undefined {
  details ??= require('../data/free-exercise-details.json') as Record<string, ExerciseDetails>;
  return details[id];
}

export const exerciseImageUrl = (path: string) => `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${path}`;

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(the|a)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Best-effort match of an imported exercise name to a known exercise. */
export function matchExerciseByName(name: string, exercises: Exercise[]): Exercise | undefined {
  const target = norm(name);
  const exact = exercises.find((e) => norm(e.name) === target);
  if (exact) return exact;
  // "Bench Press - Barbell" or "Barbell Bench Press" → compare the sorted word sets.
  const words = (s: string) =>
    s
      .toLowerCase()
      .replace(/[()\-–,]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .sort()
      .join(' ');
  const w = words(name);
  return exercises.find((e) => words(e.name) === w);
}
