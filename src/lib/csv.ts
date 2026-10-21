import { convertWeight, uid, workoutDurationMs } from './calc';
import { matchExerciseByName, slugify } from './exercises';
import type { Exercise, LoggedSet, SetType, Unit, Workout, WorkoutExercise } from './types';

/** RFC 4180-ish parser with delimiter sniffing (comma, semicolon, tab). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const counts = { ',': 0, ';': 0, '\t': 0 } as Record<string, number>;
  let q = false;
  for (const ch of firstLine) {
    if (ch === '"') q = !q;
    else if (!q && ch in counts) counts[ch]++;
  }
  const delim = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delim) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

function csvEscape(v: string | number | null | undefined): string {
  if (v == null) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

/** Parses the date formats Strong, Hevy, Boostcamp and spreadsheets tend to export. */
export function parseDate(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  if (/^\d{10,13}$/.test(t)) return Number(t) * (t.length === 10 ? 1000 : 1);
  // "15 Jan 2024, 18:30" (Hevy)
  let m = t.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})(?:,?\s+(\d{1,2}):(\d{2}))?/);
  if (m) return new Date(+m[3], MONTHS[m[2].toLowerCase()] ?? 0, +m[1], +(m[4] ?? 12), +(m[5] ?? 0)).getTime();
  // "2024-01-15 18:30:00" / ISO
  m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(t))
    return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 12), +(m[5] ?? 0), +(m[6] ?? 0)).getTime();
  // "1/15/2024 6:30 PM" (US)
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?)?/);
  if (m) {
    let h = +(m[4] ?? 12);
    if (m[6]) h = (h % 12) + (m[6].toLowerCase() === 'pm' ? 12 : 0);
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    return new Date(y, +m[1] - 1, +m[2], h, +(m[5] ?? 0)).getTime();
  }
  const d = Date.parse(t);
  return Number.isNaN(d) ? null : d;
}

/** "1h 5m", "65m", "3900" (seconds), "01:05:00" → ms. */
export function parseDurationMs(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t) * 1000;
  const hms = t.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (hms) return hms[3] != null ? (+hms[1] * 3600 + +hms[2] * 60 + +hms[3]) * 1000 : (+hms[1] * 60 + +hms[2]) * 1000;
  const h = t.match(/(\d+)\s*h/);
  const mi = t.match(/(\d+)\s*m(?!s)/);
  const se = t.match(/(\d+)\s*s/);
  if (!h && !mi && !se) return null;
  return ((+(h?.[1] ?? 0)) * 3600 + (+(mi?.[1] ?? 0)) * 60 + +(se?.[1] ?? 0)) * 1000;
}

type Cols = {
  date: number;
  end: number;
  name: number;
  duration: number;
  exercise: number;
  setOrder: number;
  setType: number;
  weight: number;
  weightUnitCol: number;
  reps: number;
  rpe: number;
  seconds: number;
  notes: number;
  workoutNotes: number;
  weightUnit?: Unit;
};

function findCols(header: string[]): Cols {
  const h = header.map((x) => x.trim().toLowerCase());
  const find = (...names: (string | RegExp)[]) => {
    for (const n of names) {
      const i = h.findIndex((x) => (typeof n === 'string' ? x === n : n.test(x)));
      if (i >= 0) return i;
    }
    return -1;
  };
  const weight = find('weight', 'weight_lbs', 'weight_kg', /^weight\s*\((lbs?|kg)\)$/, /^weight/);
  let weightUnit: Unit | undefined;
  if (weight >= 0) {
    if (/kg/.test(h[weight])) weightUnit = 'kg';
    else if (/lb/.test(h[weight])) weightUnit = 'lb';
  }
  return {
    date: find('date', 'start_time', 'start time', 'workout date', 'started', /date/),
    end: find('end_time', 'end time'),
    name: find('workout name', 'title', 'workout', 'workout title', 'routine', 'program day'),
    duration: find('duration', 'workout duration', /^duration/),
    exercise: find('exercise name', 'exercise_title', 'exercise', 'exercise title', 'movement'),
    setOrder: find('set order', 'set_index', 'set', 'set number', 'set #'),
    setType: find('set_type', 'set type', 'type'),
    weight,
    weightUnitCol: find('weight unit', 'unit', 'units', 'weight_unit'),
    reps: find('reps', 'rep', 'repetitions'),
    rpe: find('rpe'),
    seconds: find('seconds', 'duration_seconds', 'time (s)', 'time'),
    notes: find('notes', 'exercise_notes', 'exercise notes', 'note'),
    workoutNotes: find('workout notes', 'description', 'workout_notes'),
    weightUnit,
  };
}

function setTypeFrom(typeCell: string, orderCell: string): SetType {
  const t = `${typeCell} ${orderCell}`.toLowerCase();
  if (/warm|^\s*w\b|\bw\s*$/.test(t)) return 'warmup';
  if (/drop|\bd\s*$/.test(t)) return 'drop';
  if (/fail|\bf\s*$/.test(t)) return 'failure';
  return 'normal';
}

