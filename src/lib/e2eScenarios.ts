// Named starting states for the native UI flows (.maestro), loaded through the e2e-seed route so
// a flow skips its 10–20 setup taps. Only reachable in builds bundled with EXPO_PUBLIC_E2E=1
// (the local Android runner and the iOS simulator workflow), never in the app on a phone.
import type { LoggedSet, Workout } from './types';

export const E2E = process.env.EXPO_PUBLIC_E2E === '1';

const BENCH = 'bench-press-barbell';
const HOUR = 3_600_000;

const set = (i: number, weight: number | null, reps: number | null, done: boolean): LoggedSet => ({ id: `e2e-s${i}`, type: 'normal', weight, reps, rpe: null, done });

const benchWorkout = (startedAt: number, sets: LoggedSet[], extra: Partial<Workout> = {}): Workout => ({
  id: `e2e-w${startedAt}`,
  name: 'Workout',
  notes: '',
  startedAt,
  pausedMs: 0,
  unit: 'lb',
  exercises: [{ id: 'e2e-e0', exerciseId: BENCH, notes: '', sets }],
  ...extra,
});

export type Scenario = { state: (now: number) => Record<string, unknown>; open: '/' | '/workout' };

export const SCENARIOS: Record<string, Scenario> = {
  // Free-form workout in progress: bench press with three empty sets (the tracker opens).
  'bench-active': {
    state: (now) => ({ active: benchWorkout(now, [0, 1, 2].map((i) => set(i, null, null, false))) }),
    open: '/workout',
  },
  // Yesterday's finished workout: bench 185 × 5 and 205 × 3 (history, records, Previous).
  'bench-history': {
    state: (now) => ({ history: [benchWorkout(now - 24 * HOUR, [set(0, 185, 5, true), set(1, 205, 3, true)], { endedAt: now - 23 * HOUR })] }),
    open: '/',
  },
};
