import type { RiskLevel, RiskResult } from "@/types/transit";
import { DEFAULT_WEIGHTS, type RiskWeights } from "./weights";

export type FactorKey = keyof RiskResult["factors"];
export const FACTOR_KEYS: FactorKey[] = ["demand", "headway", "delay", "operations"];

export type FactorOrigin = "OFFICIAL" | "DERIVED" | "DEMO";
export type FactorGranularity = "REALTIME" | "HOURLY" | "REFERENCE" | "DAILY";

/** Observação de um fator já normalizado (0–100) ou ausente (value null). */
export type FactorObservation = {
  value: number | null;
  observedAt?: string | null;
  granularity?: FactorGranularity;
  origin?: FactorOrigin;
};

export type RiskInputs = Partial<Record<FactorKey, FactorObservation | null>>;

export type ComputeOptions = {
  weights?: RiskWeights;
  now?: Date;
  /** Fatores sem os quais não há estimativa (política explícita). Padrão: headway. */
  essential?: FactorKey[];
  /** Fração mínima da soma dos pesos que precisa estar disponível. */
  minCoverage?: number;
  /** Teto da confiança (ex.: previsão só histórica). */
  confidenceCap?: number;
  /** Ignora atualidade (consulta futura baseada em histórico). */
  ignoreFreshness?: boolean;
  /** Força a origem do resultado (ex.: DEMO mesmo sem fatores). */
  forceSource?: RiskResult["source"];
  explanationPrefix?: string;
};

/** Política: com o essencial presente, ao menos 45% do peso total precisa estar disponível. */
export const MIN_WEIGHT_COVERAGE = 0.45;
export const DEFAULT_ESSENTIAL: FactorKey[] = ["headway"];

export const FACTOR_LABEL: Record<FactorKey, string> = {
  demand: "historical demand",
  headway: "headway irregularity",
  delay: "operational delay",
  operations: "operational irregularity",
};

const EPS = 1e-9;

export function clamp(n: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, n));
}

/** Normaliza `value` do intervalo [min,max] para 0–100 (limitado). */
export function normalize(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || max <= min) return 0;
  return clamp(((value - min) / (max - min)) * 100);
}

/** 0–34 LOW, 35–69 MODERATE, 70–100 HIGH. Recebe score inteiro já arredondado. */
export function classifyScore(score: number): Exclude<RiskLevel, "INSUFFICIENT_DATA"> {
  if (score < 35) return "LOW";
  if (score < 70) return "MODERATE";
  return "HIGH";
}

export function levelLabel(level: RiskLevel): string {
  return { LOW: "Low risk", MODERATE: "Moderate risk", HIGH: "High risk", INSUFFICIENT_DATA: "Insufficient data" }[level];
}

function validValue(o: FactorObservation | null | undefined): number | null {
  if (!o || typeof o.value !== "number" || !Number.isFinite(o.value)) return null;
  return clamp(o.value);
}

const ORIGIN_SCORE: Record<FactorOrigin, number> = { OFFICIAL: 1, DERIVED: 0.75, DEMO: 0.4 };
const GRAN_SCORE: Record<FactorGranularity, number> = { REALTIME: 1, HOURLY: 0.9, REFERENCE: 0.8, DAILY: 0.3 };

function freshness(observedAt: string | null | undefined, now: Date): number | null {
  if (!observedAt) return null;
  const t = Date.parse(observedAt);
  if (Number.isNaN(t)) return null;
  const ageMin = Math.max(0, (now.getTime() - t) / 60000);
  if (ageMin <= 2) return 1;
  if (ageMin >= 15) return 0;
  return 1 - (ageMin - 2) / 13;
}

