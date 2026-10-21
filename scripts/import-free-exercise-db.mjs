// Converts free-exercise-db (https://github.com/yuhonas/free-exercise-db, Unlicense) into the
// app's exercise format. Input is treated as data only.
//
//   curl -L -o .cache/free-exercise-db/exercises.json https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json
//   node scripts/import-free-exercise-db.mjs
//
// Writes src/data/free-exercises.json (small index, loaded at startup) and
// src/data/free-exercise-details.json (instructions + images, loaded on first use).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SRC = '.cache/free-exercise-db/exercises.json';
const KEEP_CATEGORIES = new Set(['strength', 'powerlifting', 'olympic weightlifting', 'strongman', 'plyometrics']);

const EQUIPMENT = {
  bands: 'band',
  barbell: 'barbell',
  'body only': 'bodyweight',
  cable: 'cable',
  dumbbell: 'dumbbell',
  'e-z curl bar': 'ezbar',
  kettlebells: 'kettlebell',
  machine: 'machine',
};

function muscle(m, name) {
  switch (m) {
    case 'abdominals':
      return 'abs';
    case 'lower back':
      return 'lowerBack';
    case 'middle back':
      return 'upperBack';
    case 'neck':
      return 'traps';
    case 'quadriceps':
      return 'quads';
    case 'shoulders':
      if (/rear|reverse fly|face pull|bent[- ]over.*(raise|fly)/i.test(name)) return 'rearDelts';
      if (/lateral|side raise|upright row/i.test(name)) return 'sideDelts';
      return 'frontDelts';
    default:
      return m; // abductors, adductors, biceps, calves, chest, forearms, glutes, hamstrings, lats, traps, triceps
  }
}

const EQUIP_PREFIX = /^(Barbell|Dumbbell|Cable|Kettlebell|Smith Machine|Machine|EZ[- ]Bar|E-Z Bar)\s+(.+)$/i;
const prettyEquip = (s) => s.replace(/^ez[- ]bar|^e-z bar/i, 'EZ Bar').replace(/^\w/, (c) => c.toUpperCase()).replace(/smith machine/i, 'Smith Machine');

