import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { trainingMax } from './workoutOps';
import { allExercises, useStore } from './store';
import type { Exercise } from './types';

export function useExercises(): { list: Exercise[]; byId: Record<string, Exercise> } {
  const custom = useStore((s) => s.customExercises);
  return useMemo(() => {
    const list = allExercises(custom);
    return { list, byId: Object.fromEntries(list.map((e) => [e.id, e])) };
  }, [custom]);
}

export function exerciseName(byId: Record<string, Exercise>, id: string): string {
  return byId[id]?.name ?? id.replace(/^custom-/, '').replace(/-/g, ' ');
}

/** Re-render every `ms` milliseconds (for timers). */
export function useTick(ms = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms, enabled]);
  return now;
}

const subscribeHydration = (cb: () => void) => useStore.persist.onFinishHydration(cb);
const getHydrated = () => useStore.persist.hasHydrated();

/** True once persisted state has loaded (an external store, so useSyncExternalStore). */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeHydration, getHydrated, getHydrated);
}

/** "Now" for date math in render (week start, today), fixed for the screen's lifetime. */
export function useNow(): number {
  const [now] = useState(() => Date.now());
  return now;
}

export function useOneRepMax(exerciseId: string): number | undefined {
  const entered = useStore((s) => s.oneRepMaxes[exerciseId]);
  const history = useStore((s) => s.history);
  return useMemo(() => trainingMax(entered ? { [exerciseId]: entered } : {}, history, exerciseId), [entered, history, exerciseId]);
}
