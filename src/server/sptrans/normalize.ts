import { shouldDiscard } from "@/server/transit/freshness";
import type { TransitLine, TransitStop, TransitVehicle } from "@/types/transit";
import type { RawLine, RawStop, RawVehicle } from "./types";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

export const SP_LINE_ID_RE = /^sp-\d{1,9}$/;
export const spLineId = (cl: number | string) => `sp-${cl}`;

/**
 * Datas da SPTrans: a doc indica ISO 8601 em UTC ("...Z"). Se vier sem fuso, assume-se
 * America/Sao_Paulo (UTC-03:00; sem horário de verão desde 2019).
 */
export function parseSptransTimestamp(v: unknown): Date | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const s = v.trim();
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(s);
  const d = new Date(hasZone ? s : `${s}-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isValidSaoPauloCoord(lat: number, lng: number): boolean {
  // Caixa generosa da região metropolitana; descarta (0,0) e lixo.
  return lat > -24.5 && lat < -22.8 && lng > -47.5 && lng < -45.8;
}

export function normalizeLine(raw: RawLine): TransitLine | null {
  const cl = num(raw.cl);
  const sl = num(raw.sl);
  const lt = str(raw.lt);
  const tl = num(raw.tl);
  if (cl === null || cl <= 0 || !Number.isInteger(cl) || (sl !== 1 && sl !== 2) || !lt) return null;
  const tp = str(raw.tp);
  const ts = str(raw.ts);
  const name = sl === 1 ? [tp, ts] : [ts, tp];
  return {
    id: spLineId(cl),
    externalCode: String(cl),
    displayCode: tl === null ? lt : `${lt}-${tl}`,
    name: name.filter(Boolean).join(" - ") || lt,
    direction: sl,
    source: "SPTRANS",
  };
}

export function normalizeLines(raw: unknown): TransitLine[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: TransitLine[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const l = normalizeLine(r as RawLine);
    if (l && !seen.has(l.id)) {
      seen.add(l.id);
      out.push(l);
    }
  }
  return out;
}

export function normalizeStops(raw: unknown): TransitStop[] {
  if (!Array.isArray(raw)) return [];
  const out: TransitStop[] = [];
  for (const r of raw as RawStop[]) {
    if (!r || typeof r !== "object") continue;
    const cp = num(r.cp);
    const lat = num(r.py);
    const lng = num(r.px);
    if (cp === null || lat === null || lng === null || !isValidSaoPauloCoord(lat, lng)) continue;
    out.push({ id: `sps-${cp}`, name: str(r.np) || `Stop ${cp}`, latitude: lat, longitude: lng, source: "SPTRANS" });
  }
  return out;
}

export type NormalizedPositions = { vehicles: TransitVehicle[]; discarded: number };

/** Normaliza /Posicao/Linha. Descarta posições inválidas ou muito antigas; as demais antigas mantêm o observedAt real (cliente marca STALE). */
export function normalizePositions(raw: unknown, lineId: string, now: number = Date.now()): NormalizedPositions {
  const vs = raw && typeof raw === "object" ? (raw as { vs?: unknown }).vs : undefined;
  if (!Array.isArray(vs)) return { vehicles: [], discarded: 0 };
  const vehicles: TransitVehicle[] = [];
  let discarded = 0;
  const seen = new Set<string>();
  for (const r of vs as RawVehicle[]) {
    const p = r && typeof r === "object" ? str(r.p) : "";
    const lat = r && typeof r === "object" ? num(r.py) : null;
    const lng = r && typeof r === "object" ? num(r.px) : null;
    const ts = r && typeof r === "object" ? parseSptransTimestamp(r.ta) : null;
    if (!/^\d{1,9}$/.test(p) || lat === null || lng === null || !ts || !isValidSaoPauloCoord(lat, lng)) {
      discarded++;
      continue;
    }
    const observedAt = ts.toISOString();
    if (shouldDiscard(observedAt, now) || seen.has(p)) {
      discarded++;
      continue;
    }
    seen.add(p);
    vehicles.push({ id: `spv-${p}`, lineId, latitude: lat, longitude: lng, observedAt, source: "SPTRANS" });
  }
  return { vehicles, discarded };
}