/** "Barbell Bench Press - Medium Grip" → "Bench Press - Medium Grip (Barbell)" (Boostcamp style). */
function boostcampName(name) {
  const n = name.trim().replace(/\s+/g, ' ');
  if (n.includes('(')) return n;
  const m = n.match(EQUIP_PREFIX);
  return m ? `${m[2]} (${prettyEquip(m[1])})` : n;
}

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Same normalization as matchExerciseByName in src/lib/exercises.ts, to skip duplicates of curated entries.
const norm = (s) => s.toLowerCase().replace(/\b(the|a)\b/g, '').replace(/[^a-z0-9]/g, '');
const words = (s) =>
  s
    .toLowerCase()
    .replace(/[()\-–,]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');

const builtinSrc = readFileSync('src/lib/exercises.ts', 'utf8');
const builtinNames = [...builtinSrc.matchAll(/^\s*ex\('([^']+)'/gm)].map((m) => m[1]);
const taken = new Set(builtinNames.flatMap((n) => [norm(n), words(n)]));
// Which curated exercise each key belongs to: a duplicate's photos and steps go to that one.
const curatedBy = new Map(builtinNames.flatMap((n) => [[norm(n), n], [words(n), n]]));

const raw = JSON.parse(readFileSync(SRC, 'utf8'));
const index = [];
const details = {};
let skippedCategory = 0;
let skippedDuplicate = 0;
let curatedWithDetails = 0;

for (const x of raw) {
  if (!KEEP_CATEGORIES.has(x.category)) {
    skippedCategory++;
    continue;
  }
  // "Medium grip" is the default grip; "Bench Press - Medium Grip (Barbell)" is our "Bench Press (Barbell)".
  const name = boostcampName(x.name.replace(/\s*-\s*Medium[- ]Grip\b/i, ''));
  const keys = [norm(name), words(name), norm(x.name), words(x.name)];
  if (keys.some((k) => taken.has(k))) {
    skippedDuplicate++;
    const curated = keys.map((k) => curatedBy.get(k)).find(Boolean);
    const cid = curated && slugify(curated);
    if (cid && !details[cid] && x.images?.length) {
      details[cid] = { instructions: x.instructions ?? [], images: x.images, level: x.level, mechanic: x.mechanic ?? undefined };
      curatedWithDetails++;
    }
    continue;
  }
  keys.forEach((k) => taken.add(k));
  const id = `fedb-${slugify(x.id)}`;
  const primary = [...new Set((x.primaryMuscles ?? []).map((m) => muscle(m, x.name)))];
  const secondary = [...new Set((x.secondaryMuscles ?? []).map((m) => muscle(m, x.name)))].filter((m) => !primary.includes(m));
  const entry = { id, name, equipment: EQUIPMENT[x.equipment] ?? 'other', primary, secondary };
  if (x.equipment === 'body only') entry.bodyweight = true;
  if (x.force === 'static' && /plank|hold|hang|bridge|wall sit/i.test(x.name)) entry.timed = true;
  index.push(entry);
  details[id] = { instructions: x.instructions ?? [], images: x.images ?? [], level: x.level, mechanic: x.mechanic ?? undefined };
}

// Curated exercises whose free-exercise-db entry has a different name: same movement and
// equipment, photos and steps only (hand-checked; no faithful photo for e.g. Bayesian Curl).
const PHOTO_ALIASES = {
  'Lateral Raise (Cable)': 'Cable_Seated_Lateral_Raise',
  'Incline Chest Press (Machine)': 'Leverage_Incline_Chest_Press',
  'Chest Fly (Machine)': 'Butterfly',
  'Tricep Rope Push Down (Cable)': 'Triceps_Pushdown_-_Rope_Attachment',
  'Pull-Up (Assisted)': 'Band_Assisted_Pull-Up',
  'T-Bar Row': 'T-Bar_Row_with_Handle',
  'Seated Row (Cable)': 'Seated_Cable_Rows',
  'Hammer Curl (Dumbbell)': 'Hammer_Curls',
  'Leg Extension': 'Leg_Extensions',
  'Leg Curl': 'Lying_Leg_Curls',
  'Incline Bench Press (Dumbbell)': 'Incline_Dumbbell_Press',
  'Lat Pulldown (Neutral Grip)': 'V-Bar_Pulldown',
  'Rear Delt Row': 'Barbell_Rear_Delt_Row',
  'Concentration Curl': 'Concentration_Curls',
  'Overhead Tricep Extension (Cable)': 'Cable_Rope_Overhead_Triceps_Extension',
};
const byRawId = new Map(raw.map((x) => [x.id, x]));
for (const [name, rawId] of Object.entries(PHOTO_ALIASES)) {
  const x = byRawId.get(rawId);
  if (!builtinNames.includes(name)) throw new Error(`PHOTO_ALIASES: no curated exercise "${name}"`);
  if (!x?.images?.length) throw new Error(`PHOTO_ALIASES: "${rawId}" not found or has no images`);
  const cid = slugify(name);
  if (!details[cid]) {
    details[cid] = { instructions: x.instructions ?? [], images: x.images, level: x.level, mechanic: x.mechanic ?? undefined };
    curatedWithDetails++;
  }
}

index.sort((a, b) => a.name.localeCompare(b.name));
mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/free-exercises.json', JSON.stringify(index));
writeFileSync('src/data/free-exercise-details.json', JSON.stringify(details));
console.log(
  `kept ${index.length}, skipped ${skippedCategory} (stretching/cardio) + ${skippedDuplicate} (duplicates of curated; ${curatedWithDetails} curated got photos), ` +
    `index ${(JSON.stringify(index).length / 1024).toFixed(0)} KB, details ${(JSON.stringify(details).length / 1024).toFixed(0)} KB`,
);
