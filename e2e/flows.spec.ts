import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { edgeViolations, expect, openWith, pplua, test, tid, workout, typeSet } from './helpers';

/**
 * Filmstrips: each flow screenshots every step, then tiles them into one labelled image
 * per flow in e2e-flows/ for frame-by-frame review. Run with `npm run flows`.
 */
const OUT = 'e2e-flows';

const lastWeek = [
  workout({
    name: 'Push',
    daysAgo: 7,
    programRef: pplua(0),
    exercises: [
      { exerciseId: 'lateral-raise-cable', notes: 'Lean away from the stack', sets: [{ weight: 20, reps: 12 }, { weight: 20, reps: 12 }, { weight: 22.5, reps: 10 }, { weight: 22.5, reps: 9, rpe: 9.5 }] },
      { exerciseId: 'incline-chest-press-machine', sets: [{ weight: 90, reps: 12, type: 'warmup' }, { weight: 170, reps: 8 }, { weight: 180, reps: 6 }, { weight: 160, reps: 9, type: 'drop' }] },
      { exerciseId: 'seated-military-press-barbell', sets: [{ weight: 95, reps: 10 }, { weight: 95, reps: 9 }, { weight: 95, reps: 8 }] },
    ],
  }),
];

class Strip {
  frames: { label: string; png: Buffer }[] = [];
  problems: string[] = [];
  constructor(
    private page: Page,
    private name: string,
  ) {}
  async shot(label: string) {
    await this.page.waitForTimeout(350); // let sheets/transitions settle
    this.frames.push({ label, png: await this.page.screenshot() });
    for (const v of await edgeViolations(this.page)) this.problems.push(`${this.frames.length}. ${label}: ${v}`);
  }
  /** Tile frames 4 per row with captions, via a throwaway page. */
  async save() {
    mkdirSync(OUT, { recursive: true });
    const cells = this.frames
      .map(
        (f, i) =>
          `<figure><img src="data:image/png;base64,${f.png.toString('base64')}"/><figcaption>${i + 1}. ${f.label}</figcaption></figure>`,
      )
      .join('');
    const html = `<html><body style="margin:0;background:#000;font:600 22px system-ui;color:#fff">
      <div style="display:grid;grid-template-columns:repeat(4,390px);gap:12px;padding:12px">${cells}</div>
      <style>figure{margin:0}img{width:390px;display:block;border:1px solid #444}figcaption{padding:6px 2px}</style></body></html>`;
    const viewer = await this.page.context().browser()!.newPage({ viewport: { width: 4 * 390 + 60, height: 800 }, deviceScaleFactor: 1 });
    await viewer.setContent(html);
    await viewer.screenshot({ path: `${OUT}/${this.name}.png`, fullPage: true });
    await viewer.close();
    writeFileSync(`${OUT}/${this.name}.txt`, this.frames.map((f, i) => `${i + 1}. ${f.label}`).join('\n'));
    expect(this.problems, 'text/buttons clipped by or crowding the screen edge').toEqual([]);
  }
}

