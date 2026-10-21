import { expect, openWith, test, tid } from './helpers';

test.describe('exercise library (free-exercise-db)', () => {
  test('search the picker, add an imported exercise, read its How to', async ({ page }) => {
    await openWith(page);
    await tid(page, 'start-empty-workout').click();
    await tid(page, 'add-exercise').click();
    await tid(page, 'exercise-search').fill('zercher');
    const item = page.locator('[data-testid^="pick-fedb-"]').first();
    await expect(item).toContainText(/Zercher Squats?/);
    await item.click();
    await tid(page, 'picker-add').click();
    await expect(tid(page, 'exercise-card-0')).toContainText(/Zercher Squats?/);

    // Tapping the name opens its page; never logged → About tab with photos and steps.
    await tid(page, 'exercise-card-0').getByText(/^Zercher Squats?$/).click();
    const howTo = tid(page, 'how-to');
    await expect(howTo).toBeVisible();
    await expect(howTo.locator('img')).toHaveCount(2);
    await expect(howTo.locator('img').first()).toHaveAttribute('src', /raw\.githubusercontent\.com\/yuhonas\/free-exercise-db\/main\/exercises\//);
    const steps = howTo.locator('div[dir="auto"]').filter({ hasText: /^\d+\.$/ });
    const before = await steps.count();
    if (await tid(page, 'how-to-toggle').count()) {
      await tid(page, 'how-to-toggle').click();
      await expect.poll(() => steps.count()).toBeGreaterThan(before);
    }
  });

  test('curated exercises keep their Boostcamp-style names and borrow free-exercise-db photos', async ({ page }) => {
    await openWith(page);
    await page.getByText('Analytics', { exact: true }).last().click();
    await tid(page, 'open-exercises').click();
    await tid(page, 'exercise-search').fill('bench press barbell');
    await expect(page.getByText('Bench Press (Barbell)', { exact: true }).filter({ visible: true })).toBeVisible();
    await page.getByText('Bench Press (Barbell)', { exact: true }).filter({ visible: true }).click();
    // Never logged → About first, with the matching free-exercise-db photos.
    await expect(tid(page, 'how-to').locator('img').first()).toHaveAttribute('src', /Barbell_Bench_Press_-_Medium_Grip\/0\.jpg/);
    await page.getByText('Records', { exact: true }).click();
    await expect(page.getByText('No completed sets yet', { exact: false })).toBeVisible();
  });
});
