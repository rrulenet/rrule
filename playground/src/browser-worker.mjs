import { getPreview } from './preview.mjs';

self.onmessage = ({ data }) => {
  try {
    self.postMessage({ result: getPreview(data) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error), code: error?.code });
  }
};
