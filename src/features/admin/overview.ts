export type RiskLevelKey = "LOW" | "MODERATE" | "HIGH" | "INSUFFICIENT_DATA";
export type FreshnessKey = "FRESH" | "STALE" | "UNAVAILABLE";

export const FRESH_MS = 2 * 60_000;
export const STALE_MS = 10 * 60_000;

export function riskDistribution(estimates: { riskLevel: RiskLevelKey }[]): Record<RiskLevelKey, number> {
  const out: Record<RiskLevelKey, number> = { LOW: 0, MODERATE: 0, HIGH: 0, INSUFFICIENT_DATA: 0 };
  for (const e of estimates) if (e.riskLevel in out) out[e.riskLevel] += 1;
  return out;
}

export function classifyFreshness(observedAt: Date | string | null | undefined, now: Date): FreshnessKey {
  if (!observedAt) return "UNAVAILABLE";
  const t = new Date(observedAt).getTime();
  if (!Number.isFinite(t)) return "UNAVAILABLE";
  const age = now.getTime() - t;
  if (age <= FRESH_MS) return "FRESH";
  if (age <= STALE_MS) return "STALE";
  return "UNAVAILABLE";
}

export function freshnessSummary(observedAts: (Date | string | null)[], now: Date): Record<FreshnessKey, number> {
  const out: Record<FreshnessKey, number> = { FRESH: 0, STALE: 0, UNAVAILABLE: 0 };
  for (const o of observedAts) out[classifyFreshness(o, now)] += 1;
  return out;
}

/** Contagem de observações por janela (mais antiga -> mais recente). */
export function observationBuckets(observedAts: (Date | string)[], now: Date, bucketMinutes = 10, buckets = 6): { label: string; count: number }[] {
  const size = bucketMinutes * 60_000;
  const counts = new Array<number>(buckets).fill(0);
  for (const o of observedAts) {
    const age = now.getTime() - new Date(o).getTime();
    if (!Number.isFinite(age) || age < 0 || age >= size * buckets) continue;
    counts[buckets - 1 - Math.floor(age / size)] += 1;
  }
  return counts.map((count, i) => ({ label: i === buckets - 1 ? "now" : `-${(buckets - 1 - i) * bucketMinutes}m`, count }));
}

export type ApiStatusLevel = "OK" | "DEGRADED" | "DOWN" | "DEMO";

export function apiStatus(integrations: { state: string; configured: boolean }[], mode: "LIVE" | "DEMO"): ApiStatusLevel {
  if (mode === "DEMO") return "DEMO";
  if (integrations.length === 0) return "DOWN";
  const bad = integrations.filter((i) => i.configured && (i.state === "UNAVAILABLE" || i.state === "STALE")).length;
  if (bad === 0) return "OK";
  return bad >= integrations.length ? "DOWN" : "DEGRADED";
}

export type OverviewInput = {
  now: Date;
  mode: "LIVE" | "DEMO";
  lines: { active: boolean; source: string }[];
  vehicles: { observedAt: Date | string; isDemo: boolean }[];
  estimates: { riskLevel: RiskLevelKey; expiresAt: Date | string; calculatedAt: Date | string }[];
  integrations: { state: string; configured: boolean }[];
};

export type Overview = {
  mode: "LIVE" | "DEMO";
  isDemo: boolean;
  generatedAt: string;
  metrics: { monitoredLines: number; totalLines: number; trackedVehicles: number; availableEstimates: number; apiStatus: ApiStatusLevel };
  riskDistribution: Record<RiskLevelKey, number>;
  latestObservations: { label: string; count: number }[];
  linesBySource: Record<string, { active: number; inactive: number }>;
  dataFreshness: Record<FreshnessKey, number>;
  latestEstimateAt: string | null;
};

export function buildOverview(i: OverviewInput): Overview {
  const recentVehicles = i.vehicles.filter((v) => classifyFreshness(v.observedAt, i.now) !== "UNAVAILABLE");
  const notExpired = i.estimates.filter((e) => new Date(e.expiresAt).getTime() > i.now.getTime());
  // Estimativa disponível: não expirada e com nível diferente de dados insuficientes.
  const valid = notExpired.filter((e) => e.riskLevel !== "INSUFFICIENT_DATA");
  const bySource: Overview["linesBySource"] = {};
  for (const l of i.lines) {
    const b = (bySource[l.source] ??= { active: 0, inactive: 0 });
    if (l.active) b.active += 1;
    else b.inactive += 1;
  }
  const times = i.estimates.map((e) => new Date(e.calculatedAt).getTime()).filter(Number.isFinite);
  return {
    mode: i.mode,
    isDemo: i.mode === "DEMO" || i.vehicles.some((v) => v.isDemo),
    generatedAt: i.now.toISOString(),
    metrics: {
      monitoredLines: i.lines.filter((l) => l.active).length,
      totalLines: i.lines.length,
      trackedVehicles: recentVehicles.length,
      availableEstimates: valid.length,
      apiStatus: apiStatus(i.integrations, i.mode),
    },
    riskDistribution: riskDistribution(notExpired),
    latestObservations: observationBuckets(i.vehicles.map((v) => v.observedAt), i.now),
    linesBySource: bySource,
    dataFreshness: freshnessSummary(i.vehicles.map((v) => v.observedAt), i.now),
    latestEstimateAt: times.length ? new Date(Math.max(...times)).toISOString() : null,
  };
}
