import test from 'node:test';
import assert from 'node:assert/strict';

import { Frequency, RRule, datetime } from '../dist/index.js';

test('rule api: query methods and iterator helpers behave as expected', () => {
  const rule = new RRule({
    freq: Frequency.DAILY,
    count: 4,
    dtstart: datetime(2026, 4, 11, 9, 0, 0),
  });

  assert.deepEqual(rule.all().map((value) => value.toISOString()), [
    '2026-04-11T09:00:00.000Z',
    '2026-04-12T09:00:00.000Z',
    '2026-04-13T09:00:00.000Z',
    '2026-04-14T09:00:00.000Z',
  ]);
  assert.deepEqual(
    rule.all((date, index) => index < 2 && date instanceof Date).map((value) => value.toISOString()),
    ['2026-04-11T09:00:00.000Z', '2026-04-12T09:00:00.000Z'],
  );
  assert.deepEqual(
    rule.between(datetime(2026, 4, 12, 9, 0, 0), datetime(2026, 4, 13, 9, 0, 0), true).map((value) => value.toISOString()),
    ['2026-04-12T09:00:00.000Z', '2026-04-13T09:00:00.000Z'],
  );
  assert.equal(rule.before(datetime(2026, 4, 12, 9, 0, 0))?.toISOString(), '2026-04-11T09:00:00.000Z');
  assert.equal(rule.after(datetime(2026, 4, 12, 9, 0, 0))?.toISOString(), '2026-04-13T09:00:00.000Z');
  assert.equal(rule.count(), 4);
});

test('rule api: throws on invalid date inputs', () => {
  const rule = new RRule({ freq: Frequency.DAILY, count: 2, dtstart: datetime(2026, 4, 11, 9, 0, 0) });
  const invalid = new Date(Number.NaN);

  assert.throws(() => rule.between(invalid, new Date()), /Invalid date/);
  assert.throws(() => rule.before(invalid), /Invalid date/);
  assert.throws(() => rule.after(invalid), /Invalid date/);
});

test('rule api: serialization helpers preserve common fields', () => {
  const rule = new RRule({
    freq: Frequency.WEEKLY,
    interval: 2,
    count: 4,
    dtstart: datetime(2026, 4, 13, 9, 0, 0),
    byweekday: [RRule.MO, RRule.WE],
    byhour: [9],
    byminute: [30],
  });

  const serialized = rule.toString();
  const parsed = RRule.parseString(serialized);
  const json = rule.toJSON();

  assert.equal(parsed.freq, Frequency.WEEKLY);
  assert.equal(parsed.interval, 2);
  assert.equal(parsed.count, 4);
  assert.deepEqual(parsed.byhour ?? [], [9]);
  assert.deepEqual(parsed.byminute ?? [], [30]);
  assert.equal(Array.isArray(parsed.byweekday), true);
  assert.equal((parsed.byweekday ?? []).length, 2);
  assert.equal(json.dtstart?.toISOString(), '2026-04-13T09:00:00.000Z');
  assert.equal(json.count, 4);
});

test('rule api: optionsToString serializes timezone and wkst details', () => {
  assert.equal(
    RRule.optionsToString({
      dtstart: datetime(1997, 9, 2, 9, 0, 0),
      freq: Frequency.WEEKLY,
    }),
    'DTSTART:19970902T090000Z\nRRULE:FREQ=WEEKLY',
  );

  assert.equal(
    RRule.optionsToString({
      dtstart: new Date('1997-09-02T13:00:00.000Z'),
      tzid: 'America/New_York',
      freq: Frequency.WEEKLY,
    }),
    'DTSTART;TZID=America/New_York:19970902T090000\nRRULE:FREQ=WEEKLY',
  );

  assert.match(
    RRule.optionsToString({
      freq: Frequency.WEEKLY,
      interval: 2,
      wkst: RRule.SU,
      count: 4,
      dtstart: datetime(1997, 8, 5, 9, 0, 0),
      byweekday: [RRule.TU, RRule.SU],
    }),
    /WKST=SU/,
  );
});

