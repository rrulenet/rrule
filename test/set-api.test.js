import test from 'node:test';
import assert from 'node:assert/strict';

import { Frequency, RRule, RRuleSet, datetime, rrulestr } from '../dist/index.js';
import { DateSource } from '@rrulenet/core/engine';
import { dateToZdt } from '@rrulenet/core/time';

test('set api: dtstart and tzid use explicit values or rule fallbacks', () => {
  const set = new RRuleSet();
  const fallbackRule = new RRule({
    freq: Frequency.DAILY,
    count: 2,
    dtstart: datetime(2026, 4, 11, 9, 0, 0),
    tzid: 'Europe/Paris',
  });

  set.rrule(fallbackRule);
  assert.equal(set.dtstart()?.toISOString(), '2026-04-11T09:00:00.000Z');
  assert.equal(set.tzid(), 'Europe/Paris');

  set.dtstart(datetime(2026, 4, 10, 8, 0, 0));
  set.tzid('UTC');
  assert.equal(set.dtstart()?.toISOString(), '2026-04-10T08:00:00.000Z');
  assert.equal(set.tzid(), 'UTC');
});

test('set api: rrule/exrule/rdate/exdate deduplicate and expose copies', () => {
  const set = new RRuleSet();
  const include = new RRule({ freq: Frequency.DAILY, count: 2, dtstart: datetime(2026, 4, 11, 9, 0, 0) });
  const exclude = new RRule({ freq: Frequency.DAILY, count: 1, dtstart: datetime(2026, 4, 12, 9, 0, 0) });
  const extra = datetime(2026, 4, 15, 9, 0, 0);
  const blocked = datetime(2026, 4, 11, 9, 0, 0);

  set.rrule(include);
  set.rrule(include.clone());
  set.exrule(exclude);
  set.exrule(exclude.clone());
  set.rdate(extra);
  set.rdate(extra);
  set.exdate(blocked);
  set.exdate(blocked);

  assert.equal(set.rrules().length, 1);
  assert.equal(set.exrules().length, 1);
  assert.equal(set.rdates().length, 1);
  assert.equal(set.exdates().length, 1);
  assert.notEqual(set.rrules()[0], include);
  assert.notEqual(set.rdates()[0], extra);
});

test('set api: query methods, serialization, text, clone and json stay coherent', () => {
  const set = new RRuleSet();
  set.tzid('UTC');
  set.rrule(new RRule({
    freq: Frequency.MONTHLY,
    count: 1,
    dtstart: datetime(2026, 1, 1, 0, 0, 0),
  }));
  set.rdate(new Date('2026-02-10T00:00:00.000Z'));
  set.exdate(new Date('2026-03-10T00:00:00.000Z'));
  set.exdate(new Date('2026-04-10T00:00:00.000Z'));

  assert.deepEqual(set.all().map((value) => value.toISOString()), [
    '2026-01-01T00:00:00.000Z',
    '2026-02-10T00:00:00.000Z',
  ]);
  assert.deepEqual(
    set.between(datetime(2026, 1, 1, 0, 0, 0), datetime(2026, 2, 10, 0, 0, 0), true).map((value) => value.toISOString()),
    ['2026-01-01T00:00:00.000Z', '2026-02-10T00:00:00.000Z'],
  );
  assert.equal(set.before(datetime(2026, 2, 10, 0, 0, 0))?.toISOString(), '2026-01-01T00:00:00.000Z');
  assert.equal(set.after(datetime(2026, 1, 1, 0, 0, 0))?.toISOString(), '2026-02-10T00:00:00.000Z');
  assert.equal(set.count(), 2);
  assert.equal(set.toText(), 'every month for 1 time with 1 additional date excluding 2 dates');
  assert.equal(set.toText({ locale: 'fr' }), 'chaque mois pendant 1 occurrence avec 1 date supplémentaire en excluant 2 dates');
  assert.equal(set.isFullyConvertibleToText(), true);
  assert.deepEqual(set.valueOf(), [
    'DTSTART:20260101T000000Z',
    'RRULE:FREQ=MONTHLY;COUNT=1',
    'RDATE:20260210T000000Z',
    'EXDATE:20260310T000000Z,20260410T000000Z',
  ]);
  assert.deepEqual(set.toJSON(), {
    tzid: 'UTC',
    rrule: [{ freq: Frequency.MONTHLY, count: 1, dtstart: datetime(2026, 1, 1, 0, 0, 0), until: null }],
    rdate: [new Date('2026-02-10T00:00:00.000Z')],
    exdate: [new Date('2026-03-10T00:00:00.000Z'), new Date('2026-04-10T00:00:00.000Z')],
  });

  const cloned = set.clone();
  assert.equal(cloned.toString(), set.toString());
  assert.notEqual(cloned.rdates()[0], set.rdates()[0]);
});

