// In-memory idempotency cache keyed by (scope:idempotency-key).
// 10-minute TTL. Single-process; that's fine for V0.

type CacheEntry = { status: number; body: unknown; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 10 * 60 * 1000;

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
  return hit;
}

export function setCached(scope: string, key: string, status: number, body: unknown): void {
  cache.set(idemKey(scope, key), { status, body, expiresAt: Date.now() + TTL_MS });
}

export function clearIdempotencyCache(): void {
  cache.clear();
}
