#!/usr/bin/env node
// Small square thumbnails of each exercise's first free-exercise-db photo, for places that can't
// load images from the network: the iOS Live Activity widget bundles them as assets
// (plugins/withElapsedLiveActivity.js). Re-run after import-free-exercise-db.mjs:
//
//   node scripts/build-exercise-thumbs.mjs
//
// Writes assets/exercise-thumbs/<exerciseId>.jpg (120×120, ~4 KB) and
// src/data/exercise-thumbs.json (the ids that have one). Downloads are cached in .cache/.
import { Buffer } from 'node:buffer';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const SIZE = 120;
const OUT = 'assets/exercise-thumbs';
const CACHE = '.cache/fedb-images';
const details = JSON.parse(readFileSync('src/data/free-exercise-details.json', 'utf8'));
mkdirSync(OUT, { recursive: true });
mkdirSync(CACHE, { recursive: true });

const jobs = Object.entries(details).filter(([, d]) => d.images?.length).map(([id, d]) => ({ id, path: d.images[0] }));
let done = 0;
async function one({ id, path }) {
  const cached = join(CACHE, path.replace(/[\\/]/g, '__'));
  if (!existsSync(cached)) {
    const res = await fetch(`https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${path}`);
    if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`);
    writeFileSync(cached, Buffer.from(await res.arrayBuffer()));
  }
  await sharp(cached).resize(SIZE, SIZE, { fit: 'cover', position: 'attention' }).jpeg({ quality: 72, mozjpeg: true }).toFile(join(OUT, `${id}.jpg`));
  if (++done % 100 === 0) console.log(`${done}/${jobs.length}`);
}

// A few downloads at a time.
const queue = [...jobs];
await Promise.all(Array.from({ length: 12 }, async () => {
  while (queue.length) await one(queue.shift());
}));

// Drop thumbnails for exercises that no longer have photos.
const keep = new Set(jobs.map((j) => `${j.id}.jpg`));
for (const f of readdirSync(OUT)) if (!keep.has(f)) rmSync(join(OUT, f));
writeFileSync('src/data/exercise-thumbs.json', JSON.stringify(jobs.map((j) => j.id).sort()));
const kb = readdirSync(OUT).reduce((n, f) => n + readFileSync(join(OUT, f)).length, 0) / 1024;
console.log(`${jobs.length} thumbnails, ${kb.toFixed(0)} KB total`);
