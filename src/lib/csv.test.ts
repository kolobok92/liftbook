import { describe, expect, it } from 'vitest';
import { exportCsv, importCsv, parseCsv } from './csv';
import { BUILTIN_BY_ID, BUILTIN_EXERCISES } from './exercises';

describe('parseCsv', () => {
  it('handles quotes, escaped quotes and newlines in fields', () => {
    expect(parseCsv('a,b\n"x, y","say ""hi""\nthere"\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"\nthere'],
    ]);
  });
});


describe('importCsv', () => {
  it('imports a Strong export', () => {
    const csv = [
      'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE',
      '2024-01-15 18:30:00,Push,1h 5m,Bench Press (Barbell),W,95,10,0,0,,,',
      '2024-01-15 18:30:00,Push,1h 5m,Bench Press (Barbell),1,185,5,0,0,,,8',
      '2024-01-15 18:30:00,Push,1h 5m,Mystery Lift,1,50,10,0,0,,,',
      '2024-01-17 18:30:00,Pull,50m,Deadlift (Barbell),1,315,5,0,0,,,',
    ].join('\n');
    const r = importCsv(csv, BUILTIN_EXERCISES, 'lb');
    expect(r.error).toBeUndefined();
    expect(r.workouts).toHaveLength(2);
    expect(r.setCount).toBe(4);
    const push = r.workouts[0];
    expect(push.name).toBe('Push');
    expect(push.exercises[0].exerciseId).toBe('bench-press-barbell');
    expect(push.exercises[0].sets.map((s) => s.type)).toEqual(['warmup', 'normal']);
    expect(push.exercises[0].sets[1].rpe).toBe(8);
    expect(push.endedAt! - push.startedAt).toBe(3900_000);
    expect(r.newExercises.map((e) => e.name)).toEqual(['Mystery Lift']);
  });

  it('imports a Hevy export and converts kg', () => {
    const csv = [
      '"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"',
      '"Legs","15 Jan 2024, 18:30","15 Jan 2024, 19:30","","Squat (Barbell)","","","0","normal","100","5","","",""',
      '"Legs","15 Jan 2024, 18:30","15 Jan 2024, 19:30","","Squat (Barbell)","","","1","dropset","80","8","","",""',
    ].join('\n');
    const r = importCsv(csv, BUILTIN_EXERCISES, 'lb');
    const sets = r.workouts[0].exercises[0].sets;
    expect(Math.round(sets[0].weight!)).toBe(220);
    expect(sets[1].type).toBe('drop');
  });

  it('round-trips its own export', () => {
    const csv = [
      'Date,Workout Name,Exercise Name,Set Order,Weight,Reps',
      '2024-02-01 10:00:00,Upper,Pull-Up,1,,8',
      '2024-02-01 10:00:00,Upper,Pull-Up,2,25,6',
    ].join('\n');
    const first = importCsv(csv, BUILTIN_EXERCISES, 'lb');
    const out = exportCsv(first.workouts, BUILTIN_BY_ID);
    const again = importCsv(out, BUILTIN_EXERCISES, 'lb');
    expect(again.workouts[0].exercises[0].sets.map((s) => [s.weight, s.reps])).toEqual([
      [null, 8],
      [25, 6],
    ]);
  });

});
