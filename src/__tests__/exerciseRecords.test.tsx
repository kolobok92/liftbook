import { describe, expect, it, jest } from '@jest/globals';
import { act, render, screen, within } from '@testing-library/react-native';
import { useStore } from '@/lib/store';
import type { Workout } from '@/lib/types';
import ExerciseScreen from '@/app/exercise/[id]';

jest.mock('expo-router', () => ({
  router: { push: () => {}, back: () => {} },
  useLocalSearchParams: () => ({ id: 'bench-press-barbell' }),
  Stack: { Screen: () => null },
}));

const day = (n: number) => Date.UTC(2026, 9, n, 18);
const bench = (t: number, sets: [number, number][]): Workout => ({
  id: `w${t}`,
  name: 'Push',
  notes: '',
  startedAt: t,
  endedAt: t + 3_600_000,
  pausedMs: 0,
  unit: 'lb',
  exercises: [{ id: 'e', exerciseId: 'bench-press-barbell', notes: '', sets: sets.map(([weight, reps], i) => ({ id: `s${i}`, type: 'normal', weight, reps, rpe: null, done: true })) }],
});

describe('exercise records', () => {
  it('shows max weight and best estimated 1RM across history', async () => {
    await act(async () => {
      useStore.getState().resetAll();
      useStore.setState({ history: [bench(day(1), [[185, 5]]), bench(day(8), [[205, 3], [185, 6]])] });
    });
    await render(<ExerciseScreen />);
    expect(within(screen.getByTestId('record-weight')).getByText(/205/)).toHaveTextContent('205 lb');
    // Epley: 205 × (1 + 3/30) = 225.5 → 226
    expect(screen.getByTestId('record-e1rm')).toHaveTextContent(/226\s*lb/);
  });
});
