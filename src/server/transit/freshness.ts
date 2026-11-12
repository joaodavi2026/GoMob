import { DISCARD_AFTER_MS, STALE_AFTER_MS } from "@/config/transit";
import type { DataFreshness } from "@/types/transit";

/** Função pura (segura no cliente): classifica a idade de uma observação. */
export function classifyFreshness(observedAt: string, now: number = Date.now(), staleAfterMs = STALE_AFTER_MS): DataFreshness {
  const t = Date.parse(observedAt);
  if (!Number.isFinite(t)) return "UNAVAILABLE";
  if (t - now > 60_000) return "UNAVAILABLE"; // timestamp no futuro: inconsistente
  return now - t > staleAfterMs ? "STALE" : "FRESH";
}

export function shouldDiscard(observedAt: string, now: number = Date.now()): boolean {
  const t = Date.parse(observedAt);
  return !Number.isFinite(t) || now - t > DISCARD_AFTER_MS;
}

export function formatAge(observedAt: string, now: number = Date.now()): string {
  const t = Date.parse(observedAt);
  if (!Number.isFinite(t)) return "em horário desconhecido";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 10) return "agora mesmo";
  if (s < 60) return `há ${s} segundos`;
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} minuto${m === 1 ? "" : "s"}`;
  const h = Math.round(m / 60);
  return `há ${h} hora${h === 1 ? "" : "s"}`;
}
