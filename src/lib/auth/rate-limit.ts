import "server-only";

/**
 * Minimal in-memory sliding-window rate limiter. Suitable for a single-node
 * internal app. For multi-node deployments, swap for a shared store (Redis).
 */
const buckets = new Map<string, number[]>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    const retryAfterMs = windowMs - (now - arr[0]);
    buckets.set(key, arr);
    return { ok: false, retryAfterMs };
  }
  arr.push(now);
  buckets.set(key, arr);
  return { ok: true, retryAfterMs: 0 };
}

/** Best-effort client IP from forwarded headers. */
export function clientKey(req: Request, prefix = ""): string {
  const h = req.headers;
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "local";
  return `${prefix}:${ip}`;
}