test('rule api: text rendering helpers expose descriptive metadata', () => {
  const rule = new RRule({
    freq: Frequency.WEEKLY,
    count: 2,
    byweekday: [RRule.MO, RRule.WE],
    dtstart: datetime(2026, 4, 13, 9, 0, 0),
  });

  assert.equal(rule.toText(), 'every week on Monday and Wednesday at 9 AM UTC for 2 times');
  assert.equal(rule.toText({ locale: 'fr' }), 'chaque semaine le lundi et le mercredi à 09:00 UTC pendant 2 occurrences');
  assert.equal(rule.isFullyConvertibleToText(), true);
  assert.equal(rule.textMergeDescriptor()?.weekdays.join(','), 'Monday,Wednesday');
});

test('rule api: parseText and fromText cover the supported natural-language sugar', () => {
  const daily = RRule.parseText('every day for 3 times');
  const until = RRule.parseText('every day until 2023-05-10T04:00:00.000Z');
  const weekdays = RRule.parseText('every weekday for 2 times');

  assert.equal(daily.freq, Frequency.DAILY);
  assert.equal(daily.count, 3);
  assert.equal(until.until?.toISOString(), '2023-05-10T04:00:00.000Z');
  assert.equal(weekdays.freq, Frequency.WEEKLY);
  assert.equal((weekdays.byweekday ?? []).length, 5);

  assert.equal(RRule.fromText('every 4 hours').toString(), 'RRULE:FREQ=HOURLY;INTERVAL=4');
  assert.equal(RRule.fromText('every week on Monday, Wednesday').toString(), 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE');
  assert.equal(
    RRule.fromText('every week on Sunday at 10, 12 and 17').toString(),
    'RRULE:FREQ=WEEKLY;BYDAY=SU;BYHOUR=10,12,17;BYMINUTE=0;BYSECOND=0',
  );
  assert.equal(RRule.fromText('every 2 weeks').toString(), 'RRULE:FREQ=WEEKLY;INTERVAL=2');
  assert.equal(RRule.fromText('every 6 months').toString(), 'RRULE:FREQ=MONTHLY;INTERVAL=6');
  assert.equal(
    RRule.fromText('every day at 10, 12 and 17').toString(),
    'RRULE:FREQ=DAILY;BYHOUR=10,12,17;BYMINUTE=0;BYSECOND=0',
  );
  assert.equal(RRule.fromText('every month on the 3rd Tuesday').toString(), 'RRULE:FREQ=MONTHLY;BYDAY=+3TU');
  assert.equal(RRule.fromText('every month on the last Monday').toString(), 'RRULE:FREQ=MONTHLY;BYDAY=-1MO');
  assert.equal(RRule.fromText('every month on the 4th last').toString(), 'RRULE:FREQ=MONTHLY;BYMONTHDAY=-4');
  assert.equal(RRule.fromText('every month on the 4th').toString(), 'RRULE:FREQ=MONTHLY;BYMONTHDAY=4');
  assert.equal(RRule.fromText('every year on the 13th Friday').toString(), 'RRULE:FREQ=YEARLY;BYDAY=+13FR');
  assert.equal(RRule.fromText('every month on the 3rd last Tuesday').toString(), 'RRULE:FREQ=MONTHLY;BYDAY=-3TU');
  assert.equal(RRule.fromText('every month on the 2nd last Friday').toString(), 'RRULE:FREQ=MONTHLY;BYDAY=-2FR');
  assert.equal(RRule.fromText('every week for 20 times').toString(), 'RRULE:FREQ=WEEKLY;COUNT=20');
  assert.equal(RRule.fromText('every January, February').toString(), 'RRULE:FREQ=YEARLY;BYMONTH=1,2');
  assert.equal(
    RRule.fromText('every January, February on the 1st Friday').toString(),
    'RRULE:FREQ=YEARLY;BYMONTH=1,2;BYDAY=+1FR',
  );
});

test('rule api: fromText can generate occurrences directly', () => {
  const rule = RRule.fromText('every week on Monday and Wednesday at 9 AM UTC for 4 times starting from April 13, 2026');

  assert.deepEqual(rule.all().map((value) => value.toISOString()), [
    '2026-04-13T09:00:00.000Z',
    '2026-04-15T09:00:00.000Z',
    '2026-04-20T09:00:00.000Z',
    '2026-04-22T09:00:00.000Z',
  ]);
});
