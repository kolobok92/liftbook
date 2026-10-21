import { test as base, expect, type Page } from '@playwright/test';

/**
 * `test` that fails if the app logs a console error or throws, so regressions like
 * React warnings and render loops surface without anyone watching the screen.
 */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text().slice(0, 500));
      });
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      await use(errors);
      expect(errors, 'console errors during test').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

type SetSeed = { weight: number | null; reps: number | null; type?: 'normal' | 'warmup' | 'drop' | 'failure'; rpe?: number | null };
type ExerciseSeed = { exerciseId: string; sets: SetSeed[]; notes?: string };
type WorkoutSeed = { name: string; daysAgo: number; exercises: ExerciseSeed[]; programRef?: { programId: string; week: number; day: number } };

let n = 0;
const id = () => `seed${++n}`;

/** Builds a finished workout in the app's stored shape. */
export function workout(w: WorkoutSeed) {
  const startedAt = Date.now() - w.daysAgo * 86_400_000;
  return {
    id: id(),
    name: w.name,
    notes: '',
    startedAt,
    endedAt: startedAt + 3_600_000,
    pausedMs: 0,
    unit: 'lb',
    programRef: w.programRef,
    exercises: w.exercises.map((e) => ({
      id: id(),
      exerciseId: e.exerciseId,
      notes: e.notes ?? '',
      sets: e.sets.map((s) => ({ id: id(), type: s.type ?? 'normal', weight: s.weight, reps: s.reps, rpe: s.rpe ?? null, done: true })),
    })),
  };
}

/** Load the app with a persisted state (merged over the defaults, so programs stay seeded). */
export async function openWith(page: Page, state: Record<string, unknown> = {}) {
  await page.addInitScript((s) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.clear();
      if (Object.keys(s).length) localStorage.setItem('liftbook-v1', JSON.stringify({ state: s, version: 0 }));
      sessionStorage.setItem('seeded', '1');
    }
  }, state);
  await page.goto('/');
  await expect(page.getByText('Today', { exact: true })).toBeVisible({ timeout: 30_000 });
}

/** Persisted app state. Flushes the app's debounced writes first so reads are deterministic. */
export async function stored(page: Page) {
  return page.evaluate(async () => {
    await (window as unknown as { __flushStorage?: () => Promise<void> }).__flushStorage?.();
    return JSON.parse(localStorage.getItem('liftbook-v1') || '{}').state;
  });
}

/** Native confirm()/alert() → accept. */
export function acceptDialogs(page: Page) {
  page.on('dialog', (d) => d.accept());
}

export const tid = (page: Page, testId: string) => page.getByTestId(testId);

/** A set field's shown value (white) or hint (grey); '' when it shows the other or nothing. */
async function fieldPart(page: Page, testId: string, part: 'value' | 'hint') {
  await tid(page, testId).waitFor(); // the screen has rendered the field
  const el = tid(page, `${testId}-${part}`);
  return (await el.count()) ? (await el.innerText()).trim() : '';
}

export async function setRow(page: Page, ex: number, i: number) {
  return {
    weight: await fieldPart(page, `weight-${ex}-${i}`, 'value'),
    weightHint: await fieldPart(page, `weight-${ex}-${i}`, 'hint'),
    reps: await fieldPart(page, `reps-${ex}-${i}`, 'value'),
    repsHint: await fieldPart(page, `reps-${ex}-${i}`, 'hint'),
    previous: (await tid(page, `prev-${ex}-${i}`).innerText()).replace(/\s+/g, ' ').trim(),
  };
}

/** Type a number into a set field: tap it (opens the in-app keypad), then type on the keyboard. */
export async function typeSet(page: Page, testId: string, text: string) {
  await tid(page, testId).click();
  await expect(tid(page, 'keypad')).toBeVisible();
  await page.keyboard.type(text);
}

/** Program-day slot ref for the seeded PPLUA program. */
export const pplua = (day: number, week = 0) => ({ programId: 'pplua', week, day });

/**
 * Fails if an IconLine's icon isn't vertically centered on the first line of its text
 * (within `tolerance` px). Measures the rendered glyph and the text's computed line height,
 * so it catches the "icon sits a line low" class of layout bug without eyeballing screenshots.
 */
export async function expectIconAligned(page: Page, testId: string, tolerance = 2) {
  await page.getByTestId(`${testId}-icon`).first().waitFor();
  const m = await page.evaluate((id) => {
    const iconBox = document.querySelector(`[data-testid="${id}-icon"]`);
    const glyph = iconBox?.querySelector('div[dir="auto"], span, svg') ?? iconBox;
    const host = document.querySelector(`[data-testid="${id}"]:not([data-testid$="-icon"])`);
    const text = host?.matches('textarea, input') ? host : host?.querySelector('textarea, input, div[dir="auto"]:not([data-testid$="-icon"] *)');
    if (!glyph || !text) return null;
    const g = glyph.getBoundingClientRect();
    const t = text.getBoundingClientRect();
    const lh = parseFloat(getComputedStyle(text).lineHeight) || parseFloat(getComputedStyle(text).fontSize) * 1.2;
    return { iconCenter: g.top + g.height / 2, firstLineCenter: t.top + lh / 2 };
  }, testId);
  expect(m, `elements for ${testId}`).not.toBeNull();
  expect(Math.abs(m!.iconCenter - m!.firstLineCenter), `${testId}: icon vs first text line (px)`).toBeLessThanOrEqual(tolerance);
}

/**
 * Visible text and buttons that are clipped by, or crowd, the left/right screen edge.
 * Catches header buttons with no padding ("Cancel" flush against the edge) and overflow.
 * Horizontally scrollable rows (chips) are exempt: running off the edge is their design.
 */
export async function edgeViolations(page: Page, margin = 8): Promise<string[]> {
  return page.evaluate((m) => {
    const vw = window.innerWidth;
    const out: string[] = [];
    const inHScroll = (el: Element) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const s = getComputedStyle(p);
        if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && p.scrollWidth > p.clientWidth) return true;
      }
      return false;
    };
    const hidden = (el: Element) => {
      for (let p: Element | null = el; p; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return true;
      }
      return false;
    };
    const els = document.querySelectorAll('[role="button"] div[dir="auto"], [role="heading"], div[dir="auto"]');
    for (const el of els) {
      if (!el.textContent?.trim() || el.children.length > 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > window.innerHeight) continue;
      if (hidden(el) || inHScroll(el)) continue;
      if (r.left < m || r.right > vw - m) out.push(`"${el.textContent.trim().slice(0, 30)}" at x=${Math.round(r.left)}..${Math.round(r.right)} (viewport ${vw})`);
    }
    return out;
  }, margin);
}
