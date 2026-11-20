import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function verifyInstall() {
  const base = new URL('../', import.meta.url);
  const manifestURL = new URL('package.json', base);
  const require = createRequire(manifestURL);
  const manifest = JSON.parse(readFileSync(manifestURL));
  const lock = JSON.parse(readFileSync(new URL('package-lock.json', base)));
  const result = {};
  for (const [name, version] of Object.entries(manifest.dependencies)) {
    const dir = new URL(`node_modules/${name}/`, base);
    const installedURL = new URL('package.json', dir);
    const installed = JSON.parse(readFileSync(installedURL));
    assert.equal(installed.name, name);
    assert.equal(installed.version, version);
    assert.equal(realpathSync(dir), fileURLToPath(dir).replace(/\/$/, ''), 'Use published packages with no workspace links.');
    assert(require.resolve(name).startsWith(fileURLToPath(dir)), 'A checkout must not supply the playground engine.');
    const resolveFromDependency = createRequire(installedURL);
    for (const dependency of Object.keys(installed.dependencies ?? {}).filter(key => Object.hasOwn(manifest.dependencies, key))) {
      assert.equal(realpathSync(resolveFromDependency.resolve(dependency)), realpathSync(require.resolve(dependency)), 'Nested dependency shadow.');
    }
    const locked = lock.packages[`node_modules/${name}`];
    assert(locked.resolved.startsWith('https://registry.npmjs.org/'));
    assert(locked.integrity.startsWith('sha512-'));
    result[name] = { version, integrity: locked.integrity };
  }
  return result;
}
