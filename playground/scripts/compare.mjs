import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { cases, versions, engines, assess } from '../../comparison/cases.mjs';
import { runCase } from './run-case.mjs';
import { verifyInstall } from './verify-install.mjs';

const installation = verifyInstall(); const results = []; const failures = [];
for (const fixture of cases) {
  for (const engine of engines) {
    const actual = await runCase(engine, { text: fixture.text, maximum: 10 });
    const verdict = assess(actual, fixture.expected, 10);
    results.push({ id: fixture.id, engine, actual, verdict });
    const known = fixture.knownMismatch?.[engine];
    if (actual.status === 'runner-error' || (fixture.control && verdict.kind !== 'correct')
      || (engine === 'rrulenet' && !known && verdict.kind !== 'correct')
      || (known && verdict.kind !== 'incorrect')) failures.push({ id: fixture.id, engine, actual, verdict });
  }
}
await mkdir(new URL('../reports/', import.meta.url), { recursive: true });
const output = new URL(`../reports/${process.version}-${(process.env.TZ ?? 'host').replaceAll('/', '-')}.json`, import.meta.url);
await writeFile(output, JSON.stringify({ versions, installation, node: process.version, host: Intl.DateTimeFormat().resolvedOptions().timeZone, results }, null, 2) + '\n');
for (const failure of failures) console.error(JSON.stringify(failure));
const known = results.filter(row => cases.find(value => value.id === row.id).knownMismatch?.[row.engine]);
console.log(`${cases.length} curated examples × 3 published engines; ${failures.length} unexpected failures; ${known.length} acknowledged @rrulenet 0.2.1 limitation. Report: ${output.pathname}`);
assert.equal(failures.length, 0);
