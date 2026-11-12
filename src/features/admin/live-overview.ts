import { getGtfsLineRisk } from "@/features/intelligence/service";
import { getFleetSnapshot } from "@/server/sptrans/fleet";
import { getLines } from "@/server/transit/service";
import { buildOverview, type Overview } from "./overview";
import { operatingMode } from "./weights";

/**
 * Overview sem banco de dados: os mesmos indicadores calculados a partir dos dados ao vivo
 * (linhas monitoradas da SPTrans, frota do Olho Vivo e risco estimado agora). Sem histórico guardado.
 */
export async function loadLiveOverview(now = new Date()): Promise<Overview & { dbAvailable: false; liveFallback: true }> {
  const [{ lines }, fleet] = await Promise.all([getLines(), getFleetSnapshot()]);
  const live = fleet.state === "LIVE";
  const fetched = Date.parse(fleet.fetchedAt);

  // posições das linhas monitoradas (letreiro + sentido)
  const wanted = new Set(lines.map((l) => `${l.displayCode}|${l.direction}`));
  const vehicles = live
    ? fleet.vehicles
        .filter((v) => wanted.has(`${v[0]}|${v[1]}`))
        .map((v) => ({ observedAt: new Date(fetched - Math.max(0, v[6]) * 1000), isDemo: false }))
    : [];

  // risco estimado agora para cada linha/sentido monitorado
  const estimates = await Promise.all(
    lines.map(async (l) => {
      const r = await getGtfsLineRisk(l.displayCode, l.direction === 2 ? 1 : 0, { now }).catch(() => null);
      return { riskLevel: r?.level ?? ("INSUFFICIENT_DATA" as const), calculatedAt: now, expiresAt: new Date(now.getTime() + 10 * 60_000) };
    }),
  );

  const overview = buildOverview({
    now,
    mode: operatingMode(process.env),
    lines: lines.map((l) => ({ active: true, source: l.source })),
    vehicles,
    estimates,
    integrations: [{ state: live ? "CONNECTED" : "UNAVAILABLE", configured: true }],
  });
  return { ...overview, dbAvailable: false, liveFallback: true };
}
