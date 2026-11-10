// Small in-memory sliding-window rate limiter (single-process server).
export function rateLimit(opts: { windowMs: number; max: number }): (key: string) => boolean {
  const recent = new Map<string, number[]>();
  /** Records a hit for `key`; returns true when the key is over its limit. */
  return (key: string): boolean => {
    const now = Date.now();
    const hits = (recent.get(key) ?? []).filter((t) => now - t < opts.windowMs);
    if (hits.length >= opts.max) {
      recent.set(key, hits);
      return true;
    }
    hits.push(now);
    recent.set(key, hits);
    // opportunistic cleanup so the map doesn't grow forever
    if (recent.size > 5000) {
      for (const [k, v] of recent) if (v.every((t) => now - t >= opts.windowMs)) recent.delete(k);
    }
    return false;
  };
}
