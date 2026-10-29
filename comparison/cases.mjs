// A deliberately small set of developer scenarios, shared by the UI and CI.
export const versions = Object.freeze({ upstream: '2.8.1', temporal: '2.2.8', rrulenet: '0.2.1', core: '0.2.1' });
export const engines = Object.freeze(['upstream', 'temporal', 'rrulenet']);
export const packages = Object.freeze({ upstream: 'rrule', temporal: 'rrule-temporal', rrulenet: '@rrulenet/rrule' });
export const limits = Object.freeze({ timeoutMs: 2000, startupMs: 15000, inputLength: 16000, count: 1000, maximumPreview: 20 });
const rfc = 'https://www.rfc-editor.org/rfc/rfc5545.html#section-3.3.10';
const source = (label, url = rfc) => ({ label, url });
const dates = (...values) => ({ kind: 'dates', values });

export const cases = [
  {
    id: 'last-weekday', label: 'The last working day of each month, at 09:00', group: 'Everyday schedules',
    description: 'A familiar payroll or billing schedule. Weekdays are selected before the last position in each month.',
    text: 'DTSTART:20260101T090000Z\nRRULE:FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1;COUNT=4',
    expected: dates('2026-01-30T09:00:00.000Z', '2026-02-27T09:00:00.000Z', '2026-03-31T09:00:00.000Z', '2026-04-30T09:00:00.000Z'),
    rationale: 'These are the last Monday–Friday dates in January through April 2026. This checks recurrence selection, not a holiday calendar.',
    sources: [source('RFC: BYSETPOS')], control: true,
  },
  {
    id: 'weekdays', label: 'Every Monday, Wednesday and Friday, at 09:00', group: 'Everyday schedules',
    description: 'A recurring team reminder. The first five matching days are included, starting from the explicit anchor.',
    text: 'DTSTART:20260105T090000Z\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=5',
    expected: dates('2026-01-05T09:00:00.000Z', '2026-01-07T09:00:00.000Z', '2026-01-09T09:00:00.000Z', '2026-01-12T09:00:00.000Z', '2026-01-14T09:00:00.000Z'),
    rationale: 'January 5, 2026 is a Monday. The next eligible weekdays are Wednesday 7, Friday 9, Monday 12 and Wednesday 14.',
    sources: [source('RFC: weekly recurrence')], control: true,
  },
  {
    id: 'month-end', label: 'On the 31st, skipping months without that day', group: 'Everyday schedules',
    description: 'Keep the intended day of the month instead of moving the schedule into a shorter month.',
    text: 'DTSTART:20260131T090000Z\nRRULE:FREQ=MONTHLY;BYMONTHDAY=31;COUNT=4',
    expected: dates('2026-01-31T09:00:00.000Z', '2026-03-31T09:00:00.000Z', '2026-05-31T09:00:00.000Z', '2026-07-31T09:00:00.000Z'),
    rationale: 'Generated dates that do not exist are omitted and do not consume COUNT. February, April and June have no day 31.',
    sources: [source('RFC: invalid generated dates')], control: true,
  },
  {
    id: '671-count', label: 'Six runs, twice a minute, despite a repeated time slot', group: 'Selection and reliability',
    description: 'Repeated values can arise when merging scheduling preferences. They should not consume the occurrence count.',
    text: 'DTSTART:20260101T090000Z\nRRULE:FREQ=MINUTELY;BYSECOND=0,30,0;COUNT=6',
    expected: dates(...Array.from({ length: 6 }, (_, i) => `2026-01-01T09:0${Math.floor(i / 2)}:${i % 2 ? '30' : '00'}.000Z`)),
    rationale: 'There are two distinct seconds per minute. Six distinct runs therefore end at 09:02:30. A repeated selector is not a second occurrence.',
    sources: [source('Original report #671', 'https://github.com/jkbrzt/rrule/issues/671'), source('Community fix proposal #673', 'https://github.com/jkbrzt/rrule/pull/673')],
  },
  {
    id: 'position-byhour', label: 'The second distinct daily time slot: 10:00', group: 'Selection and reliability',
    description: 'Select the second time from 09:00 and 10:00, even when 09:00 appears twice in the configuration.',
    text: 'DTSTART:20260101T090000Z\nRRULE:FREQ=DAILY;BYHOUR=9,9,10;BYSETPOS=2;COUNT=3',
    expected: dates('2026-01-01T10:00:00.000Z', '2026-01-02T10:00:00.000Z', '2026-01-03T10:00:00.000Z'),
    rationale: 'The distinct daily candidates are 09:00 and 10:00. BYSETPOS=2 selects 10:00; deduplicating only after selection is too late.',
    sources: [source('Related upstream proposal #673', 'https://github.com/jkbrzt/rrule/pull/673'), source('RFC: recurrence set positions')],
  },
  {
    id: 'combined-schedules', label: 'Monday mornings and Friday afternoons, except one holiday', group: 'Composition',
    description: 'Combine two recurring schedules in one input, then exclude January 9. Each rule keeps its own COUNT.',
    text: 'DTSTART:20260101T090000Z\nRRULE:FREQ=WEEKLY;BYDAY=MO;BYHOUR=9;COUNT=3\nRRULE:FREQ=WEEKLY;BYDAY=FR;BYHOUR=17;COUNT=3\nEXDATE:20260109T170000Z',
    expected: dates('2026-01-02T17:00:00.000Z', '2026-01-05T09:00:00.000Z', '2026-01-12T09:00:00.000Z', '2026-01-16T17:00:00.000Z', '2026-01-19T09:00:00.000Z'),
    rationale: 'Three Mondays and three Fridays form the union. Excluding Friday January 9 leaves five dates. Multiple RRULE lines here are a library recurrence-set input convention; RFC 5545 does not define multiple RRULE properties in one VEVENT. rrule-temporal 2.2.8 exposes a single-rule API, so this is a composition capability difference.',
    sources: [source('rrule.js: RRuleSet', 'https://github.com/jkbrzt/rrule#rruleset-constructor'), source('rrule-temporal public API', 'https://github.com/ggaabe/rrule-temporal')],
  },
  {
    id: '676-byhour', label: 'Catch an invalid hour: 25:00', group: 'Selection and reliability',
    description: 'Reject a scheduling typo instead of silently turning it into a different daily schedule.',
    text: 'DTSTART:20260101T000000Z\nRRULE:FREQ=DAILY;BYHOUR=25;COUNT=2',
    expected: { kind: 'reject' },
    rationale: 'BYHOUR is limited to 0–23. The validation contract in this example requires rejection rather than silent normalization or removal. The RFC defines valid values without prescribing a JavaScript exception. rrule-temporal was checked with defaults and strict:true; both accept this input in 2.2.8.',
    sources: [source('Original report #676', 'https://github.com/jkbrzt/rrule/issues/676'), source('RFC: hour range')],
  },
  {
    id: '31544-phase', label: 'No runs when a ten-minute interval cannot match the filter', group: 'Selection and reliability',
    description: 'Starting at minute 27, a ten-minute interval can never hit minutes 00, 10, 20, 30, 40 or 50.',
    text: 'DTSTART:20260708T082755Z\nRRULE:FREQ=MINUTELY;INTERVAL=10;BYMINUTE=0,10,20,30,40,50;COUNT=3',
    expected: dates(),
    rationale: 'Every visited nominal minute remains 7 modulo 10. The recurrence set is empty. A search-budget error or a timeout is reported separately from an incorrect list of dates.',
    sources: [source('Derived from Codex #31544', 'https://github.com/openai/codex/issues/31544')],
  },
  {
    id: 'leap-birthday', label: 'A leap-day birthday, moved back in non-leap years', group: 'Calendar support',
    description: 'Use the Gregorian SKIP extension to keep a February birthday on the last day of the month.',
    text: 'DTSTART:20160229T120000Z\nRRULE:RSCALE=GREGORIAN;FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29;SKIP=BACKWARD;COUNT=4',
    expected: dates('2016-02-29T12:00:00.000Z', '2017-02-28T12:00:00.000Z', '2018-02-28T12:00:00.000Z', '2019-02-28T12:00:00.000Z'),
    rationale: 'The valid leap-day DTSTART is the first occurrence and counts toward COUNT=4. February 29 is moved back to February 28 in the following non-leap years. @rrulenet/rrule 0.2.1 currently omits that first occurrence in this case; this known limitation remains visible.',
    knownMismatch: { rrulenet: 'The published 0.2.1 skips the occurrence at DTSTART and starts in 2017.' },
    sources: [source('RFC 7529: SKIP', 'https://www.rfc-editor.org/rfc/rfc7529.html#section-4.1'), source('RFC: DTSTART and COUNT')],
  },
];

