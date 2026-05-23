// In-memory idempotency cache keyed by (scope:idempotency-key).
// 10-minute TTL with bounded size + periodic sweep so a flood of unique keys
// can't OOM the process.

type CacheEntry = { status: number; body: unknown; expiresAt: number };

const MAX_ENTRIES = 2000;
const TTL_MS = 10 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

const cache = new Map<string, CacheEntry>();

export function idemKey(scope: string, key: string): string {
  return `${scope}::${key}`;
}

export function getCached(scope: string, key: string): CacheEntry | undefined {
  const k = idemKey(scope, key);
  const hit = cache.get(k);
  if (!hit) return undefined;
  if (hit.expiresAt < Date.now()) {
    cache.delete(k);
    return undefined;
  }
  // LRU: re-insert to move to the end
  cache.delete(k);
  cache.set(k, hit);
  return hit;
}

export function setCached(scope: string, key: string, status: number, body: unknown): void {
  const k = idemKey(scope, key);
  if (cache.has(k)) cache.delete(k); // refresh insertion order
  cache.set(k, { status, body, expiresAt: Date.now() + TTL_MS });
  if (cache.size > MAX_ENTRIES) {
    // Evict oldest until we're back under the cap. Map iteration is insertion order.
    const evictCount = cache.size - MAX_ENTRIES;
    let i = 0;
    for (const oldKey of cache.keys()) {
      if (i++ >= evictCount) break;
      cache.delete(oldKey);
    }
  }
}

export function clearIdempotencyCache(): void {
  cache.clear();
}

// Periodic sweep for expired entries. Started lazily on first import.
let sweepTimer: NodeJS.Timeout | null = null;
function startSweep() {
  if (sweepTimer || process.env.NODE_ENV === "test") return;
  sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (v.expiresAt < now) cache.delete(k);
    }
  }, SWEEP_INTERVAL_MS);
  sweepTimer.unref();
}
startSweep();

// For diagnostics
export function idempotencyCacheStats(): { size: number; maxEntries: number } {
  return { size: cache.size, maxEntries: MAX_ENTRIES };
}
