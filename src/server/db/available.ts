import { db } from "./index";

/**
 * O banco (Postgres) é opcional na apresentação. Esta checagem responde rápido e guarda o resultado:
 * sem DATABASE_URL ou depois de uma falha, o app usa alternativas locais por 5 minutos
 * em vez de esperar o tempo limite da conexão a cada requisição.
 */
let state: { ok: boolean; until: number } | null = null;
let pending: Promise<boolean> | null = null;

export async function isDbAvailable(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  const now = Date.now();
  if (state && now < state.until) return state.ok;
  pending ??= (async () => {
    try {
      await Promise.race([db.$queryRaw`SELECT 1`, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 1500))]);
      state = { ok: true, until: Date.now() + 60_000 };
    } catch {
      state = { ok: false, until: Date.now() + 5 * 60_000 };
    }
    pending = null;
    return state.ok;
  })();
  return pending;
}
