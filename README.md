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

`@rrulenet/rrule` provides a classic `rrule.js`-style API backed by the shared
`@rrulenet` engine. Use it for existing applications built around `Date`,
`RRule` and `RRuleSet`. For a Temporal-first API with native JSON persistence,
see [`@rrulenet/recurrence`](https://github.com/rrulenet/recurrence).

## Install

```bash
npm install @rrulenet/rrule
```

Requires Node.js 20 or later when used with Node. Native Temporal is used where
available; the included polyfill covers other runtimes.

## Getting started

```js
import { RRule, Frequency, datetime } from '@rrulenet/rrule';

const rule = new RRule({
  freq: Frequency.WEEKLY,
  byweekday: [RRule.MO, RRule.WE],
  count: 4,
  dtstart: datetime(2026, 4, 13, 9, 0, 0),
});

console.log(rule.all().map((date) => date.toISOString()));
// [
//   '2026-04-13T09:00:00.000Z',
//   '2026-04-15T09:00:00.000Z',
//   '2026-04-20T09:00:00.000Z',
//   '2026-04-22T09:00:00.000Z'
// ]
```

## API overview

| API | Purpose |
| --- | --- |
| `RRule` | Construct, query and serialize a rule |
| `RRuleSet` | Combine rules, explicit dates and exclusions |
| `rrulestr()` | Parse RFC-style recurrence strings |
| `SetAlgebra` | Compose unions, intersections and differences |
| `datetime()` | Construct a UTC `Date` from date/time components |
| `toText()` and locale helpers | Describe rules and composed schedules |

Occurrence queries return `Date` values. Use `between()` for a bounded range,
`after()` or `before()` for a directional query, and `iterate()` or the
`all(callback)` form to stop generation early. An unbounded `all()` without a
callback returns a finite preview, not the complete series.

See the [API reference and examples](https://github.com/rrulenet/rrule/blob/main/docs/API.md)
for `RRuleSet`, `SetAlgebra`, parsing and locale registration.

## Timezones and validation

Calendar frequencies advance on the local clock. Autumn overlaps select the
first passage; spring gaps use the pre-transition offset, then later periods
return to their nominal time. Explicit dates preserve their exact instants,
including a second autumn passage. For a fixed elapsed cadence, use
`Recurrence.elapsed()` in `@rrulenet/recurrence`.

COUNT and UNTIL are mutually exclusive. Invalid selectors throw a `RangeError`;
valid selectors that produce nonexistent calendar dates omit those dates.
RSCALE/SKIP policies are supported for calendar extensions. RFC export rejects
expressions whose temporal meaning it cannot preserve.

A query that exhausts its search budget throws an error with code
`RECURRENCE_SEARCH_LIMIT`. Handle it separately from an empty result.
