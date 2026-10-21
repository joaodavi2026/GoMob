import { db } from "@/server/db";
import { getScenario } from "@/server/demo/scenario";
import { getStops, getVehicles } from "@/server/transit/service";
import type { RiskResult } from "@/types/transit";
import { computeHourlyDemandFactor, saoPauloParts, type HistoryRow } from "./demand";
import { demoFactors, DEMO_LABEL } from "./demo";
import { computeRisk, type RiskInputs } from "./engine";
import { computeSpacingSignals } from "./signals";
import { parseWeights, WEIGHTS_SETTING_KEY, type RiskWeights, DEFAULT_WEIGHTS } from "./weights";

/** Pesos de AppSetting 'intelligence.weights'; qualquer falha/valor inválido => padrão. */
export async function loadWeights(): Promise<RiskWeights> {
  try {
    const row = await db.appSetting.findUnique({ where: { key: WEIGHTS_SETTING_KEY } });
    return parseWeights(row?.value);
  } catch {
    return { ...DEFAULT_WEIGHTS };
  }
}

export async function loadHistory(lineId: string, limit = 5000): Promise<HistoryRow[]> {
  try {
    const rows = await db.historicalDemand.findMany({
      where: { lineId },
      orderBy: { referenceDate: "desc" },
      take: limit,
      select: { referenceDate: true, passengerCount: true, granularity: true, source: true },
    });
    return rows;
  } catch {
    return [];
  }
}

export const isDemoLineId = (lineId: string) => lineId.startsWith("demo-");

/** Risco demonstrativo determinístico por cenário (identificado: source DEMO). */
export async function getDemoRisk(lineKey: string, now: Date = new Date()): Promise<RiskResult> {
  const [weights, sc] = await Promise.all([loadWeights(), getScenario()]);
  const inputs = demoFactors(sc.scenario, lineKey, { recoveryStartedAt: sc.recoveryStartedAt, now }) ?? {};
  const prefix = `${DEMO_LABEL}${sc.scenario === "C_UNAVAILABLE" ? " Scenario: data unavailable." : ""}`;
  return computeRisk(inputs, { weights, now, forceSource: "DEMO", explanationPrefix: prefix });
}

/** Risco de uma linha: DEMO por cenário para linhas demo; para linhas reais, sinais observados + histórico horário. */
export async function getLineRisk(lineId: string, opts: { now?: Date } = {}): Promise<RiskResult> {
  const now = opts.now ?? new Date();
  if (isDemoLineId(lineId)) return getDemoRisk(lineId, now);

  const weights = await loadWeights();
  const inputs: RiskInputs = {};
  try {
    const [veh, st] = await Promise.all([getVehicles(lineId), getStops(lineId)]);
    // Fallback demo de linha real (sem provedor live) não é dado observado: nada é inferido dele.
    if (veh.source !== "DEMO" && st.source !== "DEMO") {
      const sig = computeSpacingSignals(veh.vehicles, st.stops, now);
      inputs.headway = sig.headway;
      inputs.operations = sig.operations;
    }
  } catch {
    // posições indisponíveis: fatores ficam ausentes
  }
  try {
    const parts = saoPauloParts(now);
    const { factor } = computeHourlyDemandFactor(await loadHistory(lineId), parts);
    inputs.demand = factor;
  } catch {
    // histórico indisponível
  }
  // Atraso (A): sem tabela de horários/referência temporal validada, permanece ausente.
  return computeRisk(inputs, { weights, now });
}
