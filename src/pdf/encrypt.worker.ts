// Runs qpdf (WebAssembly) off the main thread. The worker is terminated after every job, so the
// document bytes and passwords do not stay in memory longer than needed.
import wasmUrl from '@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url';
import { encryptWithQpdf } from './qpdf';

interface EncryptRequest {
  pdf: ArrayBuffer;
  userPassword: string;
  ownerPassword: string;
}

self.onmessage = async (e: MessageEvent<EncryptRequest>) => {
  try {
    const out = await encryptWithQpdf(new Uint8Array(e.data.pdf), e.data.userPassword, e.data.ownerPassword, () => wasmUrl);
    const copy = out.slice();
    (self as unknown as Worker).postMessage({ ok: true, pdf: copy.buffer }, [copy.buffer]);
  } catch {
    (self as unknown as Worker).postMessage({ ok: false });
  }
};
