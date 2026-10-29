import { Worker } from 'node:worker_threads';
import { limits } from '../../comparison/cases.mjs';

export function runCase(engine, request) {
  return new Promise(resolve => {
    const worker = new Worker(new URL('./node-worker.mjs', import.meta.url), { workerData: { engine }, resourceLimits: { maxOldGenerationSizeMb: 128 } });
    let stage = 'loading';
    let serialized;
    let done = false;
    let timer = setTimeout(() => finish({ status: 'runner-error', message: 'Worker startup timed out.' }), limits.startupMs);
    function finish(value) {
      if (done) return;
      done = true; clearTimeout(timer); void worker.terminate(); resolve({ ...value, lastStage: stage, ...(serialized ? { serialized } : {}) });
    }
    worker.on('message', value => {
      if (value.type === 'ready') {
        clearTimeout(timer); stage = 'construction';
        timer = setTimeout(() => finish({ status: 'timeout', timeoutMs: limits.timeoutMs }), limits.timeoutMs);
        worker.postMessage(request);
      } else if (value.type === 'progress') { stage = value.stage; serialized = value.serialized; }
      else if (value.type === 'result') finish(value);
    });
    worker.on('error', error => finish({ status: 'runner-error', message: error.message }));
    worker.on('exit', code => { if (!done) finish({ status: 'runner-error', message: `Worker exited (${code}).` }); });
  });
}
