import { build } from 'esbuild';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { verifyInstall } from './verify-install.mjs';

const root = new URL('../', import.meta.url);
const out = new URL('site/', root);
const installation = verifyInstall();
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const common = { absWorkingDir: fileURLToPath(root), bundle: true, platform: 'browser', format: 'esm', target: ['es2022'], minify: true, legalComments: 'linked' };
const result = await build({
  ...common,
  entryPoints: ['src/browser-worker.mjs'],
  outfile: fileURLToPath(new URL('engine.js', out)),
  // Use full calendar support when the browser falls back to the polyfill.
  alias: { 'temporal-polyfill': 'temporal-polyfill/full' },
  metafile: true,
});
const modules = Object.keys(result.metafile.inputs);
assert(modules.some(path => path.includes('node_modules/@rrulenet/rrule/')), 'The bundle must use the pinned registry package.');
assert(!modules.some(path => /(^|\/)src\/(RRule|RuleSource)\./.test(path)), 'Local library source leaked into the playground.');
await build({ ...common, entryPoints: ['src/app.mjs'], outfile: fileURLToPath(new URL('app.js', out)),
  define: { __RRULENET_VERSION__: JSON.stringify(installation['@rrulenet/rrule'].version) } });
await cp(new URL('index.html', root), new URL('index.html', out));
await cp(new URL('src/style.css', root), new URL('style.css', out));
await cp(new URL('../assets/avatar.svg', root), new URL('avatar.svg', out));
await writeFile(new URL('.nojekyll', out), '');
await writeFile(new URL('versions.json', out), JSON.stringify({ installation }, null, 2) + '\n');

const packages = new Map();
for (const path of modules) {
  const match = path.match(/^(.*?node_modules\/((?:@[^/]+\/)?[^/]+))\//);
  if (match) packages.set(match[2], new URL(`${match[1]}/`, root));
}
let notices = 'Packages included in the recurrence worker\n\n';
for (const [name, directory] of [...packages.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const manifest = JSON.parse(await readFile(new URL('package.json', directory)));
  const licenses = (await readdir(directory)).filter(name => /^licen[sc]e(?:\.(?:txt|md))?$/i.test(name));
  assert(licenses.length, `Missing license text for bundled dependency ${name}.`);
  notices += `${manifest.name}@${manifest.version}\n${'='.repeat(60)}\n`;
  for (const license of licenses) notices += `${await readFile(new URL(license, directory), 'utf8')}\n\n`;
}
await writeFile(new URL('THIRD_PARTY_NOTICES.txt', out), notices);
if (process.argv.includes('--with-coverage')) {
  const file = new URL('../../badges/coverage.json', import.meta.url);
  const badge = JSON.parse(await readFile(file));
  assert.equal(badge.label, 'coverage');
  assert.match(badge.message, /^\d+(\.\d+)?%$/);
  await cp(file, new URL('coverage.json', out));
}
console.log(`Static playground built at ${fileURLToPath(out)}.`);
