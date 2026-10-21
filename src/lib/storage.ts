import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import type { StateStorage } from 'zustand/middleware';

/**
 * AsyncStorage with debounced writes. The whole store (including all history) is one JSON
 * value, so writing it on every keystroke gets expensive as history grows. Writes are
 * coalesced and flushed after a short pause, and immediately when the app is backgrounded
 * or the page is hidden — the moments iOS/browsers may kill us — so nothing is lost.
 */
const DELAY_MS = 400;
const pending = new Map<string, string>();
let timer: ReturnType<typeof setTimeout> | undefined;

/** Write everything pending now. Synchronous on web (localStorage), so safe in pagehide. */
export function flushStorage(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = undefined;
  const entries = [...pending.entries()];
  pending.clear();
  if (Platform.OS === 'web') {
    for (const [k, v] of entries) window.localStorage.setItem(k, v);
    return Promise.resolve();
  }
  return Promise.all(entries.map(([k, v]) => AsyncStorage.setItem(k, v))).then(() => undefined);
}

export const debouncedStorage: StateStorage = {
  getItem: (key) => (pending.has(key) ? pending.get(key)! : AsyncStorage.getItem(key)),
  setItem: (key, value) => {
    pending.set(key, value);
    if (timer) clearTimeout(timer);
    timer = setTimeout(flushStorage, DELAY_MS);
  },
  removeItem: (key) => {
    pending.delete(key);
    return AsyncStorage.removeItem(key);
  },
};

AppState.addEventListener('change', (state) => {
  if (state !== 'active') flushStorage();
});
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => flushStorage());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushStorage();
  });
  // Lets E2E tests read storage deterministically.
  (window as unknown as { __flushStorage?: () => Promise<void> }).__flushStorage = flushStorage;
}
