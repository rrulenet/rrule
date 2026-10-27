<p align="center">
  <a href="https://rrule.net">
    <img src="./assets/avatar.svg" alt="rrule.net" width="96" height="96">
  </a>
</p>

<h1 align="center">@rrulenet/rrule</h1>

<p align="center">
  Classic <code>rrule.js</code>-style recurrence API, backed by a maintained engine built for production scheduling.
</p>

<p align="center">
  <a href="https://rrule.net">rrule.net</a> •
  <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal">Temporal API</a> •
  <strong>@rrulenet ecosystem</strong>
</p>

<p align="center">
  <code>@rrulenet/rrule</code> ·
  <code>@rrulenet/recurrence</code> ·
  <code>@rrulenet/core</code> ·
  <code>@rrulenet/cli</code>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rrulenet/rrule"><img src="https://img.shields.io/npm/v/%40rrulenet%2Frrule" alt="npm version"></a>
  <a href="https://rrulenet.github.io/rrule/coverage.json"><img src="https://img.shields.io/endpoint?url=https://rrulenet.github.io/rrule/coverage.json" alt="Coverage"></a>
  <img src="https://img.shields.io/badge/license-MIT-2563EB" alt="MIT License">
</p>

<p align="center">
  <sub><strong>@rrulenet/rrule</strong>: classic API · <strong>@rrulenet/recurrence</strong>: Temporal-first API · <strong>@rrulenet/core</strong>: engine · <strong>@rrulenet/cli</strong>: workflows</sub>
</p>

`@rrulenet/rrule` provides the classic `rrule.js`-style API in the ecosystem. It is designed for compatibility-focused applications that want familiar classes, stable recurrence behavior, timezone-aware queries, set composition, and text rendering.

Use `@rrulenet/rrule` when you want the familiar class-based compat surface. Use `@rrulenet/recurrence` when your application boundary is already built around the Temporal API and a single `Recurrence` type.

## Table of Contents