export function canonical(text) { return String(text).replace(/\r\n/g, '\n').trim(); }
export function findCase(text) { return cases.find(fixture => canonical(fixture.text) === canonical(text)); }

export function assess(result, expected, maximum = 10) {
  if (result.status === 'runner-error') return { kind: 'unavailable', label: 'Could not run' };
  if (result.status === 'timeout') return { kind: 'timeout', label: 'Time limit reached' };
  if (result.stage === 'input') return { kind: 'unscored', label: 'Check input' };
  if (result.unsupported) return { kind: 'unsupported', label: 'Not supported', reason: result.unsupported };
  if (!expected) return { kind: 'unscored', label: result.status === 'error' ? 'Rejected' : 'Result' };
  if (expected.kind === 'reject' && result.status === 'error' && result.stage === 'construction') return { kind: 'correct', label: 'Invalid input rejected' };
  if (result.status === 'error') return { kind: /maximum|limit|iterations|budget/i.test(result.error.message + (result.error.code ?? '')) ? 'limited' : 'error', label: /maximum|limit|iterations|budget/i.test(result.error.message + (result.error.code ?? '')) ? 'Search limit reached' : 'Query failed' };
  if (expected.kind === 'reject') return { kind: 'incorrect', label: 'Invalid input accepted' };
  const values = expected.values.slice(0, maximum);
  return JSON.stringify(result.values) === JSON.stringify(values) && result.more === (expected.values.length > maximum)
    ? { kind: 'correct', label: 'Correct result' } : { kind: 'incorrect', label: 'Incorrect result' };
}
