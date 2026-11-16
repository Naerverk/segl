import { describe, expect, it } from 'vitest';
import { decrypt, readMessage } from 'openpgp';
import { createOneTimeLink, OneTimeLinkError } from '../../src/share/oneTimeLink';

const SERVER = 'https://hemmelig.example';
const SECRET = 'k7mq-x4tz-9prw-h2nc-vd6j';

function fakeServer(response: { status?: number; body?: unknown } = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(response.body ?? { message: 'AbCdEf1234567890xyzQ' }), { status: response.status ?? 200 });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

describe('createOneTimeLink', () => {
  it('sends only an OpenPGP ciphertext; the key stays in the link fragment', async () => {
    const { calls, fetchImpl } = fakeServer();
    const link = await createOneTimeLink({ serverUrl: SERVER, secret: SECRET, lifetimeSeconds: 86400, fetchImpl });

    const m = link.match(/^https:\/\/hemmelig\.example\/#\/s\/(AbCdEf1234567890xyzQ)\/([A-Za-z0-9]{22})$/);
    expect(m).not.toBeNull();
    const key = m![2];

    expect(calls).toHaveLength(1);
    const { url, init } = calls[0];
    expect(url).toBe(`${SERVER}/create/secret`);
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('omit');
    expect(init.referrerPolicy).toBe('no-referrer');

    const body = JSON.parse(String(init.body));
    expect(Object.keys(body).sort()).toEqual(['expiration', 'message', 'one_time']);
    expect(body.one_time).toBe(true);
    expect(body.expiration).toBe(86400);
    // Neither the password nor the key are sent in clear text.
    expect(String(init.body)).not.toContain(SECRET);
    expect(String(init.body)).not.toContain(key);
    expect(body.message).toMatch(/^-----BEGIN PGP MESSAGE-----/);

    // The recipient (Yopass web app) can decrypt it with the key from the link.
    const { data } = await decrypt({ message: await readMessage({ armoredMessage: body.message }), passwords: key });
    expect(data).toBe(SECRET);
  });

  it('uses a new key every time', async () => {
    const { fetchImpl } = fakeServer();
    const a = await createOneTimeLink({ serverUrl: SERVER, secret: SECRET, lifetimeSeconds: 3600, fetchImpl });
    const b = await createOneTimeLink({ serverUrl: SERVER, secret: SECRET, lifetimeSeconds: 3600, fetchImpl });
    expect(a.split('/').pop()).not.toBe(b.split('/').pop());
  });

  it('only accepts the lifetimes the server allows', async () => {
    const { fetchImpl, calls } = fakeServer();
    await expect(createOneTimeLink({ serverUrl: SERVER, secret: SECRET, lifetimeSeconds: 999 as never, fetchImpl })).rejects.toBeInstanceOf(OneTimeLinkError);
    expect(calls).toHaveLength(0);
  });

  it('rejects server errors and IDs that could point elsewhere', async () => {
    for (const bad of [{ status: 500 }, { body: { message: '../secret/x' } }, { body: { message: 'abc?x=1#' } }, { body: {} }]) {
      const { fetchImpl } = fakeServer(bad);
      await expect(createOneTimeLink({ serverUrl: SERVER, secret: SECRET, lifetimeSeconds: 86400, fetchImpl })).rejects.toBeInstanceOf(OneTimeLinkError);
    }
  });

  it('reports network failures', async () => {
    const fetchImpl = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    await expect(createOneTimeLink({ serverUrl: SERVER, secret: SECRET, lifetimeSeconds: 86400, fetchImpl })).rejects.toMatchObject({ reason: 'network' });
  });
});
