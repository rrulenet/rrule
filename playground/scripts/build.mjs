import { build } from 'esbuild';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { verifyInstall } from './verify-install.mjs';
import { versions, limits } from '../../comparison/cases.mjs';

const root = new URL('../', import.meta.url);
const out = new URL('site/', root);
const installation = verifyInstall();
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const common = { absWorkingDir: fileURLToPath(root), bundle: true, platform: 'browser', format: 'esm', target: ['es2022'], minify: true, legalComments: 'linked', metafile: true };
const graphs = {};
for (const [engine, packageName] of [['upstream', 'rrule'], ['temporal', 'rrule-temporal'], ['rrulenet', 'rrulenet-published']]) {
  const result = await build({ ...common, stdin: { contents: `import * as lib from '${packageName}'; import { startWorker } from './src/browser-worker.mjs'; startWorker('${engine}', lib);`,
    resolveDir: fileURLToPath(root), sourcefile: `worker-${engine}.mjs` }, outfile: fileURLToPath(new URL(`engine-${engine}.js`, out)) });
  const modules = Object.keys(result.metafile.inputs);
  assert(modules.some(path => path.includes(`node_modules/${packageName}/`)), 'Bundle must include the pinned registry package.');
  assert(!modules.some(path => /(^|\/)src\/(RRule|RuleSource)\./.test(path)), 'Local library source leaked into the playground.');
  graphs[engine] = modules;
}
await build({ ...common, entryPoints: ['src/app.mjs'], outfile: fileURLToPath(new URL('app.js', out)) });
await cp(new URL('index.html', root), new URL('index.html', out));
await cp(new URL('src/style.css', root), new URL('style.css', out));
await cp(new URL('../assets/avatar.svg', root), new URL('avatar.svg', out));
await writeFile(new URL('.nojekyll', out), '');
await writeFile(new URL('versions.json', out), JSON.stringify({ versions, limits, installation, graphs }, null, 2) + '\n');
const packages = [...new Set(Object.values(graphs).flat().map(path => path.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)?.[1]).filter(Boolean))].sort();
let notices = 'Third-party packages included in the browser workers\n\n';
for (const name of packages) {
  const directory = new URL(`node_modules/${name}/`, root);
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
console.log(`Static playground built at ${fileURLToPath(out)}. Published dependencies verified.`);
