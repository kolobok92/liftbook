export type Unit = 'lb' | 'kg';

export type Muscle =
  | 'chest'
  | 'frontDelts'
  | 'sideDelts'
  | 'rearDelts'
  | 'triceps'
  | 'biceps'
  | 'forearms'
  | 'lats'
  | 'upperBack'
  | 'traps'
  | 'lowerBack'
  | 'abs'
  | 'obliques'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'adductors'
  | 'abductors';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'cable'
  | 'machine'
  | 'bodyweight'
  | 'kettlebell'
  | 'band'
  | 'smith'
  | 'ezbar'
  | 'other';

export type Exercise = {
  id: string;
  name: string;
  equipment: Equipment;
  primary: Muscle[];
  secondary: Muscle[];
  /** Bodyweight-style exercises log reps with optional added weight. */
  bodyweight?: boolean;
  /** Timed exercises (planks, carries) log seconds instead of reps. */
  timed?: boolean;
  custom?: boolean;
};

export type SetType = 'normal' | 'warmup' | 'drop' | 'failure';

export type RepTarget =
  | { kind: 'reps'; reps: number }
  | { kind: 'range'; min: number; max: number }
  | { kind: 'amrap'; min?: number }
  | { kind: 'time'; seconds: number }
  | { kind: 'timeRange'; min: number; max: number };

export type Intensity =
  | { kind: 'none' }
  | { kind: 'rpe'; rpe: number }
  | { kind: 'rpeRange'; min: number; max: number }
  | { kind: 'pct'; pct: number };

export type SetTarget = {
  id: string;
  type: SetType;
  target: RepTarget;
  intensity: Intensity;
};

export type ProgramExercise = {
  id: string;
  exerciseId: string;
  notes: string;
  /** Exercises sharing a superset id are performed back-to-back. */
  superset?: string;
  sets: SetTarget[];
};

export type ProgramDay = {
  id: string;
  name: string;
  exercises: ProgramExercise[];
};

export type ProgramWeek = {
  id: string;
  phase?: string;
  days: ProgramDay[];
};

export type Program = {
  id: string;
  name: string;
  description: string;
  /**
   * loop: weeks[0].days cycle forever (no fixed length; edits apply to the next workout).
   * repeating: weeks[0] is the template used for every one of numWeeks weeks.
   * periodized: each week is written separately.
   */
  mode: 'loop' | 'repeating' | 'periodized';
  numWeeks: number;
  weeks: ProgramWeek[];
  createdAt: number;
  updatedAt: number;
};

export type LoggedSet = {
  id: string;
  type: SetType;
  weight: number | null;
  reps: number | null;
  /** Seconds, for timed exercises. */
  seconds?: number | null;
  rpe: number | null;
  done: boolean;
  target?: SetTarget;
};

export type WorkoutExercise = {
  id: string;
  exerciseId: string;
  notes: string;
  /** Instructions copied from the program, shown read-only. */
  instructions?: string;
  /** The program exercise this came from, so in-workout edits can be applied back. */
  programExerciseId?: string;
  superset?: string;
  sets: LoggedSet[];
};

export type ProgramRef = { programId: string; week: number; day: number };

export type Workout = {
  id: string;
  name: string;
  notes: string;
  startedAt: number;
  endedAt?: number;
  /** Milliseconds spent paused, subtracted from duration. */
  pausedMs: number;
  pausedAt?: number;
  programRef?: ProgramRef;
  exercises: WorkoutExercise[];
  /** Weight unit the workout was logged in. */
  unit: Unit;
  /** Exercise row last worked on (a set checked or a field opened), so going out of order
   * keeps the lock screen and the current-set marker on it. See currentRow(). */
  currentRowId?: string;
  /** How it became current: a set checked (a superset moves on to its partner) or a field
   * opened (you're on it). */
  currentBy?: 'check' | 'open';
};

export type ActiveProgram = {
  programId: string;
  startedAt: number;
  /** Key `${week}-${day}` → workout id. */
  completed: Record<string, string>;
};

export type Template = {
  id: string;
  name: string;
  exercises: ProgramExercise[];
  createdAt: number;
};

export type Settings = {
  unit: Unit;
  /** Prefill inputs with previous numbers as real values, not just hints. */
  autofillValues: boolean;
  barWeight: { lb: number; kg: number };
  plateRounding: { lb: number; kg: number };
  availablePlates: { lb: number[]; kg: number[] };
  haptics: boolean;
  /** 'system' follows the phone's light/dark setting. */
  appearance: 'system' | 'light' | 'dark';
};