- [Install](#install)
- [Why RRule](#why-rrule)
- [API](#api)
- [Getting Started](#getting-started)
- [Examples](#examples)
  - [RRule](#rrule)
  - [RRuleSet](#rruleset)
  - [SetAlgebra](#setalgebra)
  - [rrulestr()](#rrulestr)
- [Notes](#notes)
- [Development](#development)

## Install

```bash
npm install @rrulenet/rrule
```

## Why RRule

`@rrulenet/rrule` exists for applications that want the classic recurrence model:
- `RRule` for one rule
- `RRuleSet` for composed include/exclude schedules
- `rrulestr()` for parsing and round-tripping RFC-style strings
- `Date` values at the API boundary

That makes it a good fit for:
- migrations from `rrule.js`
- existing codebases built around `Date`
- applications that want a familiar class-based API without moving their boundary to `Temporal`

See also:
- [Comparisons](./docs/COMPARISONS.md)

## API

```js
import {
  RRule,
  RRuleSet,
  SetAlgebra,
  rrulestr,
  Frequency,
  Weekday,
  ALL_WEEKDAYS,
  datetime,
  getToTextLocale,
  listToTextLocales,
  registerToTextLocale,
} from '@rrulenet/rrule';
```

Main exports:
- `RRule`
- `RRuleSet`
- `SetAlgebra`
- `rrulestr`
- `Frequency`
- `Weekday`
- `ALL_WEEKDAYS`
- `datetime`
- `getToTextLocale`
- `listToTextLocales`
- `registerToTextLocale`

Recommended usage:
- choose `@rrulenet/rrule` when you want the familiar class-based compat surface
- choose `@rrulenet/recurrence` when your app boundary is built around the Temporal API
- avoid importing from `@rrulenet/core` directly in application code

## Getting Started

```js
import { RRule, Frequency, datetime } from '@rrulenet/rrule';

const rule = new RRule({
  freq: Frequency.WEEKLY,
  count: 4,
  byweekday: [RRule.MO, RRule.WE],
  dtstart: datetime(2026, 4, 13, 9, 0, 0),
});

console.log(rule.all().map((value) => value.toISOString()));
// [
//   '2026-04-13T09:00:00.000Z',
//   '2026-04-15T09:00:00.000Z',
//   '2026-04-20T09:00:00.000Z',
//   '2026-04-22T09:00:00.000Z'
// ]
```

## Examples

### `RRule`

```js
import { RRule, Frequency, datetime } from '@rrulenet/rrule';

const rule = new RRule({
  freq: Frequency.MONTHLY,
  bymonthday: [1, 15],
  count: 4,
  dtstart: datetime(2026, 1, 1, 9, 0, 0),
});

console.log(rule.toString());
// DTSTART:20260101T090000Z
// RRULE:FREQ=MONTHLY;COUNT=4;BYMONTHDAY=1,15

console.log(rule.toText());
// every month on the 1st and 15th day of the month at 9 AM UTC for 4 times
```

### `RRuleSet`

```js
import { RRule, RRuleSet, Frequency, datetime } from '@rrulenet/rrule';

const set = new RRuleSet();
set.tzid('UTC');
set.rrule(new RRule({
  freq: Frequency.DAILY,
  count: 4,
  dtstart: datetime(2026, 4, 11, 9, 0, 0),
}));
set.exdate(new Date('2026-04-12T09:00:00.000Z'));
set.rdate(new Date('2026-04-20T09:00:00.000Z'));

console.log(set.all().map((value) => value.toISOString()));
// [
//   '2026-04-11T09:00:00.000Z',
//   '2026-04-13T09:00:00.000Z',
//   '2026-04-14T09:00:00.000Z',
//   '2026-04-20T09:00:00.000Z'
// ]

console.log(set.toString());
// DTSTART:20260411T090000Z
// RRULE:FREQ=DAILY;COUNT=4
// RDATE:20260420T090000Z
// EXDATE:20260412T090000Z
```

### `SetAlgebra`

```js
import { RRule, SetAlgebra, Frequency, datetime } from '@rrulenet/rrule';

const expression = SetAlgebra.union(
  new RRule({
    freq: Frequency.WEEKLY,
    count: 3,
    byweekday: [RRule.MO],
    dtstart: datetime(2026, 4, 13, 9, 0, 0),
  }),
  new RRule({
    freq: Frequency.WEEKLY,
    count: 3,
    byweekday: [RRule.WE],
    dtstart: datetime(2026, 4, 15, 9, 0, 0),
  }),
);

console.log(expression.all().map((value) => value.toISOString()));
// [
//   '2026-04-13T09:00:00.000Z',
//   '2026-04-15T09:00:00.000Z',
//   '2026-04-20T09:00:00.000Z',
//   '2026-04-22T09:00:00.000Z',
//   '2026-04-27T09:00:00.000Z',
//   '2026-04-29T09:00:00.000Z'
// ]
```

### `rrulestr()`

```js
import { RRuleSet, rrulestr } from '@rrulenet/rrule';

const parsed = rrulestr([
  'DTSTART;TZID=UTC:20260411T090000',
  'RRULE:FREQ=DAILY;COUNT=2',
  'RDATE:20260415T090000Z',
  'EXDATE:20260412T090000Z',
].join('\n'));

console.log(parsed instanceof RRuleSet);
// true

console.log(parsed.toString());
// DTSTART:20260411T090000Z
// RRULE:FREQ=DAILY;COUNT=2
// RDATE:20260415T090000Z
// EXDATE:20260412T090000Z
```

## Local time and DST (0.2.0)

All supported RFC frequencies use nominal calendar progression in their timezone.
An ambiguous autumn time selects its first passage; a nonexistent spring time
uses the pre-transition offset (RFC 5545, verified erratum 4271). Later periods
return to their nominal time. Spring collisions count once, and COUNT cannot be
combined with UNTIL. Invalid dates such as an implicit September 31 are omitted.
UNTIL exports use UTC.

This changes local subdaily behavior from earlier releases. For a fixed elapsed
cadence, use `Recurrence.elapsed` in `@rrulenet/recurrence`, or a simple UTC rule
when it expresses the required sequence. Explicit RDATE/EXDATE instants retain
both overlap passages; their export uses UTC when needed. A rule whose exact
second-passage DTSTART cannot survive local RFC export throws instead of
silently moving the boundary.

## Selector validation

The constructor, `parseString()`, `fromString()`, and `rrulestr()` throw a
`RangeError` for invalid `byhour`, `byminute`, `bysecond`, `bymonth`, or
`bymonthday` values, including invalid members of a list. The message identifies
the selector and value. Inputs such as `byhour: [9, 25]` are rejected instead
of silently changing the recurrence to 09:00.

`BYSECOND=60` remains accepted and resolves to second 59, following RFC 5545's
fallback for implementations without leap-second support. Collisions count
once and are removed before BYSETPOS. The original selector is preserved by
serialization. Valid negative month days, supported RSCALE leap-month tokens,
and omission of nonexistent generated dates remain supported.

Repeated clock selector members do not shift BYSETPOS positions or consume
COUNT. Serialization preserves the original lists, including repeated values.

BYSETPOS selects from the distinct chronological candidates of a complete
frequency interval, including the whole year for yearly rules spanning months.
Numeric RFC tokens are checked before conversion: empty members, hexadecimal,
exponent, fractional, and unsafe integer tokens are rejected.

Calendar searches return empty results for proven unreachable clock phases.
If a calendar query exhausts its search budget without establishing completeness,
it propagates an error with code `RECURRENCE_SEARCH_LIMIT`; this is not proof of
an empty recurrence.

## Notes

- `RSCALE` and `SKIP` are part of the compat rule model.
- `toText()` and locale registry helpers are available here.
- The same engine also powers the Temporal-first API exposed by `@rrulenet/recurrence`.

## Development

```bash
npm install
npm test
```
