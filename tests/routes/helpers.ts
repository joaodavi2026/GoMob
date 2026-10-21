import type { BusRouteOption, RiskResult, RouteStep } from "@/types/transit";
import type { RouteResult } from "@/features/routes/types";

export const NOW = new Date("2026-10-21T15:00:00Z");

export function risk(score: number | null, over: Partial<RiskResult> = {}): RiskResult {
  const level = score === null ? "INSUFFICIENT_DATA" : score < 35 ? "LOW" : score < 70 ? "MODERATE" : "HIGH";
  return {
    score,
    level,
    confidence: score === null ? null : 0.7,
    factors: { demand: null, headway: score, delay: null, operations: score },
    source: "DEMO",
    calculatedAt: NOW.toISOString(),
    explanation: "test",
    ...over,
  };
}

export const bus = (code: string, board: string, alight: string, minutes = 10, lineName = `Line ${code}`): RouteStep => ({
  kind: "BUS",
  lineCode: code,
  lineName,
  boardStop: board,
  alightStop: alight,
  minutes,
});
export const walk = (from: string, to: string, minutes = 3): RouteStep => ({ kind: "WALK", from, to, minutes });

export function option(id: string, steps: RouteStep[], over: Partial<BusRouteOption> = {}): BusRouteOption {
  const buses = steps.filter((s) => s.kind === "BUS").length;
  return {
    id,
    steps,
    durationMinutes: 30,
    walkMinutes: steps.reduce((n, s) => n + (s.kind === "WALK" ? s.minutes : 0), 0),
    transfers: Math.max(0, buses - 1),
    path: [
      [-46.65, -23.55],
      [-46.64, -23.56],
    ],
    source: "DEMO",
    dataTimestamp: NOW.toISOString(),
    ...over,
  };
}

export function result(id: string, over: Partial<RouteResult> = {}): RouteResult {
  return { ...option(id, [walk("A", "S1"), bus("L1", "S1", "S2"), walk("S2", "B")]), lineRisks: {}, ...over };
}
