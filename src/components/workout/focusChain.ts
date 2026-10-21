import { createContext, useState } from 'react';

/**
 * Per-editor registry so a card can ask its WorkoutEditor to open an exercise's note.
 * Scoped by React context (one per editor), not module globals.
 */
export type CardRegistry = {
  openNote: (exerciseRowId: string) => void;
};

/** `openNote` must be stable (e.g. a state setter): the registry is created once. */
export function useCardRegistryValue(openNote: (exerciseRowId: string) => void): CardRegistry {
  const [registry] = useState<CardRegistry>(() => ({ openNote }));
  return registry;
}

export const CardRegistryContext = createContext<CardRegistry | null>(null);