function avg(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

/** Confiança 0–1: disponibilidade, atualidade, consistência temporal, origem e granularidade. Não é precisão estatística. */
export function computeConfidence(
  available: { key: FactorKey; obs: FactorObservation }[],
  coverage: number,
  now: Date,
  opts: Pick<ComputeOptions, "ignoreFreshness" | "confidenceCap"> = {},
): number {
  const fresh = opts.ignoreFreshness
    ? 0.7
    : (avg(available.map((a) => freshness(a.obs.observedAt, now)).filter((x): x is number => x !== null)) ?? 0.5);
  const times = available.map((a) => (a.obs.observedAt ? Date.parse(a.obs.observedAt) : NaN)).filter((t) => !Number.isNaN(t));
  let consistency = 0.7;
  if (!opts.ignoreFreshness) {
    if (times.length >= 2) {
      const spreadMin = (Math.max(...times) - Math.min(...times)) / 60000;
      consistency = clamp(1 - (spreadMin - 2) / 8, 0, 1);
    } else if (times.length === 1) consistency = 1;
  }
  const origin = avg(available.map((a) => ORIGIN_SCORE[a.obs.origin ?? "DERIVED"])) ?? 0;
  const gran = avg(available.map((a) => (a.obs.granularity ? GRAN_SCORE[a.obs.granularity] : 0.6))) ?? 0;
  let c = clamp(0.3 * coverage + 0.25 * fresh + 0.15 * consistency + 0.15 * origin + 0.15 * gran, 0, 1);
  if (opts.confidenceCap !== undefined) c = Math.min(c, opts.confidenceCap);
  return Math.round(c * 100) / 100;
}

function phrase(key: FactorKey, v: number): string | null {
  if (v < 60) return null;
  switch (key) {
    case "demand":
      return "historically high demand for this period";
    case "headway":
      return "irregular bus intervals";
    case "delay":
      return "operational delays";
    case "operations":
      return "uneven spacing or bunching of buses";
  }
}

/** Explicação "Why this risk?": só cita fatores efetivamente calculados; indisponíveis aparecem como "Not available". */
export function buildExplanation(level: RiskLevel, factors: RiskResult["factors"], missing: FactorKey[], prefix?: string): string {
  const used = FACTOR_KEYS.filter((k) => factors[k] !== null);
  const lead = prefix ? `${prefix} ` : "";
  const miss = missing.length ? ` Not available: ${missing.map((k) => FACTOR_LABEL[k]).join(", ")}.` : "";
  if (level === "INSUFFICIENT_DATA") {
    return `${lead}Not enough data to estimate crowding risk, so no level is shown. Missing data is never treated as low risk.${miss}`;
  }
  const high = used.map((k) => phrase(k, factors[k] as number)).filter((p): p is string => !!p);
  let body: string;
  if (level === "LOW") body = "Lower risk estimated: the signals calculated do not show strong irregularity.";
  else if (high.length) body = `${level === "HIGH" ? "Higher" : "Moderate"} risk estimated due to ${high.join(" and ")}.`;
  else body = "Moderate risk estimated from several mid-level signals.";
  const basis = `Based on ${used.length} of 4 signals (${used.map((k) => FACTOR_LABEL[k]).join(", ")}).`;
  return `${lead}${body} ${basis}${miss} This is an estimate, not a passenger count.`;
}

export function computeRisk(inputs: RiskInputs, options: ComputeOptions = {}): RiskResult {
  const weights = options.weights ?? DEFAULT_WEIGHTS;
  const now = options.now ?? new Date();
  const essential = options.essential ?? DEFAULT_ESSENTIAL;
  const minCoverage = options.minCoverage ?? MIN_WEIGHT_COVERAGE;

  const factors: RiskResult["factors"] = { demand: null, headway: null, delay: null, operations: null };
  const available: { key: FactorKey; obs: FactorObservation }[] = [];
  for (const k of FACTOR_KEYS) {
    const v = validValue(inputs[k]);
    if (v !== null) {
      factors[k] = Math.round(v);
      available.push({ key: k, obs: inputs[k] as FactorObservation });
    }
  }
  const missing = FACTOR_KEYS.filter((k) => factors[k] === null);
  const coverage = available.reduce((s, a) => s + weights[a.key], 0);

  const origins = available.map((a) => a.obs.origin ?? "DERIVED");
  const source: RiskResult["source"] =
    options.forceSource ??
    (origins.includes("DEMO") ? "DEMO" : origins.includes("DERIVED") || origins.length === 0 ? "DERIVED" : "OFFICIAL");

  const insufficient = available.length === 0 || essential.some((k) => factors[k] === null) || coverage + EPS < minCoverage;
  const calculatedAt = now.toISOString();
  if (insufficient) {
    return {
      score: null,
      level: "INSUFFICIENT_DATA",
      confidence: null,
      factors,
      source,
      calculatedAt,
      explanation: buildExplanation("INSUFFICIENT_DATA", factors, missing, options.explanationPrefix),
    };
  }

  // Média ponderada somente dos fatores disponíveis (pesos renormalizados). Ausência NUNCA vira zero.
  const raw = available.reduce((s, a) => s + weights[a.key] * (factors[a.key] as number), 0) / coverage;
  const score = Math.round(clamp(raw));
  const level = classifyScore(score);
  return {
    score,
    level,
    confidence: computeConfidence(available, Math.min(1, coverage), now, options),
    factors,
    source,
    calculatedAt,
    explanation: buildExplanation(level, factors, missing, options.explanationPrefix),
  };
}
