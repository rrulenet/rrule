import { parentPort, workerData } from 'node:worker_threads';
import { createRequire } from 'node:module';
import { execute } from '../../comparison/execute.mjs';
const require = createRequire(import.meta.url);
const lib = workerData.engine === 'upstream' ? require('rrule') : workerData.engine === 'temporal' ? await import('rrule-temporal') : await import('rrulenet-published');
parentPort.postMessage({ type: 'ready' });
parentPort.once('message', request => {
  const result = execute(workerData.engine, lib, request, value => parentPort.postMessage({ type: 'progress', ...value }));
  parentPort.postMessage({ type: 'result', ...result });
});
