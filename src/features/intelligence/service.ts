import { db } from "@/server/db";
import { getScenario } from "@/server/demo/scenario";
import { getStops, getVehicles } from "@/server/transit/service";
import type { RiskResult, TransitStop, TransitVehicle } from "@/types/transit";
import { getFleetSnapshot } from "@/server/sptrans/fleet";
import { gtfsLineStops } from "@/features/routes/gtfs-provider";
import { computeHourlyDemandFactor, saoPauloParts, type HistoryRow } from "./demand";
import { demoFactors, DEMO_LABEL } from "./demo";
import { computeRisk, type RiskInputs } from "./engine";
import { computeSpacingSignals } from "./signals";
import { parseWeights, WEIGHTS_SETTING_KEY, type RiskWeights, DEFAULT_WEIGHTS } from "./weights";

/**
 * Banco opcional: sem DATABASE_URL, ou depois de uma falha, as consultas devolvem o padrão na hora
 * (por 5 min) em vez de esperar o tempo limite da conexão a cada cálculo de risco.
 */
let dbDownUntil = 0;
async function fromDb<T>(query: () => Promise<T>, fallback: T, timeoutMs = 1200): Promise<T> {
  if (!process.env.DATABASE_URL || Date.now() < dbDownUntil) return fallback;
  try {
    return await Promise.race([
      query(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("db timeout")), timeoutMs)),
    ]);
  } catch {
    dbDownUntil = Date.now() + 5 * 60_000;
    return fallback;
  }
}

/** Pesos de AppSetting 'intelligence.weights'; qualquer falha/valor inválido => padrão. */
export async function loadWeights(): Promise<RiskWeights> {
  return fromDb(
    async () => parseWeights((await db.appSetting.findUnique({ where: { key: WEIGHTS_SETTING_KEY } }))?.value),
    { ...DEFAULT_WEIGHTS },
  );
}

export async function loadHistory(lineId: string, limit = 5000): Promise<HistoryRow[]> {
  return fromDb(
    () =>
      db.historicalDemand.findMany({
        where: { lineId },
        orderBy: { referenceDate: "desc" },
        take: limit,
        select: { referenceDate: true, passengerCount: true, granularity: true, source: true },
      }),
    [] as HistoryRow[],
  );
}

/**
 * Risco de uma linha do GTFS (rotas reais): posições ao vivo da frota inteira (uma única chamada
 * Olho Vivo em cache) + paradas do GTFS para medir o espaçamento entre os ônibus naquele sentido.
 */
export async function getGtfsLineRisk(code: string, direction: number, opts: { now?: Date } = {}): Promise<RiskResult> {
  const now = opts.now ?? new Date();
  const [weights, fleet] = await Promise.all([loadWeights(), getFleetSnapshot()]);
  const inputs: RiskInputs = {};
  if (fleet.state === "LIVE") {
    const fetched = Date.parse(fleet.fetchedAt);
    const vehicles: TransitVehicle[] = fleet.vehicles
      .filter((v) => v[0] === code && (v[1] === 2 ? 1 : 0) === direction)
      .map((v) => ({
        id: v[4],
        lineId: code,
        latitude: v[2],
        longitude: v[3],
        observedAt: new Date(fetched - Math.max(0, v[6]) * 1000).toISOString(),
        source: "SPTRANS",
      }));
    const stops: TransitStop[] = gtfsLineStops(code, direction).map((s) => ({ ...s, source: "SPTRANS" }));
    const sig = computeSpacingSignals(vehicles, stops, now);
    inputs.headway = sig.headway;
    inputs.operations = sig.operations;
  }
  return computeRisk(inputs, { weights, now });
}

export const isDemoLineId = (lineId: string) => lineId.startsWith("demo-");

/** Risco demonstrativo determinístico por cenário (identificado: source DEMO). */
export async function getDemoRisk(lineKey: string, now: Date = new Date()): Promise<RiskResult> {
  const [weights, sc] = await Promise.all([loadWeights(), getScenario()]);
  const inputs = demoFactors(sc.scenario, lineKey, { recoveryStartedAt: sc.recoveryStartedAt, now }) ?? {};
  const prefix = `${DEMO_LABEL}${sc.scenario === "C_UNAVAILABLE" ? " Cenário: dados indisponíveis." : ""}`;
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
