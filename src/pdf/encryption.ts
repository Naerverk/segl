/**
 * Extension point for password-protected (AES-256) export.
 *
 * NOT IMPLEMENTED in v1 – deliberately. pdf-lib has no encryption support, and we will not ship
 * home-made cryptography. A future implementation should plug a maintained library with real
 * PDF 2.0 / AES-256 (R6) support (for example a WebAssembly build of qpdf) into this interface
 * and be verified against Acrobat, Preview, Chrome/PDFium and Firefox/pdf.js before release.
 *
 * The export pipeline produces the final unencrypted bytes in memory; an encryptor would be
 * applied as a last step before creating the download Blob.
 */
export interface PdfEncryptor {
  readonly algorithm: 'AES-256';
  encrypt(pdf: Uint8Array, options: { userPassword: string; ownerPassword?: string }): Promise<Uint8Array>;
}

export const encryptionAvailable = false;