test('set api: validates instance types on mutating methods', () => {
  const set = new RRuleSet();

  assert.throws(() => set.rrule({}), /is not RRule instance/);
  assert.throws(() => set.exrule({}), /is not RRule instance/);
  assert.throws(() => set.rdate('2026-01-01'), /is not Date instance/);
  assert.throws(() => set.exdate('2026-01-01'), /is not Date instance/);
});

test('set api: rrulestr handles bare DTSTART, value-only strings, and compatible sets', () => {
  const bare = rrulestr('DTSTART:20220831T070000Z', { forceset: true });
  const single = rrulestr('RRULE:FREQ=DAILY;COUNT=2', { dtstart: datetime(2025, 1, 1, 9, 0, 0) });
  const compatible = rrulestr('DTSTART:20260411T090000Z\nRRULE:FREQ=DAILY;COUNT=2', { compatible: true, forceset: true });

  assert.equal(bare instanceof RRuleSet, true);
  assert.equal(bare.toString(), 'DTSTART:20220831T070000Z');
  assert.deepEqual(bare.all().map((value) => value.toISOString()), ['2022-08-31T07:00:00.000Z']);

  assert.equal(single instanceof RRule, true);
  assert.deepEqual(single.all().map((value) => value.toISOString()), [
    '2025-01-01T09:00:00.000Z',
    '2025-01-02T09:00:00.000Z',
  ]);

  assert.equal(compatible instanceof RRuleSet, true);
  assert.deepEqual(compatible.all().map((value) => value.toISOString()), [
    '2026-04-11T09:00:00.000Z',
    '2026-04-12T09:00:00.000Z',
  ]);
});

test('set api: fromExpression supports explicit config, exrule serialization, and clone on nullable state', () => {
  const includeRule = new RRule({
    freq: Frequency.DAILY,
    count: 2,
    dtstart: datetime(2026, 4, 11, 9, 0, 0),
  });
  const excludeRule = new RRule({
    freq: Frequency.DAILY,
    count: 1,
    dtstart: datetime(2026, 4, 12, 9, 0, 0),
  });
  const extraDate = datetime(2026, 4, 15, 9, 0, 0);
  const blockedDate = datetime(2026, 4, 11, 9, 0, 0);
  const expression = {
    kind: 'union',
    expressions: [
      {
        kind: 'source',
        source: new DateSource([dateToZdt(extraDate, 'Europe/Paris')]),
      },
    ],
  };

  const set = RRuleSet.fromExpression(expression, {
    noCache: true,
    dtstart: null,
    tzid: 'Europe/Paris',
    includeRules: [includeRule],
    excludeRules: [excludeRule],
    rdates: [extraDate],
    exdates: [blockedDate],
  });

  assert.equal(set.dtstart(), null);
  assert.equal(set.tzid(), 'Europe/Paris');
  assert.deepEqual(set.exrules().map((rule) => rule.toString()), ['DTSTART:20260412T090000Z\nRRULE:FREQ=DAILY;COUNT=1']);
  assert.match(set.toString(), /^DTSTART:20260411T090000Z/);
  assert.match(set.toString(), /RDATE;TZID=Europe\/Paris:20260415T110000/);
  assert.match(set.toString(), /EXRULE:FREQ=DAILY;COUNT=1/);
  assert.equal(set.toJSON().dtstart, null);
  assert.equal(set.toJSON().exrule?.length, 1);
  assert.equal(set.all().length >= 1, true);

  const cloned = set.clone();
  assert.equal(cloned.dtstart(), null);
  assert.equal(cloned.tzid(), 'Europe/Paris');
});

test('set api: empty and nullable states serialize predictably', () => {
  const empty = new RRuleSet();
  const nullable = new RRuleSet();
  nullable.dtstart(null);
  nullable.tzid('UTC');

  assert.deepEqual(empty.valueOf(), []);
  assert.equal(empty.toString(), '');
  assert.deepEqual(empty.toJSON(), {});

  assert.equal(nullable.dtstart(), null);
  assert.deepEqual(nullable.valueOf(), []);
  assert.deepEqual(nullable.toJSON(), { dtstart: null, tzid: 'UTC' });
});
