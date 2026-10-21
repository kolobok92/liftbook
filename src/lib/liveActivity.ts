import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useExercises } from './hooks';
import { useStore } from './store';
import { DARK } from './theme';
import { type WorkoutActivity, workoutActivity } from './liveActivityState';
import thumbIds from '../data/exercise-thumbs.json';

const thumbs = new Set<string>(thumbIds);
const hasThumb = (id: string) => thumbs.has(id);

type Native = typeof import('expo-live-activity');
let native: Native | null | undefined;
function lib(): Native | null {
  if (native === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy: the native module only exists in iOS dev/prod builds
      native = Platform.OS === 'ios' ? (require('expo-live-activity') as Native) : null;
    } catch {
      native = null; // e.g. Expo Go: no widget extension
    }
  }
  return native;
}

function toNative(a: WorkoutActivity) {
  return {
    title: a.title,
    subtitle: a.subtitle,
    progressBar: a.startedAt != null ? { date: a.startedAt } : { progress: a.progress ?? 0 },
    imageName: a.image,
    dynamicIslandImageName: a.image,
  };
}

let current: { id: string; key: string } | undefined;

// The activity id survives the app being closed (iOS keeps the activity running), so a relaunch
// updates that activity instead of starting a second one next to a stale clock.
const ID_KEY = 'liftbook.liveActivityId';
const restored: Promise<void> =
  Platform.OS === 'ios'
    ? AsyncStorage.getItem(ID_KEY)
        .then((id) => {
          if (id && !current) current = { id, key: '' };
        })
        .catch(() => undefined)
    : Promise.resolve();
const remember = (id: string | undefined) => (id ? AsyncStorage.setItem(ID_KEY, id) : AsyncStorage.removeItem(ID_KEY)).catch(() => undefined);

/** Keeps one Live Activity in sync with the active workout (iOS only; no-op elsewhere). */
export function useWorkoutLiveActivity() {
  const active = useStore((s) => s.active);
  const { byId } = useExercises();
  useEffect(() => {
    const la = lib();
    if (!la) return;
    let cancelled = false;
    void restored.then(() => {
      if (!cancelled) sync(la);
    });
    return () => {
      cancelled = true;
    };

    function sync(la: Native) {
      try {
        if (!active) {
          if (current) la.stopActivity(current.id, { title: 'Workout finished' });
          current = undefined;
          void remember(undefined);
          return;
        }
        const state = workoutActivity(active, byId, hasThumb);
        const key = JSON.stringify(state);
        if (current?.key === key) return;
        if (current) {
          try {
            la.updateActivity(current.id, toNative(state));
            current.key = key;
            return;
          } catch {
            current = undefined; // ended or dismissed meanwhile: start a fresh one below
          }
        }
        {
          const id = la.startActivity(toNative(state), {
            backgroundColor: DARK.bg,
            titleColor: DARK.text,
            subtitleColor: DARK.textDim,
            progressViewTint: DARK.accent,
            progressViewLabelColor: DARK.accent,
            timerType: 'digital',
            imagePosition: 'right',
            imageSize: { width: 52, height: 52 },
            contentFit: 'cover',
            deepLinkUrl: '/workout',
          });
          if (id) {
            current = { id, key };
            void remember(id);
          }
        }
      } catch (e) {
        // Live Activities disabled in Settings, or unsupported: the app works without them.
        if (__DEV__) console.warn('Live Activity:', e);
      }
    }
  }, [active, byId]);
}