export type ImportResult = {
  workouts: Workout[];
  newExercises: Exercise[];
  setCount: number;
  skippedRows: number;
  error?: string;
};

/**
 * Turns an exported CSV (Strong, Hevy, Boostcamp or this app's own export) into workouts.
 * Rows are grouped into workouts by date + workout name. Unknown exercises become custom ones.
 */
export function importCsv(text: string, known: Exercise[], targetUnit: Unit): ImportResult {
  const rows = parseCsv(text);
  const empty: ImportResult = { workouts: [], newExercises: [], setCount: 0, skippedRows: 0 };
  if (rows.length < 2) return { ...empty, error: 'The file has no data rows.' };
  const cols = findCols(rows[0]);
  if (cols.date < 0 || cols.exercise < 0) return { ...empty, error: 'Could not find date and exercise columns in the header.' };

  const exercises = [...known];
  const newExercises: Exercise[] = [];
  const resolve = (name: string): string => {
    const hit = matchExerciseByName(name, exercises);
    if (hit) return hit.id;
    const ex: Exercise = { id: `custom-${slugify(name)}`, name: name.trim(), equipment: 'other', primary: [], secondary: [], custom: true };
    exercises.push(ex);
    newExercises.push(ex);
    return ex.id;
  };

  const byKey = new Map<string, Workout>();
  let setCount = 0;
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const cell = (i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');
    const startedAt = parseDate(cell(cols.date));
    const exName = cell(cols.exercise);
    if (startedAt == null || !exName) {
      skipped++;
      continue;
    }
    const name = cell(cols.name) || 'Workout';
    const key = `${cell(cols.date)}|${name}`;
    let w = byKey.get(key);
    if (!w) {
      const endedFromCol = parseDate(cell(cols.end));
      const dur = parseDurationMs(cell(cols.duration));
      const endedAt = endedFromCol ?? startedAt + (dur ?? 60 * 60 * 1000);
      w = { id: uid(), name, notes: cell(cols.workoutNotes), startedAt, endedAt, pausedMs: 0, exercises: [], unit: targetUnit };
      byKey.set(key, w);
    }
    const exId = resolve(exName);
    let we: WorkoutExercise | undefined = w.exercises[w.exercises.length - 1];
    if (!we || we.exerciseId !== exId) {
      we = { id: uid(), exerciseId: exId, notes: cell(cols.notes), sets: [] };
      w.exercises.push(we);
    }
    const rowUnit: Unit = /kg/i.test(cell(cols.weightUnitCol)) ? 'kg' : /lb/i.test(cell(cols.weightUnitCol)) ? 'lb' : (cols.weightUnit ?? targetUnit);
    const rawW = cell(cols.weight) === '' ? null : Number(cell(cols.weight).replace(',', '.'));
    const weight = rawW == null || Number.isNaN(rawW) ? null : Math.round(convertWeight(rawW, rowUnit, targetUnit) * 100) / 100;
    const reps = cell(cols.reps) === '' ? null : Number(cell(cols.reps));
    const rpe = cell(cols.rpe) === '' ? null : Number(cell(cols.rpe));
    const seconds = cell(cols.seconds) === '' ? null : Number(cell(cols.seconds));
    const set: LoggedSet = {
      id: uid(),
      type: setTypeFrom(cell(cols.setType), cell(cols.setOrder)),
      weight,
      reps: reps == null || Number.isNaN(reps) ? null : reps,
      rpe: rpe == null || Number.isNaN(rpe) || rpe === 0 ? null : rpe,
      seconds: seconds == null || Number.isNaN(seconds) || seconds === 0 ? null : seconds,
      done: true,
    };
    we.sets.push(set);
    setCount++;
  }
  const workouts = [...byKey.values()].sort((a, b) => a.startedAt - b.startedAt);
  return { workouts, newExercises, setCount, skippedRows: skipped };
}

function isoLocal(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function exportCsv(history: Workout[], byId: Record<string, Exercise>): string {
  const header = ['Date', 'Workout Name', 'Duration', 'Exercise Name', 'Set Order', 'Set Type', 'Weight', 'Weight Unit', 'Reps', 'Seconds', 'RPE', 'Notes', 'Workout Notes'];
  const lines = [header.join(',')];
  const sorted = [...history].filter((w) => w.endedAt).sort((a, b) => a.startedAt - b.startedAt);
  for (const w of sorted) {
    const dur = Math.round(workoutDurationMs(w) / 1000);
    for (const e of w.exercises) {
      let n = 0;
      for (const s of e.sets) {
        if (!s.done) continue;
        n++;
        lines.push(
          [isoLocal(w.startedAt), w.name, dur, byId[e.exerciseId]?.name ?? e.exerciseId, n, s.type, s.weight, w.unit, s.reps, s.seconds, s.rpe, e.notes, w.notes]
            .map(csvEscape)
            .join(','),
        );
      }
    }
  }
  return lines.join('\n') + '\n';
}
