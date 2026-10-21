import type { IntegrationState, RiskResult } from "@/types/transit";

export type AlertType = "STALE_DATA" | "API_FAILURE" | "HIGH_INTERVALS" | "DELAY_INFERRED" | "RISK_CHANGE" | "INFO";

/** Alerta contextual DERIVADO de sinais observados/estimados. Nunca representa incidente oficial. */
export type GomobAlert = {
  id: string;
  lineId: string | null;
  type: AlertType;
  title: string;
  description: string;
  createdAt: string;
  isDemo: boolean;
};

export type LineSignals = {
  lineId: string;
  lineLabel: string;
  vehiclesState: IntegrationState;
  vehicleCount: number;
  risk: RiskResult;
  previous?: { level: RiskResult["level"]; score: number | null } | null;
  isDemo: boolean;
};

const ORDER = { INSUFFICIENT_DATA: -1, LOW: 0, MODERATE: 1, HIGH: 2 } as const;
const bucket = (now: Date, minutes = 10) => Math.floor(now.getTime() / (minutes * 60_000));

/**
 * Deriva alertas de uma linha. Regras (sem inventar incidentes):
 * - API_FAILURE: estado UNAVAILABLE;  STALE_DATA: estado STALE;
 * - HIGH_INTERVALS: fator de irregularidade de intervalos >= 70 (observado);
 * - DELAY_INFERRED: fator de atraso >= 60, só existe com referência temporal válida;
 * - RISK_CHANGE: nível mudou em relação ao registro anterior, ambos com nível calculado.
 */
export function deriveLineAlerts(s: LineSignals, now: Date = new Date()): GomobAlert[] {
  const out: GomobAlert[] = [];
  const createdAt = now.toISOString();
  const b = bucket(now);
  const mk = (type: AlertType, title: string, description: string): GomobAlert => ({
    id: `${type}:${s.lineId}:${b}`,
    lineId: s.lineId,
    type,
    title,
    description,
    createdAt,
    isDemo: s.isDemo,
  });
  if (s.vehiclesState === "UNAVAILABLE") {
    out.push(mk("API_FAILURE", `Live data unavailable for ${s.lineLabel}`, "Bus positions could not be retrieved right now. Estimates for this line may be missing or outdated."));
  } else if (s.vehiclesState === "STALE") {
    out.push(mk("STALE_DATA", `Outdated data for ${s.lineLabel}`, "Bus positions for this line were not updated recently and may not reflect the current situation."));
  }
  const f = s.risk.factors;
  if (f.headway !== null && f.headway >= 70) {
    out.push(mk("HIGH_INTERVALS", `Irregular intervals observed on ${s.lineLabel}`, "Buses are unevenly spaced along the line based on observed positions. This is an estimate, not an official notice."));
  }
  if (f.delay !== null && f.delay >= 60) {
    out.push(mk("DELAY_INFERRED", `Possible delays on ${s.lineLabel}`, "Delays were inferred against a valid time reference. This is an estimate, not an official notice."));
  }
  const prev = s.previous;
  if (prev && prev.level !== "INSUFFICIENT_DATA" && s.risk.level !== "INSUFFICIENT_DATA" && prev.level !== s.risk.level) {
    const up = ORDER[s.risk.level] > ORDER[prev.level];
    out.push(
      mk(
        "RISK_CHANGE",
        `Estimated risk ${up ? "increased" : "decreased"} on ${s.lineLabel}`,
        `The estimated crowding risk changed from ${prev.level.toLowerCase()} to ${s.risk.level.toLowerCase()}. This is an estimate, not a passenger count.`,
      ),
    );
  }
  return out;
}

/** Alerta de sistema (integração) a partir do estado das integrações. */
export function deriveSystemAlerts(
  integrations: { key: string; label: string; configured: boolean; state: IntegrationState; lastFailureAt: string | null }[],
  isDemo: boolean,
  now: Date = new Date(),
): GomobAlert[] {
  const b = bucket(now);
  const out: GomobAlert[] = [];
  for (const i of integrations) {
    if (!i.configured) continue;
    if (i.state === "UNAVAILABLE") {
      out.push({ id: `API_FAILURE:${i.key}:${b}`, lineId: null, type: "API_FAILURE", title: `${i.label} is temporarily unavailable`, description: "Data from this source could not be retrieved. Information shown may be outdated.", createdAt: now.toISOString(), isDemo });
    } else if (i.state === "STALE") {
      out.push({ id: `STALE_DATA:${i.key}:${b}`, lineId: null, type: "STALE_DATA", title: `${i.label} data is outdated`, description: "The latest data from this source is older than expected.", createdAt: now.toISOString(), isDemo });
    }
  }
  return out;
}

export function sortAlerts(alerts: GomobAlert[]): GomobAlert[] {
  return [...alerts].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id));
}
