# Three-library recurrence playground

Paste an RRULE/iCalendar snippet or choose a predefined plain-English schedule.
The same text is passed to npm **rrule 2.8.1**, **rrule-temporal 2.2.8** and
**@rrulenet/rrule 0.2.1** (core 0.2.1). Natural-language examples are a static
mapping; no AI service or natural-language translation runs in this page.

## Review locally

On Node 22 or 24, from `playground/`:

```sh
npm ci --ignore-scripts --workspaces=false
npm test
npm run compare
npm run build
npm run preview
```

Open **http://127.0.0.1:4173/rrule/**. Choose an example to run automatically;
edited text runs on Compare results. Each library has its own output and a
copyable reproduction using its public API. Published output types remain Date
or Temporal; the preview displays UTC instants consistently.

Share links support both query parameters and fragments:

- `?example=last-weekday`
- `?rrule=<URL-encoded DTSTART and RRULE text>&limit=10`
- `#example=676-byhour` or `#rrule=<encoded text>`

Include an explicit DTSTART or RDATE. The original text is not rewritten to
insert a COUNT. For an open-ended rule, the preview reads a finite prefix using
the library's iterator or forward queries. The preview length can be 5, 10 or
20. Links contain the recurrence data you choose to share.

## Interpreting the comparison

The nine [shared examples](../comparison/cases.mjs) are deliberately small and
practical. They include schedules that all libraries handle, selection/input
differences, recurrence-set composition, and a known @rrulenet 0.2.1 leap-day
limitation. The page discloses its @rrulenet maintainer affiliation.

- **Correct / incorrect** uses a stated expected result for an unchanged curated
  example. Its rationale and primary sources are available in one disclosure.
- **Invalid input rejected / accepted** tests an explicit validation contract;
  the RFC defines valid ranges without mandating a JavaScript exception.
- **Not supported** marks an API/extension boundary, while retaining actual
  returned values if the library produced any. In particular, several RRULE
  lines describe the classic libraries' set convention, not multiple RRULE
  properties in one RFC 5545 VEVENT. RRuleTemporal 2.2.8 exposes a single rule.
- **Search limit / time limit** is not a claim of an incorrect date or an
  infinite loop. The worker is stopped after two seconds, excluding loading.
- **Custom RRULEs** remain observations without a correctness verdict. A raw
  named-zone Date difference alone is not proof of a rrule.js bug; its documented
  floating/UTC conventions matter.

Each engine runs independently, with a 15-second startup limit and a two-second
calculation limit. The demo limits input to 16,000 characters and COUNT to 1,000.
These are preview restrictions, not library validation behavior. Worker isolation
does not impose a browser memory quota. This page is not a benchmark or a complete
RFC conformance suite. All library defaults are retained; reproductions show the
exact constructor used. The invalid-hour case was also checked with temporal's
strict mode, with the same observed acceptance in 2.2.8.

## Development and CI

The examples and [`execute.mjs`](../comparison/execute.mjs) are shared by Node
workers and browser workers. Each adapter uses the documented API. The separate
package name, npm alias and lockfile prevent this repository's development code
from supplying a comparison engine. Build checks verify versions, registry
integrities, absence of workspace links and the selected core dependency.

`npm run compare` reruns all three releases and writes ignored reports. Positive
controls and unexpected @rrulenet regressions fail CI. The known leap-day
counterexample is explicit in the corpus and remains graded incorrect on the
page; it is not silently counted as a success. Reference changes require a
source or independently justified date sequence, not copying an engine result.

Browser checks use desktop UTC, desktop New York and mobile Paris contexts:

```sh
npx playwright install chromium
npm run test:browser
```

For an installed local Chrome, use `PLAYWRIGHT_CHANNEL=chrome npm run test:browser`.
The Node CI matrix covers Node 22/24 in UTC, New York and Kiritimati.

The existing coverage workflow prepares a single Pages artifact with the page
at `/rrule/` and the unchanged `coverage.json` path. A real coverage badge is
required by `npm run build -- --with-coverage`. Build output includes dependency
license texts and version/integrity metadata. Everything stays local until an
authorized publication; no command above deploys the site.
