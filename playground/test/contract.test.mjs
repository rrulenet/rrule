import assert from 'node:assert/strict';
import { test } from 'node:test';
import manifest from '../package.json' with { type: 'json' };
import { fromBuilder, prepareText, readLink, shareURL, toBuilder } from '../src/model.mjs';
import { defaultPreset, presets } from '../src/presets.mjs';
import { getPreview } from '../src/preview.mjs';
import { verifyInstall } from '../scripts/verify-install.mjs';

const fixture = id => presets.find(value => value.id === id).text;
const preview = (text, options = {}) => getPreview({ text, limit: 12, ...options });
const days = result => result.occurrences.map(value => value.day);

test('the playground resolves the pinned public version', () => {
  assert.equal(verifyInstall()['@rrulenet/rrule'].version, manifest.dependencies['@rrulenet/rrule']);
});

test('each preset returns dates and builder-compatible presets preserve their occurrences', () => {
  for (const preset of presets) {
    const expected = preview(preset.text);
    assert(expected.occurrences.length, preset.id);
    const data = toBuilder(preset.text);
    if (preset.id === 'combined-schedules') assert.equal(data, null);
    else {
      assert(data, preset.id);
      assert.deepEqual(preview(fromBuilder(data)).occurrences, expected.occurrences, preset.id);
    }
  }
});

test('curated presets demonstrate stable contract cases', () => {
  assert.deepEqual(days(preview(fixture('last-weekday'), { limit: 3 })), ['2026-01-30', '2026-02-27', '2026-03-31']);
  assert.deepEqual(days(preview(fixture('month-end'), { limit: 3 })), ['2026-01-31', '2026-03-31', '2026-05-31']);
  assert.deepEqual(days(preview(fixture('leap-birthday'), { limit: 3 })), ['2024-02-29', '2025-02-28', '2026-02-28']);
  assert.deepEqual(days(preview(fixture('easter-monday'), { limit: 2 })), ['2026-04-06', '2027-03-29']);
  assert.deepEqual(preview(fixture('spring-forward'), { limit: 3 }).occurrences.map(value => value.time),
    ['02:30:00', '03:30:00', '02:30:00']);
  assert(preview(fixture('position-byhour')).occurrences.every(value => value.time === '10:00:00'));
  assert(!days(preview(fixture('school-days'))).includes('2026-09-16'));
  assert(days(preview(fixture('school-days'))).includes('2026-09-21'));
});

test('links round trip multiline input, offsets and preview size', () => {
  const text = 'DTSTART;TZID="+05:30":20260101T090000\nRRULE:FREQ=DAILY;COUNT=2\nEXDATE:20260101T033000Z';
  const url = shareURL('https://example.test/rrule/#workspace', text, 24, null);
  assert.equal(url.pathname, '/rrule/');
  assert.equal(url.hash, '');
  assert.deepEqual(readLink(url), { text, preset: null, limit: 24, mode: 'text' });
  assert.deepEqual(readLink(shareURL(url, text, 12, 'weekdays', 'builder')),
    { text, preset: 'weekdays', limit: 12, mode: 'builder' });
  assert.deepEqual(readLink(new URL('https://example.test/rrule/?case=weekdays&limit=10')),
    { text: null, preset: 'weekdays', limit: 10, mode: 'text' });
  const roundTrip = fromBuilder(toBuilder(text));
  assert.match(roundTrip, /TZID="\+05:30"/);
  assert.equal(preview(roundTrip).occurrences[0].offset, '+05:30');
});

test('a bare rule uses a reproducible DTSTART and preserves folded text', () => {
  const start = defaultPreset.text.split('\n')[0];
  const prepared = prepareText('FREQ=WEEKLY;\r\n BYDAY=TH;COUNT=1', start);
  assert.equal(prepared.text, start + '\nFREQ=WEEKLY;BYDAY=TH;COUNT=1');
  assert(prepared.implicitStart);
  assert.deepEqual(days(preview(prepared.text)), ['2026-01-01']);
  for (const text of ['COUNT=2;FREQ=DAILY', 'RRULE:COUNT=2;FREQ=DAILY']) {
    const reordered = prepareText(text, start);
    assert(reordered.implicitStart);
    assert.deepEqual(days(preview(reordered.text)), ['2026-01-01', '2026-01-02']);
    assert.equal(toBuilder(reordered.text).COUNT, '2');
  }
});

test('builder preserves DATE UNTIL and validates conflicting or unsupported input', () => {
  const data = toBuilder('DTSTART;VALUE=DATE:20260101\nRRULE:FREQ=DAILY;UNTIL=20260103');
  assert(data['all-day']);
  assert.equal(data['until-date'], '2026-01-03');
  assert.deepEqual(days(preview(fromBuilder(data))), ['2026-01-01', '2026-01-02', '2026-01-03']);
  assert.equal(toBuilder('DTSTART:20260101T000000Z\nRRULE:FREQ=DAILY;COUNT=2;UNTIL=20260103T000000Z'), null);
  assert.equal(toBuilder('DTSTART:20260101T000000Z\nRRULE:FREQ=DAILY\nEXRULE:FREQ=WEEKLY'), null);
  assert.equal(toBuilder('DTSTART:20260101T000000Z\nRRULE:FREQ=DAILY;COUNT=2=3'), null);
  assert.throws(() => fromBuilder({ ...data, INTERVAL: '0' }), /positive integer/);
  assert.throws(() => fromBuilder({ ...data, RSCALE: '', SKIP: 'FORWARD' }), /calendar scale/);
});

test('query windows preserve bounds and preview limits, including all-day display', () => {
  const text = 'DTSTART:20260101T090000Z\nRRULE:FREQ=DAILY';
  const query = { operation: 'between', start: '2026-01-02T09:00', end: '2026-01-06T09:00', inclusive: false };
  const exclusive = preview(text, { limit: 2, query });
  assert.deepEqual(days(exclusive), ['2026-01-03', '2026-01-04']);
  assert(exclusive.hasMore);
  assert.deepEqual(days(preview(text, { query: { ...query, inclusive: true } })),
    ['2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05', '2026-01-06']);
  assert.throws(() => preview(text, { query: { ...query, end: query.start, start: query.end } }), /end must be/);
  const allDay = preview(fixture('school-days'), { display: 'browser', browserZone: 'America/Los_Angeles' });
  assert.equal(days(allDay)[0], '2026-09-02');
  assert.equal(allDay.occurrences[0].time, null);
});

test('invalid selectors surface an engine error and impossible rules return an empty preview', () => {
  assert.throws(() => preview('DTSTART:20260101T000000Z\nRRULE:FREQ=DAILY;BYHOUR=25'), /BYHOUR/);
  assert.deepEqual(days(preview('DTSTART:20260101T000000Z\nRRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=30')), []);
});
