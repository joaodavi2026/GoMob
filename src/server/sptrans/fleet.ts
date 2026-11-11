import { DISCARD_AFTER_MS } from "@/config/transit";
import { getSptransClient, isSptransConfigured } from "./client";
import { SptransError } from "./types";

/**
 * Veículo compacto da frota inteira:
 * [letreiro "8000-10", sentido (1|2), lat, lon, prefixo, acessível (0|1), idade em segundos]
 */
export type FleetVehicle = [string, number, number, number, string, 0 | 1, number];

export type FleetSnapshot =
  | { state: "LIVE"; refTime: string | null; fetchedAt: string; vehicles: FleetVehicle[] }
  | { state: "UNAVAILABLE"; reason: "NOT_CONFIGURED" | "AUTH" | "RATE_LIMIT" | "ERROR"; fetchedAt: string; vehicles: [] };

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
const SP_BBOX = { minLat: -24.1, maxLat: -23.3, minLon: -47.1, maxLon: -46.2 };

/** Normaliza a resposta bruta de GET /Posicao (campos tratados como não confiáveis). */
export function normalizeFleet(raw: unknown, nowMs: number): { refTime: string | null; vehicles: FleetVehicle[] } {
  const body = raw as { hr?: unknown; l?: unknown };
  const out: FleetVehicle[] = [];
  if (!body || !Array.isArray(body.l)) return { refTime: null, vehicles: out };
  for (const line of body.l as Record<string, unknown>[]) {
    const code = typeof line?.c === "string" ? line.c.slice(0, 16) : null;
    const sl = num(line?.sl);
    if (!code || !Array.isArray(line.vs)) continue;
    for (const v of line.vs as Record<string, unknown>[]) {
      const lat = num(v?.py), lon = num(v?.px);
      if (!(lat > SP_BBOX.minLat && lat < SP_BBOX.maxLat && lon > SP_BBOX.minLon && lon < SP_BBOX.maxLon)) continue;
      const ts = typeof v.ta === "string" ? Date.parse(v.ta) : NaN;
      const age = Number.isFinite(ts) ? Math.max(0, Math.round((nowMs - ts) / 1000)) : -1;
      if (age * 1000 > DISCARD_AFTER_MS) continue;
      out.push([code, sl === 2 ? 2 : 1, Math.round(lat * 1e5) / 1e5, Math.round(lon * 1e5) / 1e5, String(v.p ?? "").slice(0, 10), v.a === true ? 1 : 0, age]);
    }
  }
  return { refTime: typeof body.hr === "string" ? body.hr : null, vehicles: out };
}

export async function getFleetSnapshot(): Promise<FleetSnapshot> {
  const fetchedAt = new Date().toISOString();
  if (!isSptransConfigured()) return { state: "UNAVAILABLE", reason: "NOT_CONFIGURED", fetchedAt, vehicles: [] };
  try {
    const raw = await getSptransClient().allPositions();
    const { refTime, vehicles } = normalizeFleet(raw, Date.now());
    return { state: "LIVE", refTime, fetchedAt, vehicles };
  } catch (e) {
    const kind = e instanceof SptransError ? e.kind : "UNKNOWN";
    const reason = kind === "AUTH" ? "AUTH" : kind === "RATE_LIMIT" ? "RATE_LIMIT" : "ERROR";
    return { state: "UNAVAILABLE", reason, fetchedAt, vehicles: [] };
  }
}
