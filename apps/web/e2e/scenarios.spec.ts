import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PAGES = ['/', '/ballot', '/recycling', '/live', '/journey', '/how-it-works'] as const;

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

const room = (name: string) => `${name}-${Math.random().toString(36).slice(2, 8)}`;

test.describe('every page', () => {
  for (const path of PAGES) {
    test(`${path} renders cleanly and passes axe (no serious/critical issues)`, async ({
      page,
    }) => {
      const errors = collectErrors(page);
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.waitForLoadState('networkidle');
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      const serious = results.violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target.join(' ')}`);
      expect(serious).toEqual([]);
      expect(errors).toEqual([]);
    });

    test(`${path} has no horizontal overflow`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});

test('hub: the three products are one click away', async ({ page }) => {
  await page.goto('/');
  for (const [name, path] of [
    ['Losglück mit System', '/ballot'],
    ['Kein Platz bleibt leer', '/recycling'],
    ['Vom Sofa bis zum Sitz', '/journey'],
  ] as const) {
    await page.getByRole('link', { name: new RegExp(`Open ${name}`) }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await page.goBack();
  }
});

test('ballot: member compares odds, applies smart, runs and verifies a draw, reads the letter', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('/ballot');
  const odds = page.locator('#odds');
  await expect(odds.getByText('3 of 3 applications')).toBeVisible();

  // Switching to a first-time member lowers the visible odds.
  const klassiker = odds.locator('li', { hasText: 'Borussia Dortmund' });
  const lenaOdds = await klassiker.locator('.display').first().innerText();
  await page.getByRole('radio', { name: /Jonas Weber/ }).click();
  await expect(klassiker.locator('.display').first()).not.toHaveText(lenaOdds);
  await page.getByRole('radio', { name: /Lena Hofmann/ }).click();

  await page.getByRole('button', { name: 'Use smart picks' }).click();
  await expect(odds.getByText('3 of 3 applications')).toBeVisible();

  await page.getByRole('button', { name: /Publish commitment/ }).click();
  await expect(page.getByText(/Commitment published before the draw/)).toBeVisible();
  await page.getByRole('button', { name: /Run the draw/ }).click();
  await expect(page.getByText('Verify it yourself')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/You’re in|Not this time/)).toBeVisible();

  await page.getByRole('button', { name: /Verify in my browser/ }).click();
  await expect(page.getByText(/SHA-256\(seed\) matches the published commitment/)).toBeVisible();
  await expect(page.getByText(/race time −ln\(u\)\/w recomputed/)).toBeVisible();

  const letter = page.locator('section[aria-labelledby="letter-title"] article');
  await expect(letter).toContainText('Servus Lena', { timeout: 15_000 });
  await page.getByRole('radio', { name: 'EN', exact: true }).click();
  await expect(letter).toContainText(/applications competed for/, { timeout: 15_000 });
  expect(errors).toEqual([]);
});

test('recycling: forecast map, layer switch and simulation are explorable', async ({ page }) => {
  await page.goto('/recycling');
  const blocks = page.getByRole('button', { name: /^Block \d{3}/ });
  await expect(blocks).toHaveCount(116);
  await page.getByRole('button', { name: /^Block 112 ·/ }).focus();
  await expect(page.getByText(/risk · ≈\d+ empty of/)).toBeVisible();
  await page.getByRole('radio', { name: 'Seats recovered' }).click();
  await expect(page.getByText(/Brighter teal/)).toBeVisible();
  await expect(page.getByRole('img', { name: /Cumulative seats back in use/ })).toBeVisible();
  await expect(page.getByText('Extra fans in the Arena')).toBeVisible();
});

test('live: Sepp releases on his phone, Mia passes, Jonas accepts on theirs', async ({
  browser,
}) => {
  const id = room('e2e');
  const ctx = await browser.newContext();
  const [sepp, mia, jonas] = await Promise.all([ctx.newPage(), ctx.newPage(), ctx.newPage()]);
  await sepp.goto(`/live/sepp?room=${id}`);
  await mia.goto(`/live/mia?room=${id}`);
  await jonas.goto(`/live/jonas?room=${id}`);

  await expect(sepp.getByText(/Servus Sepp/).first()).toBeVisible({ timeout: 15_000 });
  await sepp.getByLabel('Message the assistant').fill("Sorry, I can't make it — I'm in Hamburg");
  await sepp.getByRole('button', { name: 'Send' }).click();
  await sepp.getByRole('button', { name: /Release seat to waitlist/ }).click();
  await expect(sepp.getByText('Released to waitlist')).toBeVisible();

  // Pushed to Mia's device over SSE.
  await expect(mia.getByText(/A Südkurve spot just opened up/)).toBeVisible({ timeout: 15_000 });
  await expect(mia.getByText(/your patience pays off/)).toBeVisible({ timeout: 15_000 });
  await mia.getByRole('button', { name: 'Pass' }).click();
  await expect(mia.getByText(/You passed on this one — no penalty/)).toBeVisible();

  await expect(jonas.getByText(/A Südkurve spot just opened up/)).toBeVisible({ timeout: 15_000 });
  await jonas.getByRole('button', { name: 'Accept' }).click();
  await expect(jonas.getByText(/You’re in, Jonas!/)).toBeVisible();
  await expect(sepp.getByText(/Jonas from Garching will be in your spot/)).toBeVisible({
    timeout: 15_000,
  });
  await ctx.close();
});

test('live: a holder who is coming keeps the seat', async ({ page }) => {
  await page.goto(`/live/sepp?room=${room('keep')}`);
  await expect(page.getByText(/Servus Sepp/).first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: "I'm coming" }).click();
  await expect(page.getByText('You’re going')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /Release seat/ })).toHaveCount(0);
});

test('live: stage view shows the engine explaining every skip', async ({ page }, info) => {
  test.skip(
    info.project.name === 'mobile',
    'Three-column stage layout is a desktop presentation view',
  );
  await page.goto(`/live?room=${room('stage')}`);
  await expect(page.getByText(/Live · SSE|Polling/)).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Release my seat' }).click();
  await page.getByRole('button', { name: /Release seat to waitlist/ }).click();
  await expect(page.getByText('#1 Familie Huber skipped — needs 4 seats together.')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText('#2 Elif Yılmaz skipped — wants a seated seat.')).toBeVisible();
  await expect(page.getByText(/Offer → #3 Mia Schneider/)).toBeVisible();
});

test('journey: free text becomes a plan, a strike re-plans it, questions get grounded answers', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('/journey');
  await page
    .getByLabel('Describe your matchday')
    .fill('From Augsburg by train with my kids, Block 214, we want food before the choreo');
  await page.getByRole('button', { name: /Plan it for me/ }).click();
  await expect(page.getByText('Block 214', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Your block')).toHaveValue('214');
  await expect(page.getByText(/In your seat — Block 214/)).toBeVisible();
  await expect(page.getByText(/^Leave Augsburg Hbf at \d{2}:\d{2}/)).toBeVisible({
    timeout: 15_000,
  });

  await page.getByRole('button', { name: 'Public transport strike' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Strike — no U-Bahn today' }),
  ).toBeVisible();
  await expect(page.getByText(/isn't an option right now/)).toBeVisible();
  await expect(page.getByText(/^Heads-up: Strike/)).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Public transport strike' }).click();
  await page.getByRole('button', { name: 'Where are the shortest toilet queues?' }).click();
  await expect(page.getByText(/Half-time \(\d{2}:\d{2}\): Shortest queue/)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole('link', { name: /Open route in Google Maps/ })).toHaveAttribute(
    'href',
    /google\.com\/maps\/dir/,
  );
  expect(errors).toEqual([]);
});

test('api: health is public, inputs are validated', async ({ request }) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBe(true);
  expect(await health.json()).toMatchObject({ ok: true, ai: { mode: 'demo' } });
  const bad = await request.post('/api/ballot/commit', { data: { fixtureId: '' } });
  expect(bad.status()).toBe(400);
  const closed = await request.post('/api/ballot/commit', {
    data: { fixtureId: 'fcb-scf-2026-11-07' },
  });
  expect(closed.status()).toBe(400);
  const headers = health.headers();
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-powered-by']).toBeUndefined();
});