test.describe('flows @flows', () => {
  test.use({ deviceScaleFactor: 1 });

  test('1-log-push-day', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    const s = new Strip(page, '1-log-push-day');
    await openWith(page, { history: lastWeek });
    await s.shot('Home: Push up next');
    await tid(page, 'start-next-workout').click();
    await s.shot('Workout opens: Previous + hints');
    await tid(page, 'weight-0-0').click();
    await s.shot('Tap set 1: keypad opens, hints stay');
    await typeSet(page, 'weight-0-0', '22.5');
    await tid(page, 'check-0-0').click();
    await s.shot('Check set 1: set 2 hints the new weight');
    await tid(page, 'check-0-1').click();
    await tid(page, 'check-0-2').click();
    await tid(page, 'set-type-0-3').click();
    await s.shot('Set 4 menu');
    await tid(page, 'set-rpe').click();
    await s.shot('RPE keypad');
    await tid(page, 'rpe-9').click();
    await tid(page, 'check-0-3').click();
    await s.shot('Exercise done: collapses');
    await tid(page, 'complete-all-1').click();
    await s.shot('Complete all on exercise 2');
    await tid(page, 'finish-workout').click();
    await s.shot('Summary with PRs');
    await tid(page, 'summary-done').click();
    await s.shot('Home: Pull up next');
    await s.save();
  });

  test('2-mid-workout-changes', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    const s = new Strip(page, '2-mid-workout-changes');
    await openWith(page, { history: lastWeek });
    await tid(page, 'start-next-workout').click();
    await tid(page, 'exercise-menu-0').click();
    await s.shot('Exercise ••• menu');
    await tid(page, 'menu-note').click();
    await tid(page, 'note-input').fill('Cable at hip height, slow negatives');
    await s.shot('Note popup');
    await tid(page, 'note-ok').click();
    await s.shot('Note added');
    await tid(page, 'swap-1').click();
    await tid(page, 'exercise-search').fill('incline dumbbell');
    await s.shot('Swap: picker');
    await tid(page, 'pick-incline-bench-press-dumbbell').click();
    await s.shot('Swapped exercise 2');
    await tid(page, 'open-reorder').click();
    await s.shot('Reorder sheet');
    await tid(page, 'reorder-top-2').click();
    await page.getByRole('button', { name: 'Done' }).click();
    await s.shot('After reorder');
    await tid(page, 'add-set-0').click();
    await s.shot('Added a set');
    await tid(page, 'minimize-workout').click();
    await s.shot('Minimized: resume bar');
    await tid(page, 'active-workout-bar').click();
    await tid(page, 'check-0-0').click();
    await tid(page, 'finish-workout').click();
    await s.shot('Finish: offer to update program');
    await page.locator('[data-testid^="change-item-"]').first().click();
    await s.shot('Unchecked one change');
    await tid(page, 'apply-program').click();
    await s.shot('Program updated');
    await s.save();
  });

  test('3-build-and-edit-program', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    const s = new Strip(page, '3-build-and-edit-program');
    await openWith(page);
    await page.getByText('Programs', { exact: true }).last().click();
    await s.shot('Programs');
    await tid(page, 'program-card-pplua').click();
    await s.shot('PPLUA detail');
    await tid(page, 'edit-program').click();
    await s.shot('Builder');
    await tid(page, 'builder-set-0-0').first().click();
    await s.shot('Set target sheet');
    await tid(page, 'target-kind-reps').click();
    await tid(page, 'target-a').fill('10');
    await tid(page, 'target-apply-all').click();
    await s.shot('Targets changed');
    await tid(page, 'builder-add-exercise-0').click();
    await tid(page, 'exercise-search').fill('face pull');
    await tid(page, 'pick-face-pull-cable').click();
    await tid(page, 'picker-add').click();
    await s.shot('Exercise added');
    await tid(page, 'save-program').click();
    await s.shot('Saved');
    await s.save();
  });

  test('4-review-history-and-records', async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    const s = new Strip(page, '4-review-history-and-records');
    await openWith(page, { history: lastWeek });
    await page.getByText('History', { exact: true }).last().click();
    await s.shot('History');
    await tid(page, `history-card-${lastWeek[0].id}`).click();
    await s.shot('Workout detail');
    await tid(page, 'edit-workout').click();
    await s.shot('Editing');
    await tid(page, 'save-workout-edit').click();
    await page.goBack();
    await page.getByText('Analytics', { exact: true }).last().click();
    await s.shot('Analytics');
    await tid(page, 'open-exercises').click();
    await s.shot('Exercise library');
    await page.getByText('Incline Chest Press (Machine)', { exact: true }).filter({ visible: true }).first().click();
    await s.shot('Records');
    await page.getByText('Chart', { exact: true }).click();
    await s.shot('Chart');
    await page.getByText('History', { exact: true }).filter({ visible: true }).first().click();
    await s.shot('Exercise history');
    await page.goBack();
    await tid(page, 'exercise-search').fill('zercher');
    await page.getByText(/^Zercher Squats?$/).filter({ visible: true }).first().click();
    await tid(page, 'how-to').locator('img').first().waitFor();
    await page.waitForTimeout(1500); // let the photos load
    await s.shot('Library exercise: About');
    await s.save();
  });
});

// Keep the reader import used if a future flow needs to embed a saved image.
void readFileSync;
