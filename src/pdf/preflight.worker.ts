/// <reference lib="webworker" />
// Runs the structural image pre-check off the main thread, so it can be terminated
// (cancel / file replaced / timeout) and never blocks the UI.
import { preflightImages } from './preflight';

self.onmessage = async (e: MessageEvent<{ bytes: ArrayBuffer }>) => {
  const result = await preflightImages(new Uint8Array(e.data.bytes));
  (self as unknown as Worker).postMessage(result);
};
