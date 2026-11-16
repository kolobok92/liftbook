import { describe, expect, it } from 'vitest';
import { BUILTIN_BY_ID } from './exercises';
import { programText } from './programText';
import { pplua } from './seed';
import type { Program, SetTarget } from './types';

const st = (extra: Partial<SetTarget> = {}): SetTarget => ({ id: Math.random().toString(), type: 'normal', target: { kind: 'range', min: 8, max: 12 }, intensity: { kind: 'none' }, ...extra });

describe('program as text', () => {
  it('lists every day of the built-in program with exercise names, sets and targets', () => {
    const p = pplua();
    const text = programText(p, BUILTIN_BY_ID);
    const lines = text.split('\n');
    expect(lines[0]).toBe('PPLUA (Loop, 5 days per cycle)');
    expect(text).toContain('Day 1: Push\n1. Lateral Raise (Cable): 4 × 8–12 reps, RPE 8–10\n2. Incline Chest Press (Machine): 4 × 5–8 reps, RPE 8–10');
    for (const [i, d] of p.weeks[0].days.entries()) expect(text).toContain(`Day ${i + 1}: ${d.name}`);
    // One numbered line per exercise in the program.
    expect(lines.filter((l) => /^\d+\. /.test(l))).toHaveLength(p.weeks[0].days.reduce((n, d) => n + d.exercises.length, 0));
    expect(text).not.toMatch(/undefined|\[object|: $/m);
  });

  it('mixed sets, notes, supersets, timed and % work, and periodized weeks', () => {
    const p: Program = {
      id: 'x', name: 'Strength', description: 'Heavy block', mode: 'periodized', numWeeks: 2, createdAt: 0, updatedAt: 0,
      weeks: [
        {
          id: 'w1', phase: 'Base',
          days: [{
            id: 'd1', name: 'Lower',
            exercises: [
              { id: 'a', exerciseId: 'squat-barbell', notes: ' Belt on ', superset: 'g', sets: [st({ type: 'warmup', target: { kind: 'reps', reps: 10 } }), st({ target: { kind: 'reps', reps: 5 }, intensity: { kind: 'pct', pct: 80 } }), st({ target: { kind: 'reps', reps: 5 }, intensity: { kind: 'pct', pct: 80 } }), st({ target: { kind: 'amrap', min: 5 } })] },
              { id: 'b', exerciseId: 'plank', notes: '', superset: 'g', sets: [st({ target: { kind: 'time', seconds: 45 } })] },
              { id: 'c', exerciseId: 'gone', notes: '', sets: [] },
            ],
          }],
        },
        { id: 'w2', days: [{ id: 'd2', name: 'Rest', exercises: [] }] },
      ],
    };
    expect(programText(p, BUILTIN_BY_ID)).toBe(
      [
        'Strength (2 weeks, 1 day per week)',
        'Heavy block',
        'Week 1 (Base)',
        'Day 1: Lower\n1. Squat (Barbell) [superset A]: 1 × 10 reps, warm-up; 2 × 5 reps, 80% of 1RM; 1 × 5+ reps\n   Note: Belt on\n2. Plank [superset A]: 1 × 45 sec\n3. Exercise: no sets',
        'Week 2',
        'Day 1: Rest\n(no exercises)',
      ].join('\n\n') + '\n',
    );
  });
});
