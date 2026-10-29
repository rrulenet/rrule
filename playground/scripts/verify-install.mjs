import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { versions } from '../../comparison/cases.mjs';

export function verifyInstall() {
  const base = new URL('../', import.meta.url);
  const require = createRequire(new URL('package.json', base));
  const lock = JSON.parse(readFileSync(new URL('package-lock.json', base)));
  const result = {};
  for (const [name, version] of Object.entries({ rrule: versions.upstream, 'rrule-temporal': versions.temporal, 'rrulenet-published': versions.rrulenet, '@rrulenet/core': versions.core })) {
    const dir = new URL(`node_modules/${name}/`, base);
    const manifest = JSON.parse(readFileSync(new URL('package.json', dir)));
    assert.equal(manifest.name, name === 'rrulenet-published' ? '@rrulenet/rrule' : name);
    assert.equal(manifest.version, version);
    assert.equal(realpathSync(dir), fileURLToPath(dir).replace(/\/$/, ''), 'Use published packages, never workspace links.');
    const entry = require.resolve(name);
    assert(entry.startsWith(fileURLToPath(dir)), 'A checkout must not supply the comparison package.');
    const installed = createRequire(new URL('package.json', dir));
    for (const dependency of Object.keys(manifest.dependencies ?? {}).filter(key => key.startsWith('@rrulenet/'))) {
      assert.equal(realpathSync(installed.resolve(dependency)), realpathSync(require.resolve(dependency)), 'Nested dependency shadow.');
    }
    const locked = lock.packages[`node_modules/${name}`];
    assert(locked.resolved.startsWith('https://registry.npmjs.org/'));
    assert(locked.integrity.startsWith('sha512-'));
    result[name] = { version, integrity: locked.integrity };
  }
  return result;
}
