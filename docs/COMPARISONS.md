# Comparisons

## [`rrule.js`](https://github.com/jkbrzt/rrule)

`@rrulenet/rrule` keeps the familiar API shape while extending it with a maintained engine, timezone-aware querying, and a broader composition surface.

| Capability | `rrule.js` | `@rrulenet/rrule` | Notes |
| --- | --- | --- | --- |
| `rrule.js`-compatible public API | ✅ | ✅ | `@rrulenet/rrule` is intentionally shaped for familiar adoption |
| Maintained engine within the `@rrulenet` stack | ❌ | ✅ | `@rrulenet/rrule` shares its engine with `@rrulenet/core` and `@rrulenet/recurrence` |
| Timezone-aware bounded queries as a core concern | ❌ | ✅ | Important for DST-sensitive product usage |
| First-class `SetAlgebra` API | ❌ | ✅ | Beyond `RRuleSet` alone |
| `toText()` for rules, sets, and set expressions | ❌ | ✅ | `rrule.js` focuses on rule text, not structural set text |
| Shipped `toText()` locale registry | ❌ | ✅ | `@rrulenet/rrule` ships locale registration helpers in the main package |
| `RSCALE` / `SKIP` support on the supported surface | ❌ | ✅ | Present in this package’s current feature surface |

## [`rrule-temporal`](https://github.com/ggaabe/rrule-temporal)

`rrule-temporal` is an important Temporal-native reference point; `@rrulenet/rrule` differs mainly in API compatibility and public set composition.

| Capability | `rrule-temporal` | `@rrulenet/rrule` | Notes |
| --- | --- | --- | --- |
| `rrule.js`-compatible public API | ❌ | ✅ | `@rrulenet/rrule` stays close to the classic API shape |
| Dedicated Temporal-native public surface | ✅ | ❌ | The Temporal-first public API in this ecosystem lives in `@rrulenet/recurrence`, not in `@rrulenet/rrule` |
| First-class `RRuleSet` API | ❌ | ✅ | `rrule-temporal` centers a single rule type with `rDate` / `exDate` options |
| `SetAlgebra` as a first-class public API | ❌ | ✅ | Structural unions and differences are explicit here |
| `toText()` for rules, sets, and set expressions | ❌ | ✅ | `@rrulenet/rrule` exposes one text surface across all three |
| Shipped locale registry in the main package | ❌ | ✅ | `rrule-temporal` ships multiple languages, but not the same registry API |
| Migration path from `rrule.js` codebases | ❌ | ✅ | Lower-friction adoption path here |

## [`rrule-rust`](https://github.com/lsndr/rrule-rust)

`rrule-rust` is the stronger choice when raw throughput dominates; `@rrulenet/rrule` is the simpler fit when JS-native deployment and API familiarity matter more.

| Capability | `rrule-rust` | `@rrulenet/rrule` | Notes |
| --- | --- | --- | --- |
| Higher raw performance | ✅ | ❌ | `rrule-rust` is the stronger choice when throughput is the primary concern |
| Pure JavaScript main distribution | ❌ | ✅ | `rrule-rust` is Rust-powered |
| Simpler fit for Worker-style JS runtimes | ❌ | ✅ | Browser/WASM support is currently documented separately on an `alpha` path |
| `rrule.js`-compatible public API | ❌ | ✅ | `@rrulenet/rrule` keeps the classic mental model |
| Dedicated Temporal API in the same ecosystem | ❌ | ✅ | Provided by `@rrulenet/recurrence`, while `@rrulenet/rrule` stays focused on compat |
| First-class `SetAlgebra` API | ❌ | ✅ | `rrule-rust` exposes `RRuleSet`, but not an equivalent set algebra surface |
| Built-in `toText()` with locale registry | ❌ | ✅ | Included directly in the main package |

## [`@rrulenet/recurrence`](https://www.npmjs.com/package/@rrulenet/recurrence)

Within the same ecosystem, `@rrulenet/rrule` and `@rrulenet/recurrence` are complementary rather than competing packages.

| Capability | `@rrulenet/rrule` | `@rrulenet/recurrence` | Notes |
| --- | --- | --- | --- |
| Main public model | `RRule` / `RRuleSet` / `rrulestr()` | `Recurrence` | `rrule` keeps the classic split; `recurrence` centers a single type |
| API boundary type | `Date` | `Temporal` | `rrule` stays compat-oriented; `recurrence` is Temporal-first |
| Best fit for `rrule.js` migrations | ✅ | ❌ | `rrule` is the migration path |
| Best fit for new Temporal-native apps | ❌ | ✅ | `recurrence` is the modern application-facing API |
| Algebraic composition (`union`, `intersection`, `difference`) | ✅ | ✅ | Both support composition, but `recurrence` makes it central |
| Native JSON persistence format | Limited | ✅ | `recurrence` exposes `toJSON()` / `fromJSON()` |
| RFC 5545 parsing | ✅ | ✅ | Both can parse RFC-style strings |
| RFC 5545 as the shape of the public API | ✅ | ❌ | `rrule` stays close to the classic format model; `recurrence` is API-first |
