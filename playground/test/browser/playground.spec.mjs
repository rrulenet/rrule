import { test, expect } from '@playwright/test';
import { cases, versions, engines } from '../../../comparison/cases.mjs';

const expectedKinds = {
  'last-weekday': ['correct', 'correct', 'correct'], weekdays: ['correct', 'correct', 'correct'], 'month-end': ['correct', 'correct', 'correct'],
  '671-count': ['incorrect', 'correct', 'correct'], 'position-byhour': ['incorrect', 'correct', 'correct'],
  'combined-schedules': ['correct', 'unsupported', 'correct'], '676-byhour': ['incorrect', 'incorrect', 'correct'],
  '31544-phase': ['timeout', 'limited', 'correct'], 'leap-birthday': ['unsupported', 'correct', 'incorrect'],
};
const complete = page => expect(page.locator('#run-status')).toHaveText('Comparison complete.');

test('the concise natural-language examples run all three pinned engines and grade counterexamples honestly', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  for (const fixture of cases) {
    await page.goto(`/rrule/?example=${fixture.id}`); await complete(page);
    await expect(page.locator('#example')).toHaveValue(fixture.id);
    await expect(page.locator('#results section')).toHaveCount(3);
    for (const [index, engine] of engines.entries()) {
      await expect(page.locator(`#${engine}-card`)).toHaveAttribute('data-state', expectedKinds[fixture.id][index]);
      if (expectedKinds[fixture.id][index] === 'correct' && fixture.expected.kind === 'dates') {
        expect(await page.locator(`#${engine}-output time`).evaluateAll(elements => elements.map(el => el.dateTime))).toEqual(fixture.expected.values);
      }
    }
  }
  expect(errors).toEqual([]);
});

test('free text shares through URL parameters, survives reload and remains unscored', async ({ page }) => {
  await page.goto('/rrule/'); await complete(page);
  const text = 'DTSTART:20260101T090000Z\nRRULE:FREQ=DAILY;COUNT=2';
  await page.locator('#editor').fill(text);
  await page.getByRole('button', { name: 'Compare results' }).click(); await complete(page);
  await expect(page.locator('#custom-note')).toBeVisible();
  for (const engine of engines) await expect(page.locator(`#${engine}-card`)).toHaveAttribute('data-state', 'unscored');
  await page.getByRole('button', { name: 'Copy link' }).click();
  expect(new URL(page.url()).searchParams.get('rrule')).toBe(text);
  await page.reload(); await complete(page);
  await expect(page.locator('#editor')).toHaveValue(text);
  await expect(page.locator('#custom-note')).toBeVisible();
  await page.getByRole('button', { name: 'Restore example' }).click(); await complete(page);
  await expect(page.locator('#example')).toHaveValue('last-weekday');
});

test('a fragment URL and open-ended rule preview work without inserting COUNT', async ({ page }) => {
  const text = 'DTSTART:20260101T090000Z\nRRULE:FREQ=DAILY';
  await page.goto(`/rrule/#${new URLSearchParams({ rrule: text, limit: '5' })}`); await complete(page);
  await expect(page.locator('#maximum')).toHaveValue('5');
  for (const engine of engines) {
    await expect(page.locator(`#${engine}-output time`)).toHaveCount(5);
    await expect(page.locator(`#${engine}-output`)).toContainText('more available');
  }
  await expect(page.locator('#editor')).toHaveValue(text);
  await expect(page.locator('#rrulenet-serialized')).not.toContainText('COUNT=');
});

test('a slow query can be stopped and a valid comparison can run afterwards', async ({ page }) => {
  await page.goto('/rrule/?example=31544-phase');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.locator('#run-status')).toHaveText('Comparison stopped.');
  await page.locator('#example').selectOption('last-weekday'); await complete(page);
  for (const engine of engines) await expect(page.locator(`#${engine}-card`)).toHaveAttribute('data-state', 'correct');
});

test('untrusted text is rendered as data, and missing anchors are shared preview restrictions', async ({ page }) => {
  await page.goto('/rrule/'); await complete(page);
  await page.locator('#editor').fill('FREQ=DAILY');
  await page.getByRole('button', { name: 'Compare results' }).click(); await complete(page);
  for (const engine of engines) {
    await expect(page.locator(`#${engine}-output`)).toContainText('PlaygroundInputError');
    await expect(page.locator(`#${engine}-badge`)).toHaveText('Check input');
  }
  await page.locator('#editor').fill('DTSTART:20260101T090000Z\nRRULE:FREQ=DAILY;COUNT=2;BYHOUR=<img src=x onerror=alert(1)>');
  await page.getByRole('button', { name: 'Compare results' }).click(); await complete(page);
  expect(await page.locator('#results img').count()).toBe(0);
  await expect(page.locator('#rrulenet-output')).toContainText('<img');
});

test('layout, package provenance, licenses and keyboard navigation work at the Pages subpath', async ({ page }) => {
  await page.goto('/rrule/?example=month-end'); await complete(page);
  await page.getByRole('link', { name: 'Skip to RRULE' }).press('Enter');
  await expect(page.locator('#example')).toHaveValue('month-end');
  const metadata = await page.request.get('/rrule/versions.json');
  expect(metadata.ok()).toBe(true); expect((await metadata.json()).versions).toEqual(versions);
  const notices = await page.request.get('/rrule/THIRD_PARTY_NOTICES.txt');
  expect(await notices.text()).toContain('rrule-temporal@2.2.8');
  expect((await page.request.get('/rrule/COMPARISONS.md')).status()).toBe(404);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
