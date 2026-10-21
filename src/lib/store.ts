import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { uid } from './calc';
import { BUILTIN_EXERCISES } from './exercises';
import { applyWorkoutToProgram, pendingChangeFor, type ApplyScope, type PendingProgramChange } from './programSync';
import { pplua } from './seed';
import { mergePersisted, migrate, PERSIST_VERSION } from './persistence';
import { debouncedStorage } from './storage';
import {
  autofillWorkout,
  detectPRs,
  firstIncompleteSlot,
  newWorkout,
  programDayAt,
  repeatWorkout,
  slotKey,
  workoutExerciseFromProgram,
  type PR,
} from './tracking';
import type {
  ActiveProgram,
  Exercise,
  Program,
  ProgramExercise,
  Settings,
  Template,
  Unit,
  Workout,
} from './types';
import { convertStoredWeight, convertWorkoutUnit, dedupeImported, finishWorkout, markSlotDone, trainingMax, unmarkWorkout } from './workoutOps';

export type FinishResult = { workout: Workout; prs: PR[]; pending?: PendingProgramChange };

type State = {
  programs: Program[];
  activeProgram?: ActiveProgram;
  history: Workout[];
  active?: Workout;
  customExercises: Exercise[];
  templates: Template[];
  oneRepMaxes: Record<string, number>;
  settings: Settings;
  lastFinished?: FinishResult;
  seeded: boolean;
};

type Actions = {
  // Programs
  saveProgram: (p: Program) => void;
  deleteProgram: (id: string) => void;
  startProgram: (id: string) => void;
  stopProgram: () => void;
  setSlotSkipped: (week: number, day: number, skipped: boolean) => void;
  // Workouts
  startProgramWorkout: (programId: string, week: number, day: number) => void;
  startEmptyWorkout: () => void;
  startFromWorkout: (w: Workout) => void;
  startFromTemplate: (t: Template) => void;
  updateActive: (fn: (w: Workout) => Workout) => void;
  togglePause: () => void;
  discardActive: () => void;
  finishActive: () => FinishResult | undefined;
  /** Apply the accepted in-workout edits from the last finished workout to its program. */
  applyPendingChange: (accepted: string[], scope: ApplyScope) => void;
  dismissPendingChange: () => void;
  updateHistory: (id: string, fn: (w: Workout) => Workout) => void;
  deleteWorkout: (id: string) => void;
  // Library
  saveCustomExercise: (e: Exercise) => void;
  deleteCustomExercise: (id: string) => void;
  saveTemplate: (t: Template) => void;
  deleteTemplate: (id: string) => void;
  setOneRepMax: (exerciseId: string, value: number | null) => void;
  updateSettings: (p: Partial<Settings>) => void;
  /** Switch units, converting every stored weight so numbers stay meaningful. */
  setUnit: (unit: Unit) => void;
  // Data
  /** Adds imported workouts, skipping ones already in history (same start time + name). Returns how many were added. */
  importWorkouts: (ws: Workout[], newExercises: Exercise[]) => number;
  replaceAll: (data: Partial<State>) => void;
  resetAll: () => void;
};

export const DEFAULT_SETTINGS: Settings = {
  unit: 'lb',
  autofillValues: false,
  barWeight: { lb: 45, kg: 20 },
  plateRounding: { lb: 5, kg: 2.5 },
  availablePlates: { lb: [45, 35, 25, 10, 5, 2.5], kg: [25, 20, 15, 10, 5, 2.5, 1.25] },
  haptics: true,
  appearance: 'system',
};

const initial = (): State => ({
  programs: [pplua()],
  activeProgram: { programId: 'pplua', startedAt: Date.now(), completed: {} },
  history: [],
  active: undefined,
  customExercises: [],
  templates: [],
  oneRepMaxes: {},
  settings: DEFAULT_SETTINGS,
  lastFinished: undefined,
  seeded: true,
});

export const SKIPPED = 'skipped';

