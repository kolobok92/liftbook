import { describe, expect, it } from 'vitest';
import { supersetLabels, targetLabel } from './calc';
import { templateFromWorkout } from './tracking';
import type { SetTarget, Workout } from './types';

const target = (t: SetTarget['target'], intensity: SetTarget['intensity'] = { kind: 'none' }): SetTarget => ({ id: 't', type: 'normal', target: t, intensity });

describe('superset labels', () => {
  it('letters groups in order and skips groups of one', () => {
    expect(supersetLabels([{}, { superset: 'x' }, { superset: 'x' }, { superset: 'lone' }, { superset: 'y' }, { superset: 'y' }])).toEqual([
      undefined,
      'SUPERSET A',
      'SUPERSET A',
      undefined,
      'SUPERSET B',
      'SUPERSET B',
    ]);
  });
});

describe('target label', () => {
  it('shows the % weight when the 1RM is known, else reps / time, with the intensity below', () => {
    expect(targetLabel(undefined, 'lb', 300, 5)).toEqual({ top: '—', sub: '' });
    expect(targetLabel(target({ kind: 'reps', reps: 5 }, { kind: 'pct', pct: 75 }), 'lb', 300, 5).top).toBe('225lb × 5');
    expect(targetLabel(target({ kind: 'reps', reps: 5 }, { kind: 'pct', pct: 72 }), 'lb', 300, 5).top).toBe('215lb × 5');
    expect(targetLabel(target({ kind: 'range', min: 5, max: 8 }, { kind: 'pct', pct: 75 }), 'lb', undefined, 5).top).toBe('5–8 reps');
    expect(targetLabel(target({ kind: 'time', seconds: 45 }), 'kg', undefined, 2.5)).toEqual({ top: '45s', sub: '' });
    expect(targetLabel(target({ kind: 'reps', reps: 8 }, { kind: 'rpe', rpe: 8 }), 'lb', undefined, 5).sub).toMatch(/RPE 8/);
  });
});

describe('template from a workout', () => {
  it('keeps program targets and turns free sets into "N reps"', () => {
    const t0 = target({ kind: 'range', min: 5, max: 8 });
    const w = {
      exercises: [
        {
          id: 'e',
          exerciseId: 'bench',
          notes: 'felt good',
          instructions: 'pause',
          superset: 's',
          sets: [
            { id: 'a', type: 'normal', weight: 135, reps: 8, rpe: null, done: true, target: t0 },
            { id: 'b', type: 'warmup', weight: 95, reps: 10, rpe: null, done: true },
          ],
        },
      ],
    } as unknown as Workout;
    const t = templateFromWorkout(w, 'Push', 42);
    expect(t).toMatchObject({ name: 'Push', createdAt: 42, exercises: [{ exerciseId: 'bench', notes: 'pause', superset: 's' }] });
    expect(t.exercises[0].sets[0]).toBe(t0);
    expect(t.exercises[0].sets[1]).toMatchObject({ type: 'warmup', target: { kind: 'reps', reps: 10 }, intensity: { kind: 'none' } });
  });
});
