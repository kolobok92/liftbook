#!/usr/bin/env node
// Native visual baselines: compares the cropped element screenshots a Maestro run saved
// (takeScreenshot `el-*` with cropOn) against approved PNGs in .maestro/baselines/<platform>/.
// Catches clipped, shifted or mis-coloured UI that assertions can't see.
//
//   node scripts/compare-baselines.mjs <maestro output dir> <platform> [--update]
//
// A crop with no baseline yet is saved as one and reported for review (not a failure).
// Mismatches write <name>.diff.png next to the run's screenshot.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const [runDir, platform, flag] = process.argv.slice(2);
const update = flag === '--update';
// Differing pixels allowed, as a count (a share of the crop would dilute small glyph damage): a
// blinking caret is ~135 px; the clipped-digits bug this guards against changed ~730 px.
const MAX_PIXELS = 250;

const crops = [];
for (const flow of readdirSync(runDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  const dir = join(runDir, flow.name, 'takeScreenshot');
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((x) => /^el-.*\.png$/.test(x) && !x.endsWith('.diff.png'))) crops.push({ flow: flow.name, file: join(dir, f), name: f });
}

let failed = 0;
for (const { flow, file, name } of crops) {
  const base = join('.maestro', 'baselines', platform, flow, name);
  if (!existsSync(base) || update) {
    mkdirSync(dirname(base), { recursive: true });
    copyFileSync(file, base);
    console.log(`${update ? 'updated' : 'NEW baseline (review it)'}: ${base}`);
    continue;
  }
  const a = PNG.sync.read(readFileSync(base));
  const b = PNG.sync.read(readFileSync(file));
  if (a.width !== b.width || a.height !== b.height) {
    console.log(`✘ ${flow}/${name}: size ${b.width}×${b.height}, baseline ${a.width}×${a.height}`);
    failed++;
    continue;
  }
  const diff = new PNG({ width: a.width, height: a.height });
  const bad = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.15 });
  if (bad > MAX_PIXELS) {
    const out = file.replace(/\.png$/, '.diff.png');
    writeFileSync(out, PNG.sync.write(diff));
    console.log(`✘ ${flow}/${name}: ${bad} pixels differ (max ${MAX_PIXELS}; diff: ${out})`);
    failed++;
  } else console.log(`✓ ${flow}/${name} (${bad} px)`);
}
if (!crops.length) console.log('No el-* crops in this run.');
process.exit(failed ? 1 : 0);
