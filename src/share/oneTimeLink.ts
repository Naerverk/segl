import { randomString } from '../lib/random';

/**
 * One-time links for the password, created on a Yopass server (hemmelig.naerverk.no).
 *
 * Works exactly like the Yopass web app: a random key is generated in the browser, the password
 * is encrypted with it (OpenPGP, AES with GCM), and only the ciphertext is sent. The key is
 * placed after `#` in the link, which browsers never send to any server. The server can
 * therefore not read the password, and the link works once.
 *
 * Only the password is sent – never the document, its name or anything else. OpenPGP.js
 * (LGPL-3.0) is loaded on demand, the first time a link is created.
 */

/** Lifetimes the Yopass server accepts without custom expiration (seconds). */
export const LINK_LIFETIMES = [3600, 86400, 604800] as const;
export type LinkLifetime = (typeof LINK_LIFETIMES)[number];
export const DEFAULT_LINK_LIFETIME: LinkLifetime = 86400;

/** Same key format as the Yopass web app: 22 characters, about 131 bits. */
const KEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const KEY_LENGTH = 22;

export class OneTimeLinkError extends Error {
  constructor(public readonly reason: 'network' | 'rejected' | 'invalid-response') {
    super(`One-time link failed: ${reason}`);
    this.name = 'OneTimeLinkError';
  }
}

export interface OneTimeLinkOptions {
  /** Base URL of the Yopass server, e.g. https://hemmelig.naerverk.no */
  serverUrl: string;
  secret: string;
  lifetimeSeconds: LinkLifetime;
  signal?: AbortSignal;
  /** For tests. */
  fetchImpl?: typeof fetch;
}

/** Encrypts a text the same way the Yopass web app does. Exported for tests. */
export async function encryptForYopass(secret: string, key: string): Promise<string> {
  const { createMessage, encrypt, enums } = await import('openpgp');
  return (await encrypt({
    message: await createMessage({ text: secret }),
    passwords: key,
    config: { aeadProtect: true, preferredAEADAlgorithm: enums.aead.gcm },
  })) as string;
}

export async function createOneTimeLink({ serverUrl, secret, lifetimeSeconds, signal, fetchImpl = fetch }: OneTimeLinkOptions): Promise<string> {
  if (!LINK_LIFETIMES.includes(lifetimeSeconds)) throw new OneTimeLinkError('rejected');
  const base = new URL(serverUrl).origin;
  const key = randomString(KEY_ALPHABET, KEY_LENGTH);
  const message = await encryptForYopass(secret, key);

  let res: Response;
  try {
    res = await fetchImpl(`${base}/create/secret`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, expiration: lifetimeSeconds, one_time: true }),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      signal,
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new OneTimeLinkError('network');
  }
  if (!res.ok) throw new OneTimeLinkError('rejected');

  let id: unknown;
  try {
    id = ((await res.json()) as { message?: unknown }).message;
  } catch {
    throw new OneTimeLinkError('invalid-response');
  }
  // The server only issues alphanumeric IDs; anything else could point the link elsewhere.
  if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{8,64}$/.test(id)) throw new OneTimeLinkError('invalid-response');
  return `${base}/#/s/${id}/${key}`;
}
