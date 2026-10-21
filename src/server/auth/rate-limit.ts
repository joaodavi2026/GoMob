/**
 * Rate limiting simples em memória (janela deslizante por chave, ex.: IP+email).
 * LIMITAÇÃO: em ambiente serverless (Vercel) cada instância tem sua própria memória e ela
 * é perdida em cold start; o limite é "melhor esforço". Para garantia real use Redis/Upstash.
 */
export type RateLimiter = {
  check(key: string): { allowed: boolean; retryAfterSeconds: number };
  reset(key: string): void;
};

export function createRateLimiter(opts: { max: number; windowMs: number; now?: () => number }): RateLimiter {
  const now = opts.now ?? Date.now;
  const hits = new Map<string, number[]>();
  return {
    check(key) {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((x) => t - x < opts.windowMs);
      if (recent.length >= opts.max) {
        hits.set(key, recent);
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + opts.windowMs - t) / 1000)) };
      }
      recent.push(t);
      hits.set(key, recent);
      if (hits.size > 5000) for (const [k, v] of hits) if (v.every((x) => t - x >= opts.windowMs)) hits.delete(k);
      return { allowed: true, retryAfterSeconds: 0 };
    },
    reset(key) {
      hits.delete(key);
    },
  };
}
