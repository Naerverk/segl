/**
 * Small LRU cache for object URLs, bounded by entry count AND total bytes. Evicted and cleared
 * entries are revoked so rendered page images do not linger in memory.
 */
export class UrlCache<M = unknown> {
  private map = new Map<string, { url: string; meta: M; bytes: number }>();
  private totalBytes = 0;

  constructor(
    private readonly capacity: number,
    private readonly revoke: (url: string) => void = (u) => URL.revokeObjectURL(u),
    private readonly maxBytes = Number.POSITIVE_INFINITY,
  ) {}

  get(key: string): { url: string; meta: M } | undefined {
    const v = this.map.get(key);
    if (v) {
      this.map.delete(key);
      this.map.set(key, v);
    }
    return v;
  }

  set(key: string, url: string, meta: M, bytes = 0): void {
    const old = this.map.get(key);
    if (old) {
      this.totalBytes -= old.bytes;
      if (old.url !== url) this.revoke(old.url);
      this.map.delete(key);
    }
    this.map.set(key, { url, meta, bytes });
    this.totalBytes += bytes;
    // Evict oldest entries, but always keep the newest one.
    while (this.map.size > 1 && (this.map.size > this.capacity || this.totalBytes > this.maxBytes)) {
      const [k, v] = this.map.entries().next().value as [string, { url: string; meta: M; bytes: number }];
      this.map.delete(k);
      this.totalBytes -= v.bytes;
      this.revoke(v.url);
    }
  }

  get size(): number {
    return this.map.size;
  }

  get bytes(): number {
    return this.totalBytes;
  }

  clear(): void {
    for (const v of this.map.values()) this.revoke(v.url);
    this.map.clear();
    this.totalBytes = 0;
  }
}
