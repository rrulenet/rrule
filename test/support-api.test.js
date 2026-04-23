import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALL_WEEKDAYS,
  Frequency,
  RRule,
  SetAlgebra,
  Weekday,
  datetime,
  getToTextLocale,
  listToTextLocales,
  registerToTextLocale,
} from '../dist/index.js';

test('support api: weekday helpers expose stable compat behavior', () => {
  assert.deepEqual(ALL_WEEKDAYS, ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']);
  assert.equal(Weekday.fromStr('TU').toString(), 'TU');
  assert.equal(RRule.FR.nth(+1).toString(), '+1FR');
  assert.equal(RRule.FR.nth(+1).equals(new Weekday(4, 1)), true);
  assert.equal(RRule.SU.getJsWeekday(), 0);
  assert.throws(() => new Weekday(0, 0), /n == 0/);
});

test('support api: datetime builds UTC dates with exact components', () => {
  const value = datetime(990, 1, 1, 0, 0, 0);

  assert.equal(value.toISOString(), '0990-01-01T00:00:00.000Z');
});

test('support api: locale registry can be extended without forking built-ins', () => {
  registerToTextLocale('fr-net-rrule', {
    weekdayShortcutPhrase: () => 'tous les jours ouvrés',
    countLimitPhrase: (count) => `sur ${count} ${count === 1 ? 'occurrence' : 'occurrences'}`,
  }, 'fr');

  const rule = new RRule({
    freq: Frequency.WEEKLY,
    byweekday: [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR],
    count: 2,
    dtstart: datetime(2026, 4, 13, 0, 0, 0),
  });

  assert.equal(rule.toText({ locale: 'fr-net-rrule' }), 'tous les jours ouvrés sur 2 occurrences');
  assert.equal(getToTextLocale('fr-net-rrule').customSource, 'source personnalisée');
  assert.equal(listToTextLocales().includes('fr-net-rrule'), true);
});

test('support api: set algebra stays usable from the compat package', () => {
  const daily = new RRule({
    freq: Frequency.DAILY,
    count: 5,
    dtstart: datetime(2025, 1, 1, 9, 0, 0),
  });
  const weekdays = new RRule({
    freq: Frequency.WEEKLY,
    byweekday: [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR],
    count: 5,
    dtstart: datetime(2025, 1, 1, 9, 0, 0),
  });

  const union = SetAlgebra.union(daily, weekdays);
  const intersection = SetAlgebra.intersection(daily, weekdays);
  const difference = SetAlgebra.difference(daily, weekdays);

  assert.equal(typeof union.all, 'function');
  assert.deepEqual(intersection.all().map((value) => value.toISOString()), [
    '2025-01-01T09:00:00.000Z',
    '2025-01-02T09:00:00.000Z',
    '2025-01-03T09:00:00.000Z',
  ]);
  assert.deepEqual(difference.all().map((value) => value.toISOString()), [
    '2025-01-04T09:00:00.000Z',
    '2025-01-05T09:00:00.000Z',
  ]);
});
