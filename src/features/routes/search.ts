import { z } from "zod";
import type { BusRouteOption, GeoPoint, RiskResult, RouteProvider } from "@/types/transit";
import { aggregateRouteRisk, busLineCodes } from "./risk";
import { recommend } from "./recommend";
import { sortRoutes } from "./sort";
import type { RouteResult, RouteSearchResponse, SortKey } from "./types";
import { filterBusOnly } from "./validate";

const pointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  label: z.string().trim().max(120).optional(),
});

export const routeSearchSchema = z.object({
  origin: pointSchema,
  destination: pointSchema,
  sort: z.enum(["fastest", "fewer_transfers", "less_walking", "lower_risk"]).optional(),
});

export type RiskLookup = (lineCode: string, lineId: string | undefined, option: BusRouteOption) => Promise<RiskResult | null>;

export class RouteProviderUnavailableError extends Error {}

/**
 * Orquestra a busca: provedor -> filtro BUS-only -> risco por linha -> risco agregado -> ordenação -> recomendação.
 * Testável sem DB: provedor e consulta de risco são injetados.
 */
export async function runRouteSearch(
  input: { origin: GeoPoint; destination: GeoPoint; sort?: SortKey },
  deps: { provider: RouteProvider; riskFor: RiskLookup; now?: () => Date },
): Promise<RouteSearchResponse> {
  let options: BusRouteOption[];
  try {
    options = await deps.provider.searchRoutes(input.origin, input.destination);
  } catch {
    throw new RouteProviderUnavailableError("Route provider unavailable.");
  }
  const { accepted } = filterBusOnly(options);
  const now = deps.now?.() ?? new Date();

  const routes: RouteResult[] = await Promise.all(
    accepted.map(async (option) => {
      const lineRisks: Record<string, RiskResult> = {};
      await Promise.all(
        busLineCodes(option).map(async (code) => {
          const step = option.steps.find((s) => s.kind === "BUS" && s.lineCode === code);
          const lineId = step && step.kind === "BUS" ? step.lineId : undefined;
          try {
            const r = await deps.riskFor(code, lineId, option);
            if (r) lineRisks[code] = r;
          } catch {
            // sem risco para a linha: tratado como dado insuficiente na agregação
          }
        }),
      );
      return { ...option, lineRisks, risk: aggregateRouteRisk(option, lineRisks, now) };
    }),
  );

  const sort = sortRoutes(routes, input.sort ?? "fastest");
  return {
    routes: sort.routes,
    recommendations: recommend(sort.routes),
    provider: deps.provider.name,
    sortApplied: sort.applied,
    notice: sort.notice,
    isDemo: deps.provider.name === "DEMO",
  };
}
