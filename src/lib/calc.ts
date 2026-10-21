import type { Intensity, LoggedSet, RepTarget, SetTarget, SetType, Unit, Workout } from './types';

let counter = 0;
export function uid(): string {
  counter = (counter + 1) % 1e6;
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + counter.toString(36);
}

/** Estimated one-rep max (Epley), counting reps in reserve when an RPE is logged. */
export function e1rm(weight: number, reps: number, rpe?: number | null): number {
  if (!weight || !reps || reps < 1) return 0;
  const rir = rpe != null && rpe >= 5 ? Math.max(0, 10 - rpe) : 0;
  const total = reps + rir;
  if (total === 1) return weight;
  return weight * (1 + total / 30);
}

/** Weight that `reps` reps can be done at, given a one-rep max (inverse Epley). */
export function weightForReps(oneRm: number, reps: number): number {
  if (reps <= 1) return oneRm;
  return oneRm / (1 + reps / 30);
}

export function roundTo(value: number, step: number): number {
  if (!step) return value;
  return Math.round(value / step) * step;
}

export function fmtNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}

export function fmtWeight(n: number | null | undefined, unit: Unit): string {
  if (n == null) return '—';
  return `${fmtNum(n)} ${unit}`;
}

/**
 * One set, written the same everywhere (the Previous-column style): "135lb × 8", "BW × 12" for a
 * set without weight, "45s" / "20lb × 45s" for timed sets.
 */
export function fmtSet(s: { weight?: number | null; reps?: number | null; seconds?: number | null }, unit: Unit, timed = !!s.seconds): string {
  const r = timed ? `${s.seconds ?? 0}s` : `${s.reps ?? 0}`;
  if (s.weight != null) return `${fmtNum(s.weight)}${unit} × ${r}`;
  return timed ? r : `BW × ${r}`;
}

export function fmtVolume(n: number): string {
  if (n >= 1_000_000) return `${fmtNum(Math.round(n / 100_000) / 10)}m`;
  if (n >= 10_000) return `${fmtNum(Math.round(n / 100) / 10)}k`;
  return Math.round(n).toLocaleString('en-US');
}

