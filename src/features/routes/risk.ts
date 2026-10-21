import { classifyScore, levelLabel } from "@/features/intelligence/engine";
import type { BusRouteOption, RiskResult } from "@/types/transit";

export function busLineCodes(option: BusRouteOption): string[] {
  return [...new Set(option.steps.flatMap((s) => (s.kind === "BUS" ? [s.lineCode] : [])))];
}

export function hasUsableRisk(r: RiskResult | undefined | null): r is RiskResult & { score: number } {
  return !!r && r.level !== "INSUFFICIENT_DATA" && r.score !== null;
}

/**
 * Risco da rota = pior (maior) risco entre as linhas de ônibus. Se QUALQUER linha não tem estimativa utilizável,
 * a rota inteira fica INSUFFICIENT_DATA: ausência de dados nunca vira vantagem nem é ignorada.
 */
export function aggregateRouteRisk(option: BusRouteOption, lineRisks: Record<string, RiskResult | undefined>, now: Date = new Date()): RiskResult {
  const codes = busLineCodes(option);
  const usable = codes.map((c) => ({ c, r: lineRisks[c] }));
  const missing = usable.filter((u) => !hasUsableRisk(u.r)).map((u) => u.c);
  const calculatedAt = now.toISOString();
  const sources = usable.map((u) => u.r?.source).filter(Boolean) as RiskResult["source"][];
  const source: RiskResult["source"] = sources.includes("DEMO") || option.source === "DEMO" ? "DEMO" : sources.includes("DERIVED") ? "DERIVED" : sources[0] ?? "DERIVED";
  if (missing.length > 0 || codes.length === 0) {
    return {
      score: null,
      level: "INSUFFICIENT_DATA",
      confidence: null,
      factors: { demand: null, headway: null, delay: null, operations: null },
      source,
      calculatedAt,
      explanation: `Route risk is not shown because there is no usable estimate for: ${missing.join(", ") || "any line"}.`,
    };
  }
  const worst = usable.reduce((a, b) => ((b.r as RiskResult).score! > (a.r as RiskResult).score! ? b : a));
  const w = worst.r as RiskResult & { score: number };
  const confidences = usable.map((u) => (u.r as RiskResult).confidence).filter((c): c is number => c !== null);
  return {
    score: w.score,
    level: classifyScore(w.score),
    confidence: confidences.length ? Math.min(...confidences) : null,
    factors: w.factors,
    source,
    calculatedAt,
    explanation: `Highest estimated risk among the route's lines: ${worst.c} (${levelLabel(w.level)}). ${w.explanation}`,
  };
}
