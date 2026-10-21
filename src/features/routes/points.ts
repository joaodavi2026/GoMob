import type { GeoPoint } from "@/types/transit";

/** Lê "lat,lng,label" (label opcional, pode conter vírgulas). Retorna null se inválido. */
export function parsePointParam(raw: string | null | undefined): GeoPoint | null {
  if (!raw) return null;
  const parts = raw.split(",");
  if (parts.length < 2) return null;
  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  const label = parts.slice(2).join(",").trim();
  return { latitude, longitude, label: label || undefined };
}

export function formatPointParam(p: GeoPoint): string {
  return `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)},${(p.label ?? "").replace(/\s+/g, " ")}`;
}
