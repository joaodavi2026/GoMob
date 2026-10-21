import type { FactorObservation } from "./engine";

export type HistoryRow = { referenceDate: Date | string; passengerCount: number; granularity: string; source: string };

export type DemandSupport = {
  granularity: "HOURLY" | "DAILY" | "NONE";
  samples: number;
  distinctDates: number;
  hoursCovered: number;
  sources: string[];
  /** Por que não houve fator (quando value é null). */
  reason?: "NO_DATA" | "DAILY_AGGREGATE_ONLY" | "INSUFFICIENT_SAMPLES";
};

export const MIN_DISTINCT_DATES = 4;
export const MIN_SAMPLES_AT_HOUR = 3;
export const MIN_HOURS_COVERED = 6;

/** America/Sao_Paulo é UTC-3 fixo (sem horário de verão desde 2019). */
export function saoPauloParts(d: Date | string): { dateKey: string; weekday: number; hour: number } {
  const t = (d instanceof Date ? d : new Date(d)).getTime() - 3 * 3600_000;
  const x = new Date(t);
  return { dateKey: x.toISOString().slice(0, 10), weekday: x.getUTCDay(), hour: x.getUTCHours() };
}

/**
 * Demanda histórica (D) para dia da semana e hora. Só usa dados HORÁRIOS.
 * Dados agregados por dia NÃO geram pico por hora: retornam value null com reason DAILY_AGGREGATE_ONLY.
 * D = média da hora-alvo / maior média horária do mesmo dia da semana (0–100).
 */
export function computeHourlyDemandFactor(
  rows: HistoryRow[],
  target: { weekday: number; hour: number },
): { factor: FactorObservation; support: DemandSupport } {
  const sources = [...new Set(rows.map((r) => r.source))];
  if (rows.length === 0) {
    return { factor: { value: null }, support: { granularity: "NONE", samples: 0, distinctDates: 0, hoursCovered: 0, sources, reason: "NO_DATA" } };
  }
  const hourly = rows.filter((r) => r.granularity.toUpperCase() === "HOURLY" && Number.isFinite(r.passengerCount) && r.passengerCount >= 0);
  if (hourly.length === 0) {
    const daily = rows.some((r) => r.granularity.toUpperCase() === "DAILY");
    return {
      factor: { value: null },
      support: {
        granularity: daily ? "DAILY" : "NONE",
        samples: rows.length,
        distinctDates: 0,
        hoursCovered: 0,
        sources,
        reason: daily ? "DAILY_AGGREGATE_ONLY" : "NO_DATA",
      },
    };
  }
  const sameDay = hourly.map((r) => ({ ...saoPauloParts(r.referenceDate), n: r.passengerCount })).filter((r) => r.weekday === target.weekday);
  const byHour = new Map<number, number[]>();
  for (const r of sameDay) byHour.set(r.hour, [...(byHour.get(r.hour) ?? []), r.n]);
  const distinctDates = new Set(sameDay.map((r) => r.dateKey)).size;
  const atTarget = byHour.get(target.hour) ?? [];
  const support: DemandSupport = { granularity: "HOURLY", samples: sameDay.length, distinctDates, hoursCovered: byHour.size, sources };
  if (distinctDates < MIN_DISTINCT_DATES || atTarget.length < MIN_SAMPLES_AT_HOUR || byHour.size < MIN_HOURS_COVERED) {
    return { factor: { value: null }, support: { ...support, reason: "INSUFFICIENT_SAMPLES" } };
  }
  const means = [...byHour.values()].map((xs) => xs.reduce((a, b) => a + b, 0) / xs.length);
  const maxMean = Math.max(...means);
  if (maxMean <= 0) return { factor: { value: null }, support: { ...support, reason: "INSUFFICIENT_SAMPLES" } };
  const targetMean = atTarget.reduce((a, b) => a + b, 0) / atTarget.length;
  return { factor: { value: Math.round((targetMean / maxMean) * 100), granularity: "HOURLY", origin: "DERIVED" }, support };
}