export function fmtDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function fmtDurationShort(ms: number): string {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function fmtTarget(t: RepTarget): string {
  switch (t.kind) {
    case 'reps':
      return `${t.reps}`;
    case 'range':
      return `${t.min}–${t.max}`;
    case 'amrap':
      return t.min ? `${t.min}+` : 'AMRAP';
    case 'time':
      return `${t.seconds}s`;
    case 'timeRange':
      return `${t.min}–${t.max}s`;
  }
}

export function fmtTargetLong(t: RepTarget): string {
  switch (t.kind) {
    case 'reps':
      return `${t.reps} reps`;
    case 'range':
      return `${t.min}–${t.max} reps`;
    case 'amrap':
      return t.min ? `${t.min}+ reps` : 'AMRAP';
    case 'time':
      return `${t.seconds} sec`;
    case 'timeRange':
      return `${t.min}–${t.max} sec`;
  }
}

export function fmtIntensity(i: Intensity): string {
  switch (i.kind) {
    case 'none':
      return '';
    case 'rpe':
      return `@${fmtNum(i.rpe)}`;
    case 'rpeRange':
      return `@${fmtNum(i.min)}–${fmtNum(i.max)}`;
    case 'pct':
      return `${fmtNum(i.pct)}%`;
  }
}

export function fmtIntensityLong(i: Intensity): string {
  switch (i.kind) {
    case 'none':
      return '';
    case 'rpe':
      return `RPE ${fmtNum(i.rpe)}`;
    case 'rpeRange':
      return `RPE ${fmtNum(i.min)}–${fmtNum(i.max)}`;
    case 'pct':
      return `${fmtNum(i.pct)}% of 1RM`;
  }
}

export const SET_TYPE_LETTER: Record<SetType, string> = { normal: '', warmup: 'W', drop: 'D', failure: 'F' };

export function isWorkingSet(s: { type: SetType }): boolean {
  return s.type !== 'warmup';
}

export function setVolume(s: Pick<LoggedSet, 'weight' | 'reps' | 'done' | 'type'>): number {
  if (!s.done || s.type === 'warmup') return 0;
  return (s.weight ?? 0) * (s.reps ?? 0);
}

export function workoutVolume(w: Workout): number {
  let v = 0;
  for (const e of w.exercises) for (const s of e.sets) v += setVolume(s);
  return v;
}

export function workoutDurationMs(w: Workout, now = Date.now()): number {
  const end = w.endedAt ?? (w.pausedAt ?? now);
  return Math.max(0, end - w.startedAt - (w.pausedMs ?? 0));
}

export function completedSetCount(w: Workout): number {
  let n = 0;
  for (const e of w.exercises) for (const s of e.sets) if (s.done) n++;
  return n;
}

export const KG_PER_LB = 0.45359237;

export function convertWeight(n: number, from: Unit, to: Unit): number {
  if (from === to) return n;
  return from === 'lb' ? n * KG_PER_LB : n / KG_PER_LB;
}

export type PlateResult = { perSide: number[]; achieved: number; remainder: number };

/** Greedy plate loading for a target weight. */
export function calcPlates(target: number, bar: number, plates: number[]): PlateResult {
  const sorted = [...plates].sort((a, b) => b - a);
  let side = (target - bar) / 2;
  const perSide: number[] = [];
  if (side <= 0) return { perSide, achieved: bar, remainder: Math.max(0, target - bar) };
  for (const p of sorted) {
    while (side + 1e-9 >= p) {
      perSide.push(p);
      side -= p;
    }
  }
  const achieved = bar + 2 * perSide.reduce((a, b) => a + b, 0);
  return { perSide, achieved, remainder: Math.round((target - achieved) * 100) / 100 };
}

export function newSetTarget(partial: Partial<SetTarget> = {}): SetTarget {
  return {
    id: uid(),
    type: 'normal',
    target: { kind: 'range', min: 8, max: 12 },
    intensity: { kind: 'none' },
    ...partial,
  };
}

export const RPE_LABELS: Record<string, string> = {
  '6': 'Moderate',
  '6.5': 'Moderate',
  '7': 'Vigorous',
  '7.5': 'Vigorous',
  '8': 'Hard',
  '8.5': 'Hard',
  '9': 'Very Hard',
  '9.5': 'Very Hard',
  '10': 'Max Effort',
};

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Monday 00:00 of the week containing `t`. */
export function startOfWeek(t: number): number {
  const d = new Date(startOfDay(t));
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

export function fmtDate(t: number, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  return new Date(t).toLocaleDateString('en-US', opts);
}

export function parseNum(text: string): number | null {
  const t = text.replace(',', '.').trim();
  if (t === '' || t === '.' || t === '-') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** The set a lifter would call their best: highest estimated 1RM, ignoring warm-ups. */
export function bestSet<S extends { type: SetType; weight: number | null; reps: number | null; seconds?: number | null }>(sets: S[]): S | undefined {
  const working = sets.filter((s) => s.type !== 'warmup');
  const score = (s: S) => (s.weight && s.reps ? e1rm(s.weight, s.reps) : (s.reps ?? s.seconds ?? 0) / 1000);
  return [...working].sort((a, b) => score(b) - score(a))[0];
}

/**
 * The label in a set's "Set" column, everywhere sets are listed: W / D / F for special
 * sets, and 1, 2, 3… counting only normal sets (so a warm-up doesn't make the first
 * working set "2").
 */
export function setLabels(sets: { type: SetType }[]): string[] {
  let n = 0;
  return sets.map((s) => (s.type === 'normal' ? String(++n) : SET_TYPE_LETTER[s.type]));
}

/**
 * Deep copy of plain app data (programs, workouts). Not `structuredClone`: React Native's
 * Hermes engine doesn't reliably provide it, and our data is JSON-safe by construction.
 */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Labels like "SUPERSET A" for exercises sharing a superset id (groups of one get none). */
export function supersetLabels(exs: { superset?: string }[]): (string | undefined)[] {
  const letters = new Map<string, string>();
  return exs.map((e) => {
    if (!e.superset || exs.filter((x) => x.superset === e.superset).length < 2) return undefined;
    if (!letters.has(e.superset)) letters.set(e.superset, String.fromCharCode(65 + letters.size));
    return `SUPERSET ${letters.get(e.superset)}`;
  });
}

/** The tracker's TARGET column: "185lb × 5" for a % of 1RM (when known), else "5–8 reps" / "45s", plus the intensity. */
export function targetLabel(t: SetTarget | undefined, unit: Unit, oneRm: number | undefined, rounding: number): { top: string; sub: string } {
  if (!t) return { top: '—', sub: '' };
  const pctW = t.intensity.kind === 'pct' && oneRm ? roundTo((oneRm * t.intensity.pct) / 100, rounding) : null;
  const isTime = t.target.kind === 'time' || t.target.kind === 'timeRange';
  const top = pctW != null ? `${fmtNum(pctW)}${unit} × ${fmtTarget(t.target)}` : `${fmtTarget(t.target)}${isTime ? '' : ' reps'}`;
  return { top, sub: fmtIntensityLong(t.intensity) };
}

