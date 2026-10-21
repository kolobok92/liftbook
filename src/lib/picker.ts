import { router } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { create } from 'zustand';
import { uid } from './calc';

/**
 * Returning a value from the exercise picker screen. The opener gets a request id; the
 * picker (given that id via route params) delivers the chosen exercise ids here; the opener's
 * handler — kept in its own component, not a module global — consumes them.
 */
type PickerResults = {
  results: Record<string, string[]>;
  deliver: (requestId: string, ids: string[]) => void;
  clear: (requestId: string) => void;
};

export const usePickerResults = create<PickerResults>((set) => ({
  results: {},
  deliver: (requestId, ids) => set((s) => ({ results: { ...s.results, [requestId]: ids } })),
  clear: (requestId) =>
    set((s) => {
      const results = { ...s.results };
      delete results[requestId];
      return { results };
    }),
}));

/** Open the picker; `onPick` runs in this component with the chosen exercise ids. */
export function useExercisePicker() {
  const handlers = useRef(new Map<string, (ids: string[]) => void>());
  const results = usePickerResults((s) => s.results);

  useEffect(() => {
    for (const [requestId, ids] of Object.entries(results)) {
      const handler = handlers.current.get(requestId);
      if (!handler) continue;
      handlers.current.delete(requestId);
      usePickerResults.getState().clear(requestId);
      handler(ids);
    }
  }, [results]);

  return useCallback((opts: { multi: boolean }, onPick: (ids: string[]) => void) => {
    const requestId = uid();
    handlers.current.set(requestId, onPick);
    router.push({ pathname: '/exercise-picker', params: { req: requestId, multi: opts.multi ? '1' : '0' } });
  }, []);
}
