import { createContext, useContext, useEffect, useState } from 'react';

/**
 * Per-editor registry so cards can be driven by their WorkoutEditor: move focus to the next
 * exercise's first open set, or ask the editor to open an exercise's note.
 * Scoped by React context (one per editor), not module globals.
 */
export type CardRegistry = {
  focusers: Map<string, () => boolean>;
  /** Focus the first unfinished set in any of these exercise rows, in order. */
  focusFirstOpen: (exerciseRowIds: string[]) => boolean;
  openNote: (exerciseRowId: string) => void;
};

/** `openNote` must be stable (e.g. a state setter): the registry is created once. */
export function useCardRegistryValue(openNote: (exerciseRowId: string) => void): CardRegistry {
  const [registry] = useState<CardRegistry>(() => {
    const focusers = new Map<string, () => boolean>();
    return {
      focusers,
      focusFirstOpen: (ids) => ids.some((id) => focusers.get(id)?.() ?? false),
      openNote,
    };
  });
  return registry;
}

export const CardRegistryContext = createContext<CardRegistry | null>(null);

/** Register this card's handlers with the enclosing editor (no-op outside one). */
export function useRegisterCard(exerciseRowId: string, focusFirstOpen: () => boolean) {
  const registry = useContext(CardRegistryContext);
  useEffect(() => {
    if (!registry) return;
    registry.focusers.set(exerciseRowId, focusFirstOpen);
    return () => {
      if (registry.focusers.get(exerciseRowId) === focusFirstOpen) registry.focusers.delete(exerciseRowId);
    };
  }, [registry, exerciseRowId, focusFirstOpen]);
  return registry;
}
