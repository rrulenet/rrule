import { execute } from '../../comparison/execute.mjs';

export function startWorker(engine, lib) {
  self.postMessage({ type: 'ready' });
  self.onmessage = ({ data }) => {
    const result = execute(engine, lib, data, value => self.postMessage({ type: 'progress', ...value }));
    self.postMessage({ type: 'result', ...result });
  };
}
