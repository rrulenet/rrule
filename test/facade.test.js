import test from 'node:test';
import assert from 'node:assert/strict';

import * as rrule from '../dist/index.js';

test('rrule facade: native API is not exported', () => {
  assert.equal('temporal' in rrule, false);
  assert.equal('TemporalApiError' in rrule, false);
  assert.equal('TEMPORAL_ERROR_CODES' in rrule, false);
});

test('rrule facade: compat surface remains exported', () => {
  assert.equal(typeof rrule.RRule, 'function');
  assert.equal(typeof rrule.RRuleSet, 'function');
  assert.equal(typeof rrule.SetAlgebra, 'function');
  assert.equal(typeof rrule.rrulestr, 'function');
  assert.equal(typeof rrule.datetime, 'function');
  assert.equal(typeof rrule.getToTextLocale, 'function');
});

test('rrule facade: fromString returns local RRule instances', () => {
  const rule = rrule.RRule.fromString('DTSTART:20250101T090000Z\nRRULE:FREQ=DAILY;COUNT=2');

  assert.equal(rule instanceof rrule.RRule, true);
  assert.deepEqual(rule.all().map((date) => date.toISOString()), [
    '2025-01-01T09:00:00.000Z',
    '2025-01-02T09:00:00.000Z',
  ]);
});

test('rrule facade: rrulestr returns local RRuleSet instances for sets', () => {
  const set = rrule.rrulestr(
    'DTSTART:20250101T090000Z\nRRULE:FREQ=DAILY;COUNT=3\nEXDATE:20250102T090000Z',
  );

  assert.equal(set instanceof rrule.RRuleSet, true);
  assert.deepEqual(set.all().map((date) => date.toISOString()), [
    '2025-01-01T09:00:00.000Z',
    '2025-01-03T09:00:00.000Z',
  ]);
});

test('rrule facade: RRule.clone preserves noCache behavior', () => {
  const rule = new rrule.RRule(
    {
      freq: rrule.Frequency.DAILY,
      count: 2,
      dtstart: new Date('2025-01-01T09:00:00.000Z'),
    },
    true,
  );

  const cloned = rule.clone();
  const first = cloned.all();
  const second = cloned.all();

  assert.equal(cloned instanceof rrule.RRule, true);
  assert.notEqual(first, second);
  assert.deepEqual(second.map((date) => date.toISOString()), [
    '2025-01-01T09:00:00.000Z',
    '2025-01-02T09:00:00.000Z',
  ]);
});

test('rrule facade: RRuleSet.clone preserves noCache behavior', () => {
  const set = new rrule.RRuleSet(true);
  set.tzid('UTC');
  set.rrule(new rrule.RRule({
    freq: rrule.Frequency.DAILY,
    count: 2,
    dtstart: new Date('2025-01-01T09:00:00.000Z'),
  }));

  const cloned = set.clone();
  const first = cloned.all();
  const second = cloned.all();

  assert.equal(cloned instanceof rrule.RRuleSet, true);
  assert.notEqual(first, second);
  assert.deepEqual(second.map((date) => date.toISOString()), [
    '2025-01-01T09:00:00.000Z',
    '2025-01-02T09:00:00.000Z',
  ]);
});

test('rrule facade: bare DTSTART with TZID round-trips as local timezone form', () => {
  const set = rrule.rrulestr('DTSTART;TZID=Europe/Paris:20250101T090000', { forceset: true });

  assert.equal(set instanceof rrule.RRuleSet, true);
  assert.equal(set.toString(), 'DTSTART;TZID=Europe/Paris:20250101T090000');
});
