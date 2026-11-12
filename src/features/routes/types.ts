import type { BusRouteOption, RiskResult } from "@/types/transit";

export type SortKey = "fastest" | "fewer_transfers" | "less_walking" | "lower_risk";

export const SORT_LABELS: Record<SortKey, string> = {
  fastest: "Mais rápida",
  fewer_transfers: "Menos baldeações",
  less_walking: "Menos caminhada",
  lower_risk: "Menor risco estimado de lotação",
};

/** Rota com risco por linha (chave: código de exibição da linha). `risk` agrega as linhas. */
export type RouteResult = BusRouteOption & { lineRisks: Record<string, RiskResult> };

export type Recommendation = { routeId: string; reasons: string[] };

export type Recommendations = {
  fastest?: Recommendation;
  fewerTransfers?: Recommendation;
  lowerRisk?: Recommendation;
  balanced?: Recommendation;
  /** Explicações quando uma recomendação não foi emitida (ex.: dados de risco insuficientes). */
  notes: Partial<Record<"fastest" | "fewerTransfers" | "lowerRisk" | "balanced", string>>;
};

export type RouteSearchResponse = {
  routes: RouteResult[];
  recommendations: Recommendations;
  provider: string;
  sortApplied: SortKey;
  notice?: string;
  isDemo: boolean;
};
