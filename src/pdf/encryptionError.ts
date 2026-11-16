/** The PDF could not be encrypted. Never carries passwords or document contents. */
export class EncryptionError extends Error {
  constructor() {
    super('PDF encryption failed');
    this.name = 'EncryptionError';
  }
}