export { migrate, PERSIST_VERSION };

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => {
      /** Training max for %-based sets: entered value, else best estimated 1RM. */
      const oneRmFor = (id: string) => trainingMax(get().oneRepMaxes, get().history, id);
      const begin = (w: Workout) => {
        const s = get().settings;
        const ready = s.autofillValues ? autofillWorkout(w, get().history, oneRmFor, s.plateRounding[s.unit]) : w;
        set({ active: ready });
      };
      return {
        ...initial(),

        saveProgram: (p) =>
          set((st) => {
            const next = { ...p, updatedAt: Date.now() };
            const exists = st.programs.some((x) => x.id === p.id);
            return { programs: exists ? st.programs.map((x) => (x.id === p.id ? next : x)) : [...st.programs, next] };
          }),
        deleteProgram: (id) =>
          set((st) => ({
            programs: st.programs.filter((p) => p.id !== id),
            activeProgram: st.activeProgram?.programId === id ? undefined : st.activeProgram,
          })),
        startProgram: (id) => set({ activeProgram: { programId: id, startedAt: Date.now(), completed: {} } }),
        stopProgram: () => set({ activeProgram: undefined }),
        setSlotSkipped: (week, day, skipped) =>
          set((st) => {
            if (!st.activeProgram) return {};
            const completed = { ...st.activeProgram.completed };
            const key = slotKey(week, day);
            if (skipped) completed[key] = SKIPPED;
            else delete completed[key];
            return { activeProgram: { ...st.activeProgram, completed } };
          }),

        startProgramWorkout: (programId, week, day) => {
          const program = get().programs.find((p) => p.id === programId);
          if (!program) return;
          const d = programDayAt(program, week, day);
          if (!d) return;
          const name = d.name || `Day ${day + 1}`;
          begin(newWorkout(name, get().settings.unit, d.exercises.map(workoutExerciseFromProgram), { programId, week, day }));
        },
        startEmptyWorkout: () => begin(newWorkout('Workout', get().settings.unit)),
        startFromWorkout: (w) => begin(repeatWorkout(w, get().settings.unit)),
        startFromTemplate: (t) => begin(newWorkout(t.name, get().settings.unit, t.exercises.map(workoutExerciseFromProgram))),
        updateActive: (fn) => set((st) => (st.active ? { active: fn(st.active) } : {})),
        togglePause: () =>
          set((st) => {
            const w = st.active;
            if (!w) return {};
            if (w.pausedAt) return { active: { ...w, pausedMs: w.pausedMs + (Date.now() - w.pausedAt), pausedAt: undefined } };
            return { active: { ...w, pausedAt: Date.now() } };
          }),
        discardActive: () => set({ active: undefined }),
        finishActive: () => {
          const st = get();
          const w = st.active;
          if (!w) return undefined;
          const finished = finishWorkout(w, Date.now());
          const prs = detectPRs(finished, st.history);
          const activeProgram = markSlotDone(st.activeProgram, finished);
          // Compare the workout as edited (before unchecked sets are dropped) with its program day.
          const program = st.programs.find((p) => p.id === w.programRef?.programId);
          const names = Object.fromEntries(allExercises(st.customExercises).map((e) => [e.id, e.name]));
          const pending = pendingChangeFor(program, w, (id) => names[id] ?? id);
          const result = { workout: finished, prs, pending };
          set({ history: [...st.history, finished], active: undefined, activeProgram, lastFinished: result });
          return result;
        },
        applyPendingChange: (accepted, scope) =>
          set((st) => {
            const pending = st.lastFinished?.pending;
            if (!pending || !accepted.length) return {};
            const programs = st.programs.map((p) =>
              p.id === pending.programId ? { ...applyWorkoutToProgram(p, pending.workout, scope, new Set(accepted)), updatedAt: Date.now() } : p,
            );
            return { programs, lastFinished: { ...st.lastFinished!, pending: undefined } };
          }),
        dismissPendingChange: () => set((st) => (st.lastFinished ? { lastFinished: { ...st.lastFinished, pending: undefined } } : {})),
        updateHistory: (id, fn) => set((st) => ({ history: st.history.map((w) => (w.id === id ? fn(w) : w)) })),
        deleteWorkout: (id) =>
          set((st) => ({ history: st.history.filter((w) => w.id !== id), activeProgram: unmarkWorkout(st.activeProgram, id) })),


        saveCustomExercise: (e) =>
          set((st) => {
            const exists = st.customExercises.some((x) => x.id === e.id);
            return { customExercises: exists ? st.customExercises.map((x) => (x.id === e.id ? e : x)) : [...st.customExercises, e] };
          }),
        deleteCustomExercise: (id) => set((st) => ({ customExercises: st.customExercises.filter((e) => e.id !== id) })),
        saveTemplate: (t) =>
          set((st) => {
            const exists = st.templates.some((x) => x.id === t.id);
            return { templates: exists ? st.templates.map((x) => (x.id === t.id ? t : x)) : [...st.templates, t] };
          }),
        deleteTemplate: (id) => set((st) => ({ templates: st.templates.filter((t) => t.id !== id) })),
        setOneRepMax: (id, value) =>
          set((st) => {
            const next = { ...st.oneRepMaxes };
            if (value == null || value <= 0) delete next[id];
            else next[id] = value;
            return { oneRepMaxes: next };
          }),
        updateSettings: (p) => set((st) => ({ settings: { ...st.settings, ...p } })),

        setUnit: (unit) =>
          set((st) => {
            if (unit === st.settings.unit) return {};
            const from = st.settings.unit;
            return {
              settings: { ...st.settings, unit },
              history: st.history.map((w) => convertWorkoutUnit(w, from, unit)),
              active: st.active ? convertWorkoutUnit(st.active, from, unit) : undefined,
              oneRepMaxes: Object.fromEntries(Object.entries(st.oneRepMaxes).map(([k, v]) => [k, convertStoredWeight(v, from, unit) ?? v])),
            };
          }),

        importWorkouts: (ws, newExercises) => {
          const st = get();
          const { fresh, addCustom } = dedupeImported(st.history, ws, st.customExercises, newExercises);
          set({ history: [...st.history, ...fresh], customExercises: [...st.customExercises, ...addCustom] });
          return fresh.length;
        },
        replaceAll: (data) => set({ ...initial(), ...data, active: undefined }),
        resetAll: () => set({ ...initial() }),
      };
    },
    {
      name: 'liftbook-v1',
      storage: createJSONStorage(() => debouncedStorage),
      // Bump when the persisted shape changes, and add a step to migrate() so existing
      // history on the phone is upgraded rather than silently mis-read.
      version: PERSIST_VERSION,
      migrate: (persisted, from) => migrate(persisted as Partial<State>, from),
      partialize: (s) => ({
        programs: s.programs,
        activeProgram: s.activeProgram,
        history: s.history,
        active: s.active,
        customExercises: s.customExercises,
        templates: s.templates,
        oneRepMaxes: s.oneRepMaxes,
        settings: s.settings,
        seeded: s.seeded,
      }),
      merge: (persisted, current) => mergePersisted(persisted as Partial<State & Actions> | undefined, current, DEFAULT_SETTINGS),
    },
  ),
);

/** Built-in plus custom exercises. Call inside components via useExercises(). */
export function allExercises(custom: Exercise[]): Exercise[] {
  return [...BUILTIN_EXERCISES, ...custom];
}

export function nextProgramSlot(program: Program, active: ActiveProgram) {
  return firstIncompleteSlot(program, active.completed);
}

export function blankProgram(): Program {
  const now = Date.now();
  return {
    id: uid(),
    name: '',
    description: '',
    mode: 'loop',
    numWeeks: 8,
    createdAt: now,
    updatedAt: now,
    weeks: [{ id: uid(), days: [{ id: uid(), name: 'Day 1', exercises: [] }] }],
  };
}

export function blankProgramExercise(exerciseId: string, sets = 3): ProgramExercise {
  return {
    id: uid(),
    exerciseId,
    notes: '',
    sets: Array.from({ length: sets }, () => ({
      id: uid(),
      type: 'normal' as const,
      target: { kind: 'range' as const, min: 8, max: 12 },
      intensity: { kind: 'none' as const },
    })),
  };
}
