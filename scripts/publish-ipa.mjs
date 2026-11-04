#!/usr/bin/env node
// Phone build in one step: runs the "iOS unsigned build" workflow on main (GitHub Actions),
// waits for it, downloads the .ipa to ./Liftbook.ipa and copies it into iCloud Drive, so the
// update is installed from the phone (AltStore → My Apps → + → iCloud Drive) with no cable.
//
//   node scripts/publish-ipa.mjs            # build the pushed main, then publish
//   node scripts/publish-ipa.mjs <run id>   # publish an existing successful run
//
// Push first: the workflow builds what's on GitHub, not the working tree.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

const WORKFLOW = 'iOS unsigned build';
const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let run = process.argv[2];
if (!run) {
  const before = gh('run', 'list', '--workflow', WORKFLOW, '-L', '1', '--json', 'databaseId', '--jq', '.[0].databaseId // 0');
  gh('workflow', 'run', WORKFLOW, '--ref', 'main');
  // `workflow run` doesn't return the new run's id: wait for it to show up.
  for (let i = 0; i < 30 && (!run || run === before); i++) {
    await sleep(2000);
    run = gh('run', 'list', '--workflow', WORKFLOW, '-L', '1', '--json', 'databaseId', '--jq', '.[0].databaseId');
  }
  if (run === before) throw new Error('The workflow run did not start');
  console.log(`Building run ${run} (~10 min)…`);
  try {
    execFileSync('gh', ['run', 'watch', run, '--exit-status', '--interval', '60'], { stdio: 'ignore' });
  } catch {
    throw new Error(`Build ${run} failed: gh run view ${run} --log-failed`);
  }
}

const dir = mkdtempSync(join(tmpdir(), 'liftbook-ipa-'));
gh('run', 'download', run, '-n', 'Liftbook-unsigned-ipa', '-D', dir);
const ipa = readdirSync(dir).find((f) => f.endsWith('.ipa'));
if (!ipa) throw new Error(`No .ipa in the artifact of run ${run}`);
copyFileSync(join(dir, ipa), 'Liftbook.ipa');
rmSync(dir, { recursive: true, force: true });
console.log(`Liftbook.ipa (${(statSync('Liftbook.ipa').size / 1e6).toFixed(1)} MB) from run ${run}`);

// iCloud for Windows syncs this folder to the phone's Files → iCloud Drive.
const drive = join(homedir(), 'iCloudDrive');
if (existsSync(drive)) {
  copyFileSync('Liftbook.ipa', join(drive, 'Liftbook.ipa'));
  console.log('Copied to iCloud Drive: on the phone, AltStore → My Apps → + → iCloud Drive → Liftbook.ipa');
} else {
  console.log('No iCloud Drive folder (turn on iCloud Drive in iCloud for Windows); install ./Liftbook.ipa by cable');
}
