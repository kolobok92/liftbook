import { fmtIntensityLong, fmtTargetLong, supersetLabels } from './calc';
import { daysPerWeek } from './tracking';
import type { Exercise, Program, ProgramDay, ProgramExercise, SetTarget } from './types';

const TYPE_WORD = { normal: '', warmup: 'warm-up', drop: 'drop set', failure: 'to failure' } as const;

/** "4 × 8–12 reps, RPE 8–10": consecutive identical sets are counted together. */
function setsText(sets: SetTarget[]): string {
  const one = (s: SetTarget) => [fmtTargetLong(s.target), fmtIntensityLong(s.intensity), TYPE_WORD[s.type]].filter(Boolean).join(', ');
  const runs: { text: string; n: number }[] = [];
  for (const s of sets) {
    const text = one(s);
    const last = runs[runs.length - 1];
    if (last?.text === text) last.n++;
    else runs.push({ text, n: 1 });
  }
  return runs.length ? runs.map((r) => `${r.n} × ${r.text}`).join('; ') : 'no sets';
}

function dayText(day: ProgramDay, index: number, name: (e: ProgramExercise) => string): string {
  const labels = supersetLabels(day.exercises);
  const lines = day.exercises.flatMap((e, i) => [
    `${i + 1}. ${name(e)}${labels[i] ? ` [superset ${labels[i]!.slice(-1)}]` : ''}: ${setsText(e.sets)}`,
    ...(e.notes.trim() ? [`   Note: ${e.notes.trim()}`] : []),
  ]);
  return [`Day ${index + 1}: ${day.name}`, ...(lines.length ? lines : ['(no exercises)'])].join('\n');
}

/**
 * The whole program as plain text, for pasting into notes or a chat: every day with its
 * exercises, sets and targets. A periodized program lists each week; the others their one week.
 */
export function programText(p: Program, byId: Record<string, Exercise>): string {
  const name = (e: ProgramExercise) => byId[e.exerciseId]?.name ?? 'Exercise';
  const per = daysPerWeek(p);
  const n = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
  const kind = p.mode === 'loop' ? `Loop, ${n(per, 'day')} per cycle` : `${n(p.numWeeks, 'week')}, ${n(per, 'day')} per week`;
  const weeks = p.mode === 'periodized' ? p.weeks : p.weeks.slice(0, 1);
  const body = weeks.map((w, wi) => {
    const days = w.days.map((d, i) => dayText(d, i, name)).join('\n\n');
    return p.mode === 'periodized' ? `Week ${wi + 1}${w.phase ? ` (${w.phase})` : ''}\n\n${days}` : days;
  });
  return [`${p.name} (${kind})`, ...(p.description.trim() ? [p.description.trim()] : []), ...body].join('\n\n') + '\n';
}
