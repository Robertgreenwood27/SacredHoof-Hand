import "server-only";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitStore = typeof globalThis & {
  __sacredHoofRateLimits?: Map<string, RateLimitEntry>;
};

const globalStore = globalThis as RateLimitStore;
const store =
  globalStore.__sacredHoofRateLimits ??
  (globalStore.__sacredHoofRateLimits = new Map<string, RateLimitEntry>());

function requestKey(request: Request): string {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim();
  if (ip) return ip.slice(0, 100);

  // Development and non-proxy deployments may not provide an IP. Keeping a
  // short user-agent suffix avoids one global anonymous bucket.
  return `unknown:${(request.headers.get("user-agent") ?? "client").slice(0, 120)}`;
}

/**
 * Lightweight per-instance abuse brake. Production should additionally use
 * edge/WAF rate limiting because serverless instances do not share memory.
 */
export function consumeRateLimit({
  request,
  scope,
  limit,
  windowMs,
}: {
  request: Request;
  scope: string;
  limit: number;
  windowMs: number;
}): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const key = `${scope}:${requestKey(request)}`;
  const current = store.get(key);
  const entry =
    !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;
  entry.count += 1;
  store.set(key, entry);

  if (store.size > 2_000) {
    for (const [candidate, value] of store) {
      if (value.resetAt <= now) store.delete(candidate);
    }
  }

  return {
    allowed: entry.count <= limit,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((entry.resetAt - now) / 1_000),
    ),
  };
}
