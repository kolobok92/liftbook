#!/usr/bin/env node
// Local native-UI loop: a release APK (embedded JS, no dev menu, same as the iOS CI app) on an
// Android emulator, running the .maestro flows. No CI minutes. iOS CI (ios-simulator.yml, manual)
// stays the final gate.
//
// While fixing, run ONE flow; the full suite is the pre-commit gate. Measured on this machine
// (software-GPU emulator): full Gradle build + install ~2 min, JS-only swap ~25 s, each flow
// 0.5–1.5 min (a failing assert waits ~17 s first), full suite ~9 min.
//
//   node scripts/maestro-android.mjs .maestro/01-log-and-repeat.yaml  # one flow (while iterating)
//   node scripts/maestro-android.mjs                                  # all flows (before commit)
//   SKIP_BUILD=1 …      reuse the installed APK (YAML-only changes)
//   FULL_BUILD=1 …      force the Gradle build
//   UPDATE_BASELINES=1 … accept new element screenshots
//
// Build step, picked automatically: if the native key (Expo fingerprint + the asset file list) is
// the one the last Gradle build saved, only the JS is rebuilt (Metro + hermesc) and swapped into
// that APK, then re-signed. Otherwise Gradle builds the APK and saves it as the new base.
//
// Not an npm script on purpose: package.json scripts feed the iOS native fingerprint (cache key).
// Setup (once): see AGENTS.md "Native checks". The first build takes several minutes.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const SDK = process.env.ANDROID_HOME || 'C:\\dev\\android-sdk';
const win = process.platform === 'win32';
const exe = (dir, name) => join(SDK, dir, win ? `${name}.exe` : name);
const ADB = exe('platform-tools', 'adb');
const EMULATOR = exe('emulator', 'emulator');
const AVD = 'liftbook';
const APK = 'app/build/outputs/apk/release/app-release.apk';

const adb = (...args) => execFileSync(ADB, args, { encoding: 'utf8' }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const lap = (what) => console.log(`${what} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
// Test build: the bundle (Gradle's or the JS swap) enables the liftbook://e2e-seed scenarios the
// flows start from (src/lib/e2eScenarios.ts). Never set for the app that goes on a phone.
process.env.EXPO_PUBLIC_E2E = '1';
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: win, ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

async function bootEmulator() {
  if (adb('devices').includes('\tdevice')) return;
  // A hard-killed emulator leaves lock files (the next start refuses: "multiple emulators with
  // the same AVD") and possibly a broken Quick Boot snapshot, so clear locks and cold-boot.
  // Headless + software GPU: host-GPU rendering crashed intermittently (then hung on a hidden
  // crash-report dialog), and software rendering keeps screenshots deterministic.
  const avdDir = join(process.env.USERPROFILE || process.env.HOME, '.android', 'avd', `${AVD}.avd`);
  for (const lock of ['multiinstance.lock', 'hardware-qemu.ini.lock']) rmSync(join(avdDir, lock), { recursive: true, force: true });
  const logFile = join('.cache', 'emulator.log');
  const log = openSync(logFile, 'w');
  spawn(EMULATOR, ['-avd', AVD, '-no-snapshot-load', '-no-snapshot-save', '-no-boot-anim', '-no-window', '-gpu', 'swiftshader_indirect', '-no-metrics'], {
    detached: true,
    stdio: ['ignore', log, log],
    env: { ...process.env, ANDROID_EMU_ENABLE_CRASH_REPORTING: '0' },
  }).unref();
  const deadline = Date.now() + 180_000;
  const booted = () => {
    try {
      return execFileSync(ADB, ['shell', 'getprop', 'sys.boot_completed'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim() === '1';
    } catch {
      return false; // not attached yet
    }
  };
  while (!booted()) {
    if (Date.now() > deadline) {
      console.error(`Emulator didn't boot in 3 min. Last lines of ${logFile}:\n${readFileSync(logFile, 'utf8').split('\n').slice(-15).join('\n')}`);
      process.exit(1);
    }
    await sleep(2000);
  }
  // Animations make taps land mid-transition; turn them off like device farms do.
  for (const k of ['window_animation_scale', 'transition_animation_scale', 'animator_duration_scale']) adb('shell', 'settings', 'put', 'global', k, '0');
}

// Windows MAX_PATH (260): C++ object paths embed the absolute source path, and
// node_modules/react-native-gesture-handler's are too long under C:\dev\liftbook. Build from a
// short mirror instead (only the inputs the native build reads; node_modules installed once per
// lockfile). Elsewhere, build in place.
const ROOT = win ? 'C:\\lb' : '.';
const MIRROR = ['src', 'assets', 'plugins']; // everything app.json and the bundle reference
const MIRROR_FILES = ['app.json', 'package.json', 'package-lock.json', 'tsconfig.json'];

function syncMirror() {
  mkdirSync(ROOT, { recursive: true });
  for (const d of MIRROR) spawnSync('robocopy', [d, join(ROOT, d), '/MIR', '/NFL', '/NDL', '/NJH', '/NJS', '/NP'], { stdio: 'inherit' }); // exit codes < 8 = success
  for (const file of MIRROR_FILES) copyFileSync(file, join(ROOT, file));
  const stamp = join(ROOT, 'node_modules', '.lock-copy');
  const lock = readFileSync('package-lock.json', 'utf8');
  if (!existsSync(stamp) || readFileSync(stamp, 'utf8') !== lock) {
    console.log(`Installing node_modules in ${ROOT}…`);
    run('npm', ['ci', '--no-audit', '--no-fund'], { cwd: ROOT });
    writeFileSync(stamp, lock);
  }
}

