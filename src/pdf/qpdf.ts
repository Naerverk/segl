import createQpdf from '@neslinesli93/qpdf-wasm';
import { EncryptionError } from './encryptionError';

export { EncryptionError };

interface QpdfRuntime {
  callMain(args: string[]): number;
  FS: { writeFile(path: string, data: Uint8Array): void; readFile(path: string): Uint8Array };
}

/**
 * Encrypts a PDF with qpdf (WebAssembly build of qpdf 12): AES-256, PDF 2.0 security handler
 * revision 6. A fresh qpdf instance is created for every call, so no state is shared between
 * documents. qpdf's console output is discarded; it is never logged (it may name the file).
 *
 * `locateFile` returns the URL (browser) or path (Node) of qpdf.wasm.
 */
export async function encryptWithQpdf(
  pdf: Uint8Array,
  userPassword: string,
  ownerPassword: string,
  locateFile: () => string,
): Promise<Uint8Array> {
  if (!userPassword || !ownerPassword) throw new EncryptionError();
  let qpdf: QpdfRuntime;
  try {
    qpdf = (await createQpdf({
      locateFile,
      print: () => {},
      printErr: () => {},
    } as Parameters<typeof createQpdf>[0])) as unknown as QpdfRuntime;
  } catch {
    throw new EncryptionError();
  }

  let code: number;
  try {
    qpdf.FS.writeFile('/in.pdf', pdf);
    code = qpdf.callMain([
      '--encrypt',
      `--user-password=${userPassword}`,
      `--owner-password=${ownerPassword}`,
      '--bits=256',
      '--',
      '/in.pdf',
      '/out.pdf',
    ]);
  } catch (e) {
    // Emscripten reports a non-zero exit as an exception carrying the status.
    code = typeof (e as { status?: unknown })?.status === 'number' ? (e as { status: number }).status : 2;
  }
  // qpdf exit codes: 0 = success, 3 = success with warnings, anything else = failure.
  if (code !== 0 && code !== 3) throw new EncryptionError();
  try {
    return qpdf.FS.readFile('/out.pdf');
  } catch {
    throw new EncryptionError();
  }
}
