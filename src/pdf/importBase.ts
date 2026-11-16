// Import limits and errors without any PDF engine dependency, so the start page can use them
// without loading PDF.js or pdf-lib (those are loaded only when a file is opened).

export const MAX_FILE_BYTES = 300 * 1024 * 1024;
export const MAX_PAGES = 2000;

export type ImportErrorCode =
  | 'not-pdf'
  | 'too-large'
  | 'too-many-pages'
  | 'image-too-large'
  | 'too-complex'
  | 'invalid'
  | 'password-cancelled'
  | 'read-failed'
  | 'cancelled';

export class ImportError extends Error {
  constructor(public readonly code: ImportErrorCode) {
    // Never include document contents or file names in error messages.
    super(`PDF import failed: ${code}`);
    this.name = 'ImportError';
  }
}
