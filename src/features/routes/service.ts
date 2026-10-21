import { getDemoRisk, getLineRisk } from "@/features/intelligence/service";
import { getLines } from "@/server/transit/service";
import type { RiskResult, RouteProvider } from "@/types/transit";
import { DemoRouteProvider } from "./demo-provider";
import { GoogleRoutesProvider, isGoogleRoutesEnabled } from "./google";
import { runRouteSearch, type RiskLookup } from "./search";
import type { RouteSearchResponse, SortKey } from "./types";
import type { GeoPoint } from "@/types/transit";

let demoProvider: RouteProvider | null = null;
let googleProvider: RouteProvider | null = null;

/** Google Routes só quando explicitamente habilitado (chave + flag); caso contrário, provedor DEMO. */
export function selectProvider(): RouteProvider {
  if (isGoogleRoutesEnabled()) {
    googleProvider ??= new GoogleRoutesProvider({ apiKey: process.env.GOOGLE_ROUTES_API_KEY!.trim() });
    return googleProvider;
  }
  demoProvider ??= new DemoRouteProvider();
  return demoProvider;
}

const riskFor: RiskLookup = async (code, lineId, option): Promise<RiskResult | null> => {
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
