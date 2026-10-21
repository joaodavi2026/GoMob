/** Configuração do módulo Transit (sem segredos; seguro para importar no cliente). */

/** Termos de busca (Olho Vivo /Linha/Buscar) das linhas reais monitoradas no MVP (3–5 linhas). */
export const LIVE_SEED_SEARCH_TERMS: readonly string[] = ["8000-10", "875A-10", "6000-10", "477U-10"];

/** Posições mais antigas que isto são marcadas como STALE (nunca posição atual confirmada). */
export const STALE_AFTER_MS = 3 * 60_000;
/** Posições mais antigas que isto são descartadas no servidor. */
export const DISCARD_AFTER_MS = 30 * 60_000;

/** Cache (TTL mínimo = intervalo mínimo entre chamadas idênticas à SPTrans). */
export const SPTRANS_TTL = {
  positionsMs: Number(process.env.SPTRANS_MIN_INTERVAL_MS) > 0 ? Number(process.env.SPTRANS_MIN_INTERVAL_MS) : 20_000,
  linesMs: 6 * 60 * 60_000,
  stopsMs: 60 * 60_000,
} as const;

export const SPTRANS_HTTP = {
  baseUrl: process.env.SPTRANS_API_BASE_URL || "https://api.olhovivo.sptrans.com.br/v2.1",
  timeoutMs: 8_000,
  maxRetries: 2,
  /** Após falha de autenticação, não tenta de novo por este tempo. */
  authBackoffMs: 60_000,
  /** Pausa padrão após 429 sem Retry-After. */
  rateLimitCooldownMs: 30_000,
} as const;

/** Polling no frontend (30–60 s configurável). */
export const POLL_INTERVAL_MS = (() => {
  const v = Number(process.env.NEXT_PUBLIC_POLL_INTERVAL_MS);
  return v >= 30_000 && v <= 60_000 ? v : 30_000;
})();

export const SAO_PAULO_CENTER = { latitude: -23.5505, longitude: -46.6333 } as const;
export const MAX_LINES_PER_VEHICLES_REQUEST = 5;