// What the APK's native side depends on. JS changes don't alter it; native modules, config
// plugins, app.json and assets (bundled images become Android resources) do.
function nativeKey() {
  const out = execFileSync('npx', ['fingerprint', 'fingerprint:generate', '--platform', 'android'], { encoding: 'utf8', shell: win, stdio: ['ignore', 'pipe', 'ignore'] });
  const files = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else files.push(`${relative('.', p)}:${statSync(p).size}`);
    }
  };
  walk('assets');
  return createHash('sha1').update(JSON.parse(out).hash).update(files.sort().join('\n')).digest('hex');
}

const BASE_APK = join('.cache', 'android-base.apk');
const BASE_KEY = join('.cache', 'android-base.key');
const tool = (name) => join(SDK, 'build-tools', readdirSync(join(SDK, 'build-tools')).sort().at(-1), win ? `${name}${name === 'apksigner' ? '.bat' : '.exe'}` : name);

/** Rebuild only the JS: Metro bundle → Hermes bytecode → into the base APK → align + sign. */
function swapJs(out) {
  const work = join('.cache', 'fastjs');
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  const js = join(work, 'index.android.bundle.js');
  run('npx', ['expo', 'export:embed', '--platform', 'android', '--dev', 'false', '--entry-file', 'node_modules/expo-router/entry.js', '--bundle-output', join(process.cwd(), js), '--assets-dest', join(process.cwd(), work, 'res')], { cwd: ROOT });
  const hermesc = join(ROOT, 'node_modules', 'hermes-compiler', 'hermesc', win ? 'win64-bin' : process.platform === 'darwin' ? 'osx-bin' : 'linux64-bin', win ? 'hermesc.exe' : 'hermesc');
  const hbc = join(work, 'index.android.bundle');
  run(hermesc, ['-emit-binary', '-O', '-max-diagnostic-width=80', `-out=${hbc}`, js], { shell: false });
  // Same entry, stored uncompressed like Gradle does; then zipalign and the debug key Gradle signs with.
  const unsigned = join(work, 'unsigned.apk');
  run(win ? 'python' : 'python3', ['-c', `
import sys, zipfile
src, bundle, dst = sys.argv[1:]
with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst, 'w') as zout:
    for i in zin.infolist():
        if i.filename.startswith('META-INF/'): continue
        data = open(bundle, 'rb').read() if i.filename == 'assets/index.android.bundle' else zin.read(i)
        zout.writestr(i, data)
`, BASE_APK, hbc, unsigned], { shell: false });
  run(tool('zipalign'), ['-f', '-p', '4', unsigned, out], { shell: false });
  run(tool('apksigner'), ['sign', '--ks', join(ROOT, 'android', 'app', 'debug.keystore'), '--ks-pass', 'pass:android', '--ks-key-alias', 'androiddebugkey', '--key-pass', 'pass:android', out]);
}

const booting = bootEmulator(); // boot in parallel with the build
const androidDir = join(ROOT, 'android');
let apkPath = join(androidDir, APK);
if (!process.env.SKIP_BUILD) {
  if (win) syncMirror();
  const key = nativeKey();
  const fast = !process.env.FULL_BUILD && existsSync(BASE_APK) && existsSync(BASE_KEY) && readFileSync(BASE_KEY, 'utf8') === key;
  if (fast) {
    apkPath = join('.cache', 'fastjs.apk');
    swapJs(apkPath);
    lap('Swapped JS into the base APK (native key unchanged)');
  } else {
    console.log(process.env.FULL_BUILD ? 'FULL_BUILD=1: Gradle build' : 'Native key changed (or no base APK): Gradle build');
    buildApk();
    copyFileSync(apkPath, BASE_APK);
    writeFileSync(BASE_KEY, key);
  }
}

function buildApk() {
  if (!existsSync(androidDir)) run('npx', ['expo', 'prebuild', '-p', 'android', '--no-install'], { cwd: ROOT });
  // The mirror alone isn't short enough: also stage CMake builds in a short root.
  const gradle = join(androidDir, 'app/build.gradle');
  if (win && !readFileSync(gradle, 'utf8').includes('buildStagingDirectory')) {
    appendFileSync(gradle, '\nandroid.externalNativeBuild.cmake.buildStagingDirectory = file("C:/x")\n');
  }
  // x86_64 only: the emulator's ABI; building all four ABIs quadruples native compile time.
  run(win ? join(androidDir, 'gradlew.bat') : './gradlew', ['assembleRelease', '-PreactNativeArchitectures=x86_64', '--console=plain', '-q'], { cwd: androidDir });
  lap('Built APK');
}
await booting;
lap('Emulator ready');
const pkg = readFileSync(join(androidDir, 'app/build.gradle'), 'utf8').match(/applicationId ['"]([^'"]+)['"]/)?.[1];
if (!process.env.SKIP_BUILD) {
  adb('install', '-r', apkPath);
  lap(`Installed ${pkg}`);
}

const flows = process.argv.slice(2);
const maestro = spawn(
  win ? 'maestro.bat' : 'maestro',
  ['test', ...(flows.length ? flows : ['.maestro/']), '--exclude-tags=ios-only', '-e', `APP_ID=${pkg}`, '--test-output-dir=.cache/maestro'],
  { stdio: 'inherit', shell: win },
);
maestro.on('exit', (code) => {
  lap(code ? 'Flows FAILED' : 'Flows passed');
  // Visual baselines for the cropped element screenshots (scripts/compare-baselines.mjs).
  const runs = readdirSync('.cache/maestro').filter((d) => /^\d{4}-/.test(d)).sort();
  const visual = spawnSync(process.execPath, ['scripts/compare-baselines.mjs', join('.cache/maestro', runs.at(-1)), 'android', ...(process.env.UPDATE_BASELINES ? ['--update'] : [])], {
    stdio: 'inherit',
  });
  process.exit(code || visual.status || 0);
});
