import { getDemoRisk, getGtfsLineRisk, getLineRisk } from "@/features/intelligence/service";
import { getLines } from "@/server/transit/service";
import type { RiskResult, RouteProvider } from "@/types/transit";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DemoRouteProvider } from "./demo-provider";
import { GtfsRouteProvider } from "./gtfs-provider";
import { GoogleRoutesProvider, isGoogleRoutesEnabled } from "./google";
import { runRouteSearch, type RiskLookup } from "./search";
import type { RouteSearchResponse, SortKey } from "./types";
import type { GeoPoint } from "@/types/transit";

let demoProvider: RouteProvider | null = null;
let googleProvider: RouteProvider | null = null;
let gtfsProvider: RouteProvider | null = null;

const GTFS_FILE = join(process.cwd(), "public", "gtfs", "network.json");

/**
 * Ordem: Google Routes (só se habilitado com chave + flag) → GTFS oficial da SPTrans (rede inteira)
 * → rede DEMO (só se o arquivo GTFS não existir).
 */
export function selectProvider(): RouteProvider {
  if (isGoogleRoutesEnabled()) {
    googleProvider ??= new GoogleRoutesProvider({ apiKey: process.env.GOOGLE_ROUTES_API_KEY!.trim() });
    return googleProvider;
  }
  if (existsSync(/*turbopackIgnore: true*/ GTFS_FILE)) {
    gtfsProvider ??= new GtfsRouteProvider(GTFS_FILE);
    return gtfsProvider;
  }
  demoProvider ??= new DemoRouteProvider();
  return demoProvider;
}

/** O risco é um extra: se a consulta demorar, a rota aparece sem ele. */
const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

const riskFor: RiskLookup = (code, lineId, option) => withTimeout(lookupRisk(code, lineId, option), 3000);

const lookupRisk: RiskLookup = async (code, lineId, option): Promise<RiskResult | null> => {
  // Rotas do GTFS: frota ao vivo (uma chamada em cache) + paradas do GTFS, no sentido da viagem.
  if (option.source === "GTFS") {
    const step = option.steps.find((s) => s.kind === "BUS" && s.lineCode === code);
    const direction = step && step.kind === "BUS" ? (step.direction ?? 0) : 0;
    return getGtfsLineRisk(code, direction);
  }
  if (lineId) return getLineRisk(lineId);
  try {
    const found = (await getLines({ search: code })).lines.find((l) => l.displayCode === code);
    if (found) return getLineRisk(found.id);
  } catch {
    // sem resolução da linha
  }
  // Linhas conectoras da rede demo não têm veículos: risco demonstrativo identificado.
  if (option.source === "DEMO") return getDemoRisk(code);
  return null;
};

export async function searchBusRoutes(input: { origin: GeoPoint; destination: GeoPoint; sort?: SortKey }): Promise<RouteSearchResponse> {
  return runRouteSearch(input, { provider: selectProvider(), riskFor });
}
