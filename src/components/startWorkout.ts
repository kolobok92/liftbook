import { router } from 'expo-router';
import { useStore } from '@/lib/store';
import { confirm } from './ui';

/** Start a workout, asking first if one is already running. */
export async function startWorkout(start: () => void): Promise<void> {
  if (useStore.getState().active) {
    const ok = await confirm('Workout in progress', 'Discard the current workout and start a new one?', 'Discard & Start', true);
    if (!ok) return;
  }
  start();
  router.push('/workout');
}
