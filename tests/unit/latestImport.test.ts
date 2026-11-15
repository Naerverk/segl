import { describe, expect, it, vi } from 'vitest';
import { LatestImport } from '../../src/lib/latestImport';

/** A controllable fake import: resolves when `release()` is called, records aborts. */
function fakeLoad(name: string, log: string[]) {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const load = vi.fn(async (signal: AbortSignal) => {
    log.push(`start ${name}`);
    signal.addEventListener('abort', () => log.push(`abort ${name}`));
    await gate;
    return name;
  });
  return { load, release };
}

describe('LatestImport', () => {
  it('A → B → C: only C becomes active; A is aborted, B never starts', async () => {
    const log: string[] = [];
    const disposed: string[] = [];
    const imports = new LatestImport<string>((v) => void disposed.push(v));
    const A = fakeLoad('A', log);
    const B = fakeLoad('B', log);
    const C = fakeLoad('C', log);

    const pa = imports.open(A.load);
    await vi.waitFor(() => expect(A.load).toHaveBeenCalled()); // A is really running
    const pb = imports.open(B.load); // aborts A, waits for it
    const pc = imports.open(C.load); // supersedes B before it starts
    A.release(); // A finishes late (after being aborted)
    await vi.waitFor(() => expect(C.load).toHaveBeenCalled());
    C.release();

    expect(await pa).toBeNull();
    expect(await pb).toBeNull();
    expect(await pc).toBe('C');
    expect(B.load).not.toHaveBeenCalled();
    expect(log).toEqual(['start A', 'abort A', 'start C']);
    expect(disposed).toEqual(['A']); // A's late result is disposed, never activated
  });

  it('opening a new document disposes the previous active one first', async () => {
    const disposed: string[] = [];
    const imports = new LatestImport<string>((v) => void disposed.push(v));
    expect(await imports.open(async () => 'first')).toBe('first');
    expect(await imports.open(async () => 'second')).toBe('second');
    expect(disposed).toEqual(['first']);
  });

  it('requests made before the previous one even started are skipped entirely', async () => {
    const imports = new LatestImport<string>(() => {});
    const a = vi.fn(async () => 'A');
    const b = vi.fn(async () => 'B');
    const pa = imports.open(a);
    const pb = imports.open(b);
    expect(await pa).toBeNull();
    expect(await pb).toBe('B');
    expect(a).not.toHaveBeenCalled();
  });

  it('close() during an import aborts it and nothing becomes active', async () => {
    const log: string[] = [];
    const disposed: string[] = [];
    const imports = new LatestImport<string>((v) => void disposed.push(v));
    const A = fakeLoad('A', log);
    const pa = imports.open(A.load);
    await vi.waitFor(() => expect(A.load).toHaveBeenCalled());
    const closing = imports.close();
    A.release();
    await closing;
    expect(await pa).toBeNull();
    expect(log).toContain('abort A');
    expect(disposed).toEqual(['A']);
  });

  it('a failure of the latest request is reported; failures of superseded ones are not', async () => {
    const imports = new LatestImport<string>(() => {});
    await expect(imports.open(async () => Promise.reject(new Error('bad file')))).rejects.toThrow('bad file');
    const old = imports.open(async (signal) => {
      await new Promise((r) => signal.addEventListener('abort', r));
      throw new Error('aborted');
    });
    const latest = imports.open(async () => 'ok');
    expect(await old).toBeNull();
    expect(await latest).toBe('ok');
  });
});
