// Records a narrated-by-pace walkthrough of the app to e2e-video/. Run: node e2e/demo.mjs
// Requires the dev server on :8081 (npx expo start --web --port 8081).
import { chromium, devices } from '@playwright/test';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';

const OUT = 'e2e-video';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const day = 86_400_000;
let n = 0;
const id = () => `demo${++n}`;
const sets = (rows) => rows.map(([weight, reps, type = 'normal', rpe = null]) => ({ id: id(), type, weight, reps, rpe, done: true }));
const ex = (exerciseId, rows, notes = '') => ({ id: id(), exerciseId, notes, sets: sets(rows) });
const wk = (name, daysAgo, day_, exercises) => {
  const startedAt = Date.now() - daysAgo * day;
  return { id: id(), name, notes: '', startedAt, endedAt: startedAt + 62 * 60_000, pausedMs: 0, unit: 'lb', programRef: { programId: 'pplua', week: 0, day: day_ }, exercises };
};

// Last week's Push and Pull, so "Previous" and records have something to show.
const push = wk('Push', 7, 0, [
  ex('lateral-raise-cable', [[20, 12], [20, 12], [20, 11], [20, 10, 'normal', 9]], 'Lean away from the stack'),
  ex('incline-chest-press-machine', [[90, 12, 'warmup'], [170, 8], [170, 7], [170, 6]]),
  ex('seated-military-press-barbell', [[95, 10], [95, 9], [95, 8]]),
  ex('chest-fly-machine', [[120, 15], [120, 13], [120, 12]]),
  ex('tricep-rope-push-down-cable', [[50, 12], [50, 11], [50, 10]]),
]);
const pull = wk('Pull', 6, 1, [ex('t-bar-row', [[135, 8], [135, 8], [135, 7]]), ex('hammer-curl-dumbbell', [[35, 12], [35, 10]])]);
const state = {
  history: [push, pull],
  activeProgram: { programId: 'pplua', startedAt: 0, completed: {} },
};

const browser = await chromium.launch();
const context = await browser.newContext({
  ...devices['iPhone 13'],
  recordVideo: { dir: OUT, size: { width: 390, height: 844 } },
});
await context.addInitScript((s) => {
  if (!sessionStorage.getItem('seeded')) {
    localStorage.clear();
    localStorage.setItem('liftbook-v1', JSON.stringify({ state: s, version: 0 }));
    sessionStorage.setItem('seeded', '1');
  }
}, state);
const page = await context.newPage();
page.on('dialog', (d) => d.accept());
const t = (testId) => page.getByTestId(testId);
const wait = (ms = 900) => page.waitForTimeout(ms);
let shotN = 0;
// Stills alongside the video for a quick check of what it shows.
const still = (name) => page.screenshot({ path: `${OUT}/still-${String(++shotN).padStart(2, '0')}-${name}.png` });
const tap = async (testId, ms = 900) => {
  await t(testId).click();
  await wait(ms);
};
const slowType = async (testId, text) => {
  await t(testId).click();
  await t(testId).fill('');
  await t(testId).pressSequentially(text, { delay: 140 });
  await wait(500);
};
const scrollTo = async (testId) => {
  await t(testId).scrollIntoViewIfNeeded();
  await wait(700);
};

await page.goto('http://localhost:8081/');
await page.getByText('Today', { exact: true }).waitFor({ timeout: 60_000 });
await wait(2200); // Home: PPLUA up next

// Start Push — Previous column shows last week's numbers set by set.
await tap('start-next-workout', 2200);
await still('workout-previous');

// Tap a set → weight and reps fill in from last time; bump the weight and check it.
await t('weight-0-0').click();
await wait(1200);
await slowType('weight-0-0', '22.5');
await still('tap-to-fill');
await tap('check-0-0', 1000);

// Check untouched sets → last session's numbers are logged as-is.
await tap('check-0-1', 700);
await tap('check-0-2', 1000);

// Rate the last set with the RPE keypad.
await tap('set-type-0-3', 1200);
await tap('set-rpe', 1000);
await still('rpe');
await tap('rpe-9', 900);
await tap('prev-0-3', 700); // tap "Previous" to copy it in
await tap('check-0-3', 1200);

// Next exercise: warm-up is marked W; beat last week's top set for a PR.
await scrollTo('exercise-card-1');
await tap('check-1-0', 600);
await slowType('weight-1-1', '180');
await tap('check-1-1', 700);
await tap('complete-all-1', 1400);
await still('logged');

// Finish → summary with PRs.
await tap('finish-workout', 2800);
await still('summary');
await page.mouse.wheel(0, 400);
await wait(1500);
await tap('summary-done', 1800);

// Home now shows Day 2 up next; open History.
await page.getByText('History', { exact: true }).last().click();
await wait(1800);
await page.locator('[data-testid^="history-card-"]').filter({ visible: true }).first().click();
await wait(2200);
await page.mouse.wheel(0, 500);
await wait(1500);
await page.goBack();
await wait(800);

// Exercise records and chart.
await page.getByText('Analytics', { exact: true }).last().click();
await wait(2000);
await page.mouse.wheel(0, 700);
await wait(1800);
await tap('open-exercises', 1200);
await page.getByText('Incline Chest Press (Machine)', { exact: true }).first().click();
await wait(2200);
await page.getByText('Chart', { exact: true }).click();
await wait(2200);
await still('chart');
await page.goBack();
await page.goBack();
await wait(800);

// Program: muscle engagement + builder.
await page.getByText('Programs', { exact: true }).last().click();
await wait(1200);
await tap('program-card-pplua', 1800);
await still('program');
await page.mouse.wheel(0, 500);
await wait(1800);
await page.mouse.wheel(0, -500);
await tap('edit-program', 2200);
await page.mouse.wheel(0, 600);
await wait(1800);

await context.close(); // flushes the video
await browser.close();
const file = readdirSync(OUT).find((f) => f.endsWith('.webm'));
renameSync(`${OUT}/${file}`, `${OUT}/liftbook-demo.webm`);
console.log(`${OUT}/liftbook-demo.webm`);
