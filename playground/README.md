# RRULE Playground

The static playground runs the published `@rrulenet/rrule` package. The builder
supports each frequency, DTSTART, COUNT or UNTIL, week starts, date and time
selectors, calendar extensions, and date exceptions. Use **RRULE text** for
multi-rule sets and syntax outside the builder.

## Run locally

From this directory:

```sh
npm ci --ignore-scripts --workspaces=false
npm test
npm run build
npm run preview
```

Open [the local playground](http://127.0.0.1:4173/rrule/). To run the browser
suite, make `agent-browser` available on your PATH and run
`npm run test:browser` after building. The suite starts its own preview server
and checks desktop and mobile layouts.

## Share and reproduce

The URL updates as you edit, with the recurrence in `rrule` and the preview size
in `limit`. **Copy share link** copies the current rule and preview size. Links
created in the builder reopen in the builder. A rule pasted without DTSTART uses
the builder's displayed start, which is included in the link. If the builder
cannot serialize an incomplete edit, the URL keeps the previous rule. The
JavaScript panel contains the equivalent `rrulestr()` call.

Use **Query a date or range** for `after()`, `before()`, and `between()`.
Enter boundaries in the selected display time zone. The calendar marks only
the occurrences in the current preview. All-day results are displayed as
calendar dates.

The main thread runs the preview in a worker and can stop a long query.
The build verifies exact registry pins, generates `versions.json` and
third-party notices, and accepts `--with-coverage` for the Pages workflow.
