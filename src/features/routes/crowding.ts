import { typicalDemand } from "@/features/intelligence/profile";
import { saoPauloParts } from "@/features/intelligence/demand";
import type { RiskResult } from "@/types/transit";

/**
 * "Horários de pico" de uma rota: índice APROXIMADO de lotação (0 a 100) por dia da semana e hora.
 *
 * Não é contagem de passageiros. Para cada linha, combina:
 *  - a procura típica do transporte por ônibus naquele dia e hora (mesma curva da estimativa de risco);
 *  - o intervalo programado da linha na hora (GTFS da SPTrans): ônibus mais espaçados tendem a vir mais cheios;
 *  - o sentido: se a SPTrans põe mais viagens de manhã ou à tarde naquele sentido, o pico pesa mais ali.
 * Na hora atual, quando há ônibus suficientes ao vivo, ajusta com a irregularidade medida pela posição deles.
 * O índice da rota é o da linha mais cheia (o mesmo critério do risco da rota: vale o pior trecho).
 */
export type LineSchedule = { freq: [number, number][]; days: string | null };
export type CrowdingLeg = { code: string; schedule: LineSchedule | null; risk?: RiskResult };
export type RouteCrowding = {
  /** [dia da semana, 0 = domingo][hora] -> índice 0–100; null = a rota não opera nessa hora */
  week: (number | null)[][];
  /** momento da consulta, no horário de São Paulo */
  weekday: number;
  hour: number;
  /** índice típico da hora atual; null = fora do horário */
  typical: number | null;
  /** índice da hora atual ajustado pelos ônibus ao vivo; null = sem dados ao vivo suficientes */
  live: number | null;
  /** linha mais cheia agora */
  line: string | null;
  /** SCHEDULE: usa o horário da SPTrans; TYPICAL: só a procura típica */
  basis: "SCHEDULE" | "TYPICAL";
};
export type Emptiest = { routeId: string; reasons: string[] };

const REF_INTERVAL = 15;
const LIVE_WEIGHT = 0.4;
const clamp = (n: number) => Math.round(Math.min(100, Math.max(0, n)));

/** Parte das viagens de pico feitas de manhã neste sentido (0 a 1; 0,5 = equilibrado). */
export function morningShare(freq: [number, number][]): number {
  const trips = (from: number, to: number) => freq.filter(([h, every]) => h >= from && h <= to && every > 0).reduce((s, [, every]) => s + 60 / every, 0);
  const am = trips(5, 8);
  const pm = trips(16, 19);
  return am + pm > 0 ? am / (am + pm) : 0.5;
}

/** Índice típico de uma linha em um dia (0 = domingo) e hora. null = não opera. */
export function lineIndex(s: LineSchedule | null, weekday: number, hour: number): number | null {
  const demand = typicalDemand(weekday, hour).value ?? 0;
  if (!s) return clamp(demand * 0.85);
  // o calendário do GTFS começa na segunda
  if (s.days && s.days[(weekday + 6) % 7] !== "1") return null;
  const every = s.freq.find((f) => f[0] === hour)?.[1];
  if (!every || every <= 0) return null;
  const supply = 0.6 + 0.4 * Math.min(2, every / REF_INTERVAL);
  const am = morningShare(s.freq);
  const tilt = hour >= 5 && hour <= 9 ? 0.7 + 0.6 * am : hour >= 16 && hour <= 20 ? 0.7 + 0.6 * (1 - am) : 1;
  return clamp(demand * 0.85 * supply * tilt);
}

/** A irregularidade foi medida agora com ônibus ao vivo? (a estimativa de reserva não preenche `operations`) */
const liveScore = (r: RiskResult | undefined): number | null => (r && r.source !== "DEMO" && r.factors.headway !== null && r.factors.operations !== null ? r.score : null);

export function routeCrowding(legs: CrowdingLeg[], now: Date = new Date()): RouteCrowding | null {
  if (!legs.length) return null;
  const { weekday, hour } = saoPauloParts(now);
  const at = (d: number, h: number): number | null => {
    let worst = 0;
    for (const l of legs) {
      const v = lineIndex(l.schedule, d, h);
      if (v === null) return null; // sem uma das linhas, a rota não existe nessa hora
      worst = Math.max(worst, v);
    }
    return worst;
  };
  const week = Array.from({ length: 7 }, (_, d) => Array.from({ length: 24 }, (_, h) => at(d, h)));
  const typical = week[weekday][hour];

  let live: number | null = null;
  let line: string | null = null;
  if (typical !== null) {
    let worst = -1;
    let any = false;
    for (const l of legs) {
      const base = lineIndex(l.schedule, weekday, hour) ?? 0;
      const score = liveScore(l.risk);
      if (score !== null) any = true;
      const v = score !== null ? clamp(base * (1 - LIVE_WEIGHT) + score * LIVE_WEIGHT) : base;
      if (v > worst) {
        worst = v;
        line = l.code;
      }
    }
    if (any) live = worst;
  }
  return { week, weekday, hour, typical, live, line, basis: legs.some((l) => l.schedule) ? "SCHEDULE" : "TYPICAL" };
}

/** Índice que vale agora: o ajustado ao vivo, quando existe; senão, o típico do horário. */
export const crowdingNow = (c: RouteCrowding | undefined | null): number | null => (c ? (c.live ?? c.typical) : null);

export function crowdingLabel(v: number | null): string {
  if (v === null) return "Fora do horário";
  if (v < 25) return "Vazia";
  if (v < 45) return "Tranquila";
  if (v < 65) return "Um pouco cheia";
  if (v < 85) return "Cheia";
  return "Lotada";
}

/**
 * Rota mais vazia agora. Só existe com ao menos 2 rotas comparáveis; empate fica com a de menor risco
 * e depois com a mais rápida.
 */
export function pickEmptiest(routes: { id: string; durationMinutes: number | null; risk?: RiskResult; crowding?: RouteCrowding }[]): Emptiest | undefined {
  const list: { id: string; v: number; risk: number; dur: number }[] = [];
  for (const r of routes) {
    const v = crowdingNow(r.crowding);
    if (v !== null) list.push({ id: r.id, v, risk: r.risk?.score ?? 101, dur: r.durationMinutes ?? Number.MAX_SAFE_INTEGER });
  }
  if (list.length < 2) return undefined;
  list.sort((a, b) => a.v - b.v || a.risk - b.risk || a.dur - b.dur);
  const best = list[0];
  const top = list[list.length - 1];
  const tie = list[1].v === best.v;
  const reasons = [`Lotação estimada agora de ${best.v} em 100 (${crowdingLabel(best.v).toLowerCase()})${tie ? ", empatada com outra opção" : `, a menor entre ${list.length} rotas`}.`];
  if (top.v > best.v) reasons.push(`A opção mais cheia está com ${top.v} em 100.`);
  return { routeId: best.id, reasons };
}
