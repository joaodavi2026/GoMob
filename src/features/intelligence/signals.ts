import type { TransitStop, TransitVehicle } from "@/types/transit";
import { clamp, normalize, type FactorObservation } from "./engine";

type LL = { latitude: number; longitude: number };

export function haversineMeters(a: LL, b: LL): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Projeta p sobre a polilinha; devolve distância acumulada ao longo dela e distância lateral (m). */
export function projectOntoPolyline(line: LL[], p: LL): { along: number; off: number } | null {
  if (line.length < 2) return null;
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((p.latitude * Math.PI) / 180);
  let acc = 0;
  let best: { along: number; off: number } | null = null;
  for (let i = 0; i < line.length - 1; i++) {
    const ax = (line[i].longitude - p.longitude) * mPerDegLng;
    const ay = (line[i].latitude - p.latitude) * mPerDegLat;
    const bx = (line[i + 1].longitude - p.longitude) * mPerDegLng;
    const by = (line[i + 1].latitude - p.latitude) * mPerDegLat;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const segLen = Math.sqrt(len2);
    const t = len2 === 0 ? 0 : clamp(-(ax * dx + ay * dy) / len2, 0, 1);
    const off = Math.hypot(ax + t * dx, ay + t * dy);
    if (!best || off < best.off) best = { along: acc + t * segLen, off };
    acc += segLen;
  }
  return best;
}

export const MAX_VEHICLE_AGE_MIN = 10;
export const MAX_OFF_ROUTE_M = 800;
export const MIN_VEHICLES = 3;

export type SpacingSignals = {
  headway: FactorObservation;
  operations: FactorObservation;
  vehiclesUsed: number;
  reason?: "TOO_FEW_VEHICLES" | "NO_GEOMETRY" | "STALE" | "DEGENERATE";
};

/**
 * Irregularidade de intervalos (I) e de distribuição (O) a partir de posições de veículos ao longo da linha.
 * Usa o espaçamento espacial como proxy: sem referência de tabela confiável, não compara com intervalos programados.
 * Menos de 3 veículos utilizáveis => ambos ausentes (null), nunca zero.
 */
export function computeSpacingSignals(vehicles: TransitVehicle[], stops: TransitStop[], now: Date = new Date()): SpacingSignals {
  const none = (reason: SpacingSignals["reason"], n = 0): SpacingSignals => ({
    headway: { value: null },
    operations: { value: null },
    vehiclesUsed: n,
    reason,
  });
  if (stops.length < 2) return none("NO_GEOMETRY");
  const fresh = vehicles.filter((v) => {
    const t = Date.parse(v.observedAt);
    return !Number.isNaN(t) && (now.getTime() - t) / 60000 <= MAX_VEHICLE_AGE_MIN;
  });
  if (vehicles.length > 0 && fresh.length === 0) return none("STALE");
  const pos = fresh
    .map((v) => ({ v, p: projectOntoPolyline(stops, v) }))
    .filter((x): x is { v: TransitVehicle; p: { along: number; off: number } } => !!x.p && x.p.off <= MAX_OFF_ROUTE_M)
    .map((x) => ({ along: x.p.along, observedAt: Date.parse(x.v.observedAt), src: x.v.source }))
    .sort((a, b) => a.along - b.along);
  if (pos.length < MIN_VEHICLES) return none("TOO_FEW_VEHICLES", pos.length);

  const gaps: number[] = [];
  for (let i = 1; i < pos.length; i++) gaps.push(pos[i].along - pos[i - 1].along);
  const mean = (pos[pos.length - 1].along - pos[0].along) / gaps.length;
  if (mean < 1) return none("DEGENERATE", pos.length);

  const variance = gaps.reduce((s, g) => s + (g - mean) ** 2, 0) / gaps.length;
  const cv = Math.sqrt(variance) / mean;
  const headwayScore = normalize(cv, 0.25, 1.25);

  const bunchLimit = Math.max(100, 0.25 * mean);
  const bunchShare = gaps.filter((g) => g < bunchLimit).length / gaps.length;
  const bigGap = normalize(Math.max(...gaps) / mean, 1.5, 3.5);
  const opsScore = clamp(0.6 * clamp(bunchShare * 200) + 0.4 * bigGap);

  const observedAt = new Date(Math.max(...pos.map((p) => p.observedAt))).toISOString();
  const origin = pos.every((p) => p.src === "DEMO") ? "DEMO" : "DERIVED";
  return {
    headway: { value: Math.round(headwayScore), observedAt, granularity: "REALTIME", origin },
    operations: { value: Math.round(opsScore), observedAt, granularity: "REALTIME", origin },
    vehiclesUsed: pos.length,
  };
}

/** Atraso (A): só com referência temporal válida (minutos de atraso observados contra tabela confiável). */
export function computeDelayFactor(delayMinutes: number | null | undefined, observedAt?: string): FactorObservation {
  if (delayMinutes === null || delayMinutes === undefined || !Number.isFinite(delayMinutes)) return { value: null };
  return { value: Math.round(normalize(delayMinutes, 0, 15)), observedAt, granularity: "REFERENCE", origin: "DERIVED" };
}
