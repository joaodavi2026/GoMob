import { SPTRANS_HTTP, SPTRANS_TTL } from "@/config/transit";
import { SptransError } from "./types";

/**
 * Cliente server-side da API Olho Vivo v2.1.
 * Endpoints (documentação oficial):
 *  POST /Login/Autenticar?token=...            -> true | false
 *  GET  /Linha/Buscar?termosBusca=...
 *  GET  /Parada/BuscarParadasPorLinha?codigoLinha=...
 *  GET  /Posicao/Linha?codigoLinha=...
 * O token NUNCA sai do servidor e nunca é logado.
 */
export type SptransClientOptions = {
  token?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  authBackoffMs?: number;
  rateLimitCooldownMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

export type SptransHealth = {
  configured: boolean;
  authenticated: boolean;
  lastQueryAt: number | null;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  lastFailureKind: string | null;
};

type CacheEntry = { value: unknown; expiresAt: number };

export function createSptransClient(opts: SptransClientOptions = {}) {
  const baseUrl = (opts.baseUrl ?? SPTRANS_HTTP.baseUrl).replace(/\/$/, "");
  const f = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? SPTRANS_HTTP.timeoutMs;
  const maxRetries = opts.maxRetries ?? SPTRANS_HTTP.maxRetries;
  const authBackoffMs = opts.authBackoffMs ?? SPTRANS_HTTP.authBackoffMs;
  const rateLimitCooldownMs = opts.rateLimitCooldownMs ?? SPTRANS_HTTP.rateLimitCooldownMs;
  const now = opts.now ?? (() => Date.now());
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const token = opts.token ?? "";

  const cookies = new Map<string, string>();
  let authenticated = false;
  let authPromise: Promise<void> | null = null;
  let authBlockedUntil = 0;
  let rateLimitedUntil = 0;
  const cache = new Map<string, CacheEntry>();
  const inflight = new Map<string, Promise<unknown>>();
  const health: SptransHealth = {
    configured: token.length > 0,
    authenticated: false,
    lastQueryAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastFailureKind: null,
  };

  function storeCookies(res: Response) {
    const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    for (const c of list) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      if (i > 0) cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  }
  const cookieHeader = () => [...cookies].map(([k, v]) => `${k}=${v}`).join("; ");

  async function timedFetch(url: string, init: RequestInit): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await f(url, { ...init, signal: ctrl.signal, cache: "no-store" });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") throw new SptransError("TIMEOUT", "SPTrans request timed out.");
      throw new SptransError("NETWORK", "Could not reach SPTrans.");
    } finally {
      clearTimeout(timer);
    }
  }

  async function login(): Promise<void> {
    if (!token) throw new SptransError("NOT_CONFIGURED", "SPTrans token is not configured.");
    if (now() < authBlockedUntil) throw new SptransError("AUTH", "SPTrans authentication recently failed.");
    const res = await timedFetch(`${baseUrl}/Login/Autenticar?token=${encodeURIComponent(token)}`, { method: "POST" });
    if (res.status === 429) throw new SptransError("RATE_LIMIT", "SPTrans rate limit.", 429);
    if (!res.ok) throw new SptransError("HTTP", `SPTrans login failed (${res.status}).`, res.status);
    const text = (await res.text()).trim().toLowerCase();
    if (text !== "true") {
      authBlockedUntil = now() + authBackoffMs;
      throw new SptransError("AUTH", "SPTrans rejected the credentials.");
    }
    cookies.clear();
    storeCookies(res);
    authenticated = true;
    health.authenticated = true;
  }

  function ensureAuth(): Promise<void> {
    if (authenticated) return Promise.resolve();
    authPromise ??= login().finally(() => {
      authPromise = null;
    });
    return authPromise;
  }

  function invalidateAuth() {
    authenticated = false;
    health.authenticated = false;
    cookies.clear();
  }

  function retryAfterMs(res: Response): number {
    const h = Number(res.headers.get("retry-after"));
    return Number.isFinite(h) && h > 0 ? Math.min(h * 1000, 5 * 60_000) : rateLimitCooldownMs;
  }

  async function fetchJson(path: string): Promise<unknown> {
    let reauthed = false;
    let lastErr: SptransError | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (now() < rateLimitedUntil) throw new SptransError("RATE_LIMIT", "SPTrans rate limit; backing off.", 429);
      try {
        await ensureAuth();
        const res = await timedFetch(`${baseUrl}${path}`, { method: "GET", headers: { Cookie: cookieHeader() } });
        if (res.status === 429) {
          rateLimitedUntil = now() + retryAfterMs(res);
          throw new SptransError("RATE_LIMIT", "SPTrans rate limit.", 429);
        }
        if (res.status === 401 || res.status === 403) {
          invalidateAuth();
          if (!reauthed) {
            reauthed = true;
            attempt--; // reautenticação não consome retry
            continue;
          }
          throw new SptransError("AUTH", "SPTrans session rejected.", res.status);
        }
        if (res.status >= 500) throw new SptransError("HTTP", `SPTrans error (${res.status}).`, res.status);
        if (!res.ok) throw new SptransError("HTTP", `SPTrans request failed (${res.status}).`, res.status);
        let body: unknown;
        try {
          body = await res.json();
        } catch {
          throw new SptransError("BAD_RESPONSE", "SPTrans returned an unreadable response.");
        }
        if (body && typeof body === "object" && !Array.isArray(body) && typeof (body as { Message?: unknown }).Message === "string") {
          // Resposta de "Authorization has been denied for this request." etc.
          invalidateAuth();
          if (!reauthed) {
            reauthed = true;
            attempt--;
            continue;
          }
          throw new SptransError("AUTH", "SPTrans session rejected.");
        }
        return body;
      } catch (e) {
        const err = e instanceof SptransError ? e : new SptransError("NETWORK", "Unexpected SPTrans failure.");
        lastErr = err;
        const retryable = err.kind === "TIMEOUT" || err.kind === "NETWORK" || (err.kind === "HTTP" && (err.status ?? 0) >= 500);
        if (!retryable || attempt >= maxRetries) throw err;
        await sleep(300 * 2 ** attempt);
      }
    }
    throw lastErr ?? new SptransError("NETWORK", "SPTrans unavailable.");
  }

  /** GET com cache (TTL = intervalo mínimo), deduplicação de chamadas concorrentes e registro de saúde. */
  async function get(path: string, ttlMs: number, staleOnError = false): Promise<unknown> {
    if (!token) throw new SptransError("NOT_CONFIGURED", "SPTrans token is not configured.");
    const t = now();
    const hit = cache.get(path);
    if (hit && hit.expiresAt > t) return hit.value;
    const running = inflight.get(path);
    if (running) return running;
    health.lastQueryAt = t;
    const p = fetchJson(path)
      .then((value) => {
        cache.set(path, { value, expiresAt: now() + ttlMs });
        health.lastSuccessAt = now();
        return value;
      })
      .catch((e: unknown) => {
        health.lastFailureAt = now();
        health.lastFailureKind = e instanceof SptransError ? e.kind : "UNKNOWN";
        if (staleOnError && hit) return hit.value; // catálogo estático: pode servir cópia antiga
        throw e;
      })
      .finally(() => {
        inflight.delete(path);
      });
    inflight.set(path, p);
    return p;
  }

  return {
    searchLines: (term: string) => get(`/Linha/Buscar?termosBusca=${encodeURIComponent(term)}`, SPTRANS_TTL.linesMs, true),
    stopsByLine: (codigoLinha: number) => get(`/Parada/BuscarParadasPorLinha?codigoLinha=${Math.trunc(codigoLinha)}`, SPTRANS_TTL.stopsMs, true),
    /** Posições nunca são servidas de cópia antiga em caso de erro. */
    positionsByLine: (codigoLinha: number) => get(`/Posicao/Linha?codigoLinha=${Math.trunc(codigoLinha)}`, SPTRANS_TTL.positionsMs, false),
    getHealth: (): SptransHealth => ({ ...health }),
    clearCache: () => cache.clear(),
  };
}

export type SptransClient = ReturnType<typeof createSptransClient>;

let singleton: SptransClient | null = null;
/** Singleton do processo; lê o token somente de process.env.SPTRANS_API_TOKEN. */
export function getSptransClient(): SptransClient {
  singleton ??= createSptransClient({ token: process.env.SPTRANS_API_TOKEN?.trim() || "" });
  return singleton;
}
export function isSptransConfigured(): boolean {
  return !!process.env.SPTRANS_API_TOKEN?.trim();
}
