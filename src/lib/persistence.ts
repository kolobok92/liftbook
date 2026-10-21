// Persisted-state versioning, shared by AsyncStorage rehydration (store.ts) and backup restore
// (Profile), so an old backup goes through the same upgrades as old on-device data.
import type { Settings } from './types';

/** Bump when the persisted shape changes, and add a step to migrate(). */
export const PERSIST_VERSION = 1;

/** Upgrade persisted state written by older app versions, one version at a time. */
export function migrate<T extends object>(state: T, from: number): T {
  let s = state;
  if (from < 1) {
    // v0 → v1: no shape change (programExerciseId is optional; rest timer fields are ignored).
    s = { ...s };
  }
  return s;
}

/** Stored state over the defaults; settings merged key by key so new settings get their default. */
export function mergePersisted<T extends { settings: Settings }>(persisted: Partial<T> | undefined, current: T, defaults: Settings): T {
  const p: Partial<T> = persisted ?? {};
  return { ...current, ...p, settings: { ...defaults, ...(p.settings ?? {}) } };
}

/** The parts of the app's state a backup carries (everything the user made; no transient UI state). */
export type BackupData = {
  programs: unknown[];
  activeProgram?: unknown;
  history: unknown[];
  customExercises: unknown[];
  templates: unknown[];
  oneRepMaxes: Record<string, number>;
  settings: Partial<Settings>;
};

export function makeBackup(data: BackupData, now = new Date()): string {
  return JSON.stringify({ app: 'liftbook', version: PERSIST_VERSION, exportedAt: now.toISOString(), ...data });
}

/** Parse a backup file and bring it up to the current shape (same migrate() as on-device data). */
export function parseBackup(text: string): { ok: true; data: BackupData; exportedAt?: string } | { ok: false; error: string } {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not a Liftbook backup.' };
  }
  if (raw?.app !== 'liftbook' || !Array.isArray(raw.history) || !Array.isArray(raw.programs)) return { ok: false, error: 'That file is not a Liftbook backup.' };
  const version = typeof raw.version === 'number' ? raw.version : 0;
  if (version > PERSIST_VERSION) return { ok: false, error: 'This backup was made by a newer version of Liftbook. Update the app first.' };
  const m = migrate(raw, version);
  return {
    ok: true,
    exportedAt: typeof m.exportedAt === 'string' ? m.exportedAt : undefined,
    data: {
      programs: m.programs as unknown[],
      activeProgram: m.activeProgram,
      history: m.history as unknown[],
      customExercises: (m.customExercises as unknown[]) ?? [],
      templates: (m.templates as unknown[]) ?? [],
      oneRepMaxes: (m.oneRepMaxes as Record<string, number>) ?? {},
      settings: (m.settings as Partial<Settings>) ?? {},
    },
  };
}
