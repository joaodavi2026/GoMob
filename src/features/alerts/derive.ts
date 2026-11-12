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
const LEVEL_PT: Record<RiskResult["level"], string> = { INSUFFICIENT_DATA: "dados insuficientes", LOW: "baixo", MODERATE: "moderado", HIGH: "alto" };
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
    out.push(mk("API_FAILURE", `Dados ao vivo indisponíveis para ${s.lineLabel}`, "Não foi possível obter as posições dos ônibus agora. As estimativas desta linha podem estar ausentes ou desatualizadas."));
  } else if (s.vehiclesState === "STALE") {
    out.push(mk("STALE_DATA", `Dados desatualizados para ${s.lineLabel}`, "As posições dos ônibus desta linha não foram atualizadas recentemente e podem não refletir a situação atual."));
  }
  const f = s.risk.factors;
  if (f.headway !== null && f.headway >= 70) {
    out.push(mk("HIGH_INTERVALS", `Intervalos irregulares observados na linha ${s.lineLabel}`, "Os ônibus estão espaçados de forma desigual ao longo da linha, segundo as posições observadas. Isto é uma estimativa, não um aviso oficial."));
  }
  if (f.delay !== null && f.delay >= 60) {
    out.push(mk("DELAY_INFERRED", `Possíveis atrasos na linha ${s.lineLabel}`, "Os atrasos foram inferidos a partir de uma referência de horário válida. Isto é uma estimativa, não um aviso oficial."));
  }
  const prev = s.previous;
  if (prev && prev.level !== "INSUFFICIENT_DATA" && s.risk.level !== "INSUFFICIENT_DATA" && prev.level !== s.risk.level) {
    const up = ORDER[s.risk.level] > ORDER[prev.level];
    out.push(
      mk(
        "RISK_CHANGE",
        `O risco estimado ${up ? "aumentou" : "diminuiu"} na linha ${s.lineLabel}`,
        `O risco estimado de lotação mudou de ${LEVEL_PT[prev.level]} para ${LEVEL_PT[s.risk.level]}. Isto é uma estimativa, não uma contagem de passageiros.`,
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
      out.push({ id: `API_FAILURE:${i.key}:${b}`, lineId: null, type: "API_FAILURE", title: `${i.label} está temporariamente indisponível`, description: "Não foi possível obter dados desta fonte. As informações exibidas podem estar desatualizadas.", createdAt: now.toISOString(), isDemo });
    } else if (i.state === "STALE") {
      out.push({ id: `STALE_DATA:${i.key}:${b}`, lineId: null, type: "STALE_DATA", title: `Os dados de ${i.label} estão desatualizados`, description: "Os dados mais recentes desta fonte são mais antigos do que o esperado.", createdAt: now.toISOString(), isDemo });
    }
  }
  return out;
}

export function sortAlerts(alerts: GomobAlert[]): GomobAlert[] {
  return [...alerts].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id));
}
