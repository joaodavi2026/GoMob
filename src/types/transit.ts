export type DataSourceKind = "SPTRANS" | "DEMO";
export type GeoPoint = { latitude: number; longitude: number; label?: string };

export type TransitLine = {
  id: string; // id interno normalizado
  externalCode: string;
  displayCode: string; // ex.: "8000-10"
  name: string;
  direction: 1 | 2;
  source: DataSourceKind;
};

export type TransitStop = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  source: DataSourceKind;
};

export type TransitVehicle = {
  id: string;
  lineId: string;
  latitude: number;
  longitude: number;
  observedAt: string; // ISO
  source: DataSourceKind;
};

export type DataFreshness = "FRESH" | "STALE" | "UNAVAILABLE";

export type IntegrationState = "CONNECTED" | "UPDATING" | "UNAVAILABLE" | "STALE" | "DEMO";

export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "INSUFFICIENT_DATA";

export type RiskResult = {
  score: number | null;
  level: RiskLevel;
  confidence: number | null;
  factors: {
    demand: number | null;
    headway: number | null;
    delay: number | null;
    operations: number | null;
  };
  source: "OFFICIAL" | "DERIVED" | "DEMO";
  calculatedAt: string;
  explanation: string;
};

export type RouteStep =
  | { kind: "WALK"; minutes: number; from: string; to: string }
  | { kind: "BUS"; lineCode: string; lineName: string; boardStop: string; alightStop: string; minutes: number; lineId?: string };

export type BusRouteOption = {
  id: string;
  steps: RouteStep[];
  durationMinutes: number | null;
  walkMinutes: number;
  transfers: number;
  path: [number, number][]; // [lng, lat]
  source: "DEMO" | "GTFS" | "GOOGLE";
  dataTimestamp: string;
  risk?: RiskResult;
};

export interface RouteProvider {
  readonly name: string;
  searchRoutes(origin: GeoPoint, destination: GeoPoint): Promise<BusRouteOption[]>;
}

/** Cenários demonstrativos controlados pelo admin. */
export type DemoScenario = "A_NORMAL" | "B_HIGH_RISK" | "C_UNAVAILABLE" | "D_RECOVERY";
