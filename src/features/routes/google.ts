import type { BusRouteOption, GeoPoint, RouteProvider, RouteStep } from "@/types/transit";
import { isBusVehicleType, looksNonBus } from "./validate";

/**
 * Adaptador OPCIONAL do Google Routes API (computeRoutes). Desativado por padrão: exige GOOGLE_ROUTES_API_KEY
 * E GOOGLE_ROUTES_ENABLED=true (serviço com faturamento). Nunca é dependência obrigatória.
 */
export function isGoogleRoutesEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return !!env.GOOGLE_ROUTES_API_KEY?.trim() && env.GOOGLE_ROUTES_ENABLED === "true";
}

export const GOOGLE_ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes";
export const GOOGLE_FIELD_MASK = [
  "routes.duration",
  "routes.polyline.encodedPolyline",
  "routes.legs.steps.travelMode",
  "routes.legs.steps.staticDuration",
  "routes.legs.steps.distanceMeters",
  "routes.legs.steps.navigationInstruction",
  "routes.legs.steps.transitDetails",
].join(",");

type GStep = {
  travelMode?: string;
  staticDuration?: string;
  navigationInstruction?: { instructions?: string };
  transitDetails?: {
    stopDetails?: { departureStop?: { name?: string }; arrivalStop?: { name?: string } };
    transitLine?: { name?: string; nameShort?: string; vehicle?: { type?: string } };
  };
};
type GRoute = { duration?: string; polyline?: { encodedPolyline?: string }; legs?: { steps?: GStep[] }[] };

function secs(d: string | undefined): number {
  const m = /^(\d+(?:\.\d+)?)s$/.exec(d ?? "");
  return m ? Number(m[1]) : 0;
}

/** Decodifica polyline codificada do Google (precisão 1e5). Retorna [lng, lat]. */
export function decodePolyline(encoded: string): [number, number][] {
  const out: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    for (const axis of [0, 1]) {
      let result = 0;
      let shift = 0;
      let b: number;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20 && index < encoded.length + 1);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta;
      else lng += delta;
    }
    out.push([lng / 1e5, lat / 1e5]);
  }
  return out;
}

/**
 * Converte a resposta do Google em BusRouteOption. Valida CADA etapa: qualquer modo que não seja caminhada
 * ou transporte coletivo do tipo BUS rejeita a rota inteira. Retorna as aceitas e as rejeitadas (com motivo).
 */
export function parseGoogleRoutes(json: unknown, stamp: string, origin: GeoPoint, destination: GeoPoint) {
  const routes = ((json as { routes?: GRoute[] } | null)?.routes ?? []) as GRoute[];
  const accepted: BusRouteOption[] = [];
  const rejected: { index: number; reason: string }[] = [];
  routes.forEach((r, idx) => {
    const steps: RouteStep[] = [];
    let reason: string | null = null;
    const rawSteps = (r.legs ?? []).flatMap((l) => l.steps ?? []);
    if (rawSteps.length === 0) reason = "No steps.";
    let lastPoint = origin.label ?? "Origin";
    for (const s of rawSteps) {
      if (reason) break;
      const minutes = Math.max(1, Math.round(secs(s.staticDuration) / 60));
      if (s.travelMode === "WALK") {
        steps.push({ kind: "WALK", minutes, from: lastPoint, to: s.navigationInstruction?.instructions ?? "Next point" });
      } else if (s.travelMode === "TRANSIT") {
        const line = s.transitDetails?.transitLine;
        if (!isBusVehicleType(line?.vehicle?.type)) {
          reason = `Non-bus transit vehicle (${line?.vehicle?.type ?? "unknown"}).`;
          break;
        }
        const code = line?.nameShort ?? line?.name ?? "";
        if (looksNonBus(code, line?.name)) {
          reason = `Line ${code} is not a bus service.`;
          break;
        }
        if (!code) {
          reason = "Bus step without a line identifier.";
          break;
        }
        const board = s.transitDetails?.stopDetails?.departureStop?.name ?? "";
        const alight = s.transitDetails?.stopDetails?.arrivalStop?.name ?? "";
        steps.push({ kind: "BUS", lineCode: code, lineName: line?.name ?? code, boardStop: board, alightStop: alight, minutes });
        lastPoint = alight;
      } else {
        reason = `Unsupported travel mode (${s.travelMode ?? "unknown"}).`;
      }
    }
    const buses = steps.filter((s) => s.kind === "BUS").length;
    if (!reason && buses === 0) reason = "No bus step.";
    if (!reason) {
      const option: BusRouteOption = {
        id: `google:${idx}:${steps.map((s) => (s.kind === "BUS" ? s.lineCode : "w")).join("-")}`,
        steps,
        durationMinutes: r.duration ? Math.round(secs(r.duration) / 60) : null,
        walkMinutes: steps.reduce((n, s) => n + (s.kind === "WALK" ? s.minutes : 0), 0),
        transfers: buses - 1,
        path: r.polyline?.encodedPolyline ? decodePolyline(r.polyline.encodedPolyline) : [],
        source: "GOOGLE",
        dataTimestamp: stamp,
      };
      accepted.push(option);
    }
    if (reason) rejected.push({ index: idx, reason });
  });
  return { accepted, rejected };
}

type CacheEntry = { at: number; value: BusRouteOption[] };

export class GoogleRoutesProvider implements RouteProvider {
  readonly name = "GOOGLE";
  private cache = new Map<string, CacheEntry>();
  constructor(
    private readonly opts: { apiKey: string; fetchImpl?: typeof fetch; ttlMs?: number; now?: () => number },
  ) {}

  private key(o: GeoPoint, d: GeoPoint) {
    const r = (n: number) => n.toFixed(4);
    return `${r(o.latitude)},${r(o.longitude)}>${r(d.latitude)},${r(d.longitude)}`;
  }

  async searchRoutes(origin: GeoPoint, destination: GeoPoint): Promise<BusRouteOption[]> {
    const now = this.opts.now?.() ?? Date.now();
    const ttl = this.opts.ttlMs ?? 5 * 60_000;
    const k = this.key(origin, destination);
    const hit = this.cache.get(k);
    if (hit && now - hit.at < ttl) return hit.value;

    const f = this.opts.fetchImpl ?? fetch;
    const res = await f(GOOGLE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.opts.apiKey,
        "X-Goog-FieldMask": GOOGLE_FIELD_MASK,
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.latitude, longitude: origin.longitude } } },
        destination: { location: { latLng: { latitude: destination.latitude, longitude: destination.longitude } } },
        travelMode: "TRANSIT",
        computeAlternativeRoutes: true,
        transitPreferences: { allowedTravelModes: ["BUS"] },
        languageCode: "pt-BR",
        units: "METRIC",
      }),
    });
    if (!res.ok) throw new Error(`Google Routes responded with ${res.status}`);
    const json = await res.json();
    const { accepted } = parseGoogleRoutes(json, new Date(now).toISOString(), origin, destination);
    this.cache.set(k, { at: now, value: accepted });
    return accepted;
  }
}
