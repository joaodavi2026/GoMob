import type { DemoScenario, IntegrationState, TransitLine, TransitStop, TransitVehicle } from "@/types/transit";

/**
 * Provedor DEMO determinístico. Linhas, paradas e polylines são FICTÍCIAS (inspiradas em corredores
 * de São Paulo) e sempre identificadas com source "DEMO". Posições dependem apenas de (linha, cenário, tempo).
 */

type DemoLineDef = {
  n: number;
  displayCode: string;
  name: string;
  periodSec: number;
  vehicles: number;
  path: [number, number][]; // [lng, lat]
  stopNames: string[]; // um por vértice da polyline
};

const DEFS: DemoLineDef[] = [
  {
    n: 1,
    displayCode: "D-100",
    name: "Paraíso - Consolação (Av. Paulista)",
    periodSec: 2400,
    vehicles: 5,
    path: [
      [-46.6417, -23.5887],
      [-46.6475, -23.5760],
      [-46.6559, -23.5617],
      [-46.6620, -23.5557],
      [-46.6670, -23.5510],
    ],
    stopNames: ["Paraíso", "Brigadeiro", "MASP", "Consolação", "Higienópolis"],
  },
  {
    n: 2,
    displayCode: "D-200",
    name: "Pinheiros - Itaim (Av. Faria Lima)",
    periodSec: 2100,
    vehicles: 5,
    path: [
      [-46.6919, -23.5667],
      [-46.6895, -23.5710],
      [-46.6870, -23.5750],
      [-46.6840, -23.5800],
      [-46.6810, -23.5850],
    ],
    stopNames: ["Largo da Batata", "Faria Lima Norte", "Faria Lima Centro", "Juscelino Kubitschek", "Itaim"],
  },
  {
    n: 3,
    displayCode: "D-300",
    name: "Sé - Tatuapé (Radial Leste)",
    periodSec: 2700,
    vehicles: 6,
    path: [
      [-46.6333, -23.5505],
      [-46.6163, -23.5448],
      [-46.5990, -23.5430],
      [-46.5870, -23.5420],
      [-46.5760, -23.5405],
    ],
    stopNames: ["Sé", "Brás", "Belém", "Carrão", "Tatuapé"],
  },
  {
    n: 4,
    displayCode: "D-400",
    name: "Santo Amaro - Ibirapuera",
    periodSec: 3000,
    vehicles: 5,
    path: [
      [-46.7090, -23.6545],
      [-46.6990, -23.6290],
      [-46.6960, -23.6130],
      [-46.6700, -23.5990],
      [-46.6576, -23.5874],
    ],
    stopNames: ["Largo Treze", "Av. Santo Amaro", "Brooklin", "Moema", "Ibirapuera"],
  },
  {
    n: 5,
    displayCode: "D-500",
    name: "Barra Funda - Pompeia",
    periodSec: 1800,
    vehicles: 4,
    path: [
      [-46.6670, -23.5265],
      [-46.6700, -23.5330],
      [-46.6760, -23.5400],
      [-46.6830, -23.5280],
    ],
    stopNames: ["Barra Funda", "Água Branca", "Perdizes", "Pompeia"],
  },
];

export const DEMO_LINE_ID_RE = /^demo-[1-9]\d{0,1}$/;
export const DEMO_VEHICLE_ID_RE = /^dmv-([1-9]\d?)-(\d{1,2})$/;
const SNAP_MS = 15_000; // "atualização" da posição demo a cada 15 s
const STALE_LAG_MS = 20 * 60_000;
const RECOVERY_MS = 10 * 60_000;

const lineId = (n: number) => `demo-${n}`;
const def = (id: string) => DEFS.find((d) => lineId(d.n) === id);

export function demoLines(): TransitLine[] {
  return DEFS.map((d) => ({
    id: lineId(d.n),
    externalCode: String(d.n),
    displayCode: d.displayCode,
    name: d.name,
    direction: 1 as const,
    source: "DEMO" as const,
  }));
}

export function demoLine(id: string): TransitLine | null {
  return demoLines().find((l) => l.id === id) ?? null;
}

export function demoPath(id: string): [number, number][] {
  return def(id)?.path ?? [];
}

export function demoStops(id: string): TransitStop[] {
  const d = def(id);
  if (!d) return [];
  return d.path.map(([lng, lat], i) => ({
    id: `dms-${d.n}-${i + 1}`,
    name: `${d.stopNames[i] ?? `Stop ${i + 1}`} (demo)`,
    latitude: lat,
    longitude: lng,
    source: "DEMO" as const,
  }));
}

// --- geometria -------------------------------------------------------------------------------

function haversine(a: [number, number], b: [number, number]) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Ponto ao longo da polyline em fração u (0..1) do comprimento. */
export function pointAlong(path: [number, number][], u: number): [number, number] {
  const clamped = Math.min(1, Math.max(0, u));
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const d = haversine(path[i - 1], path[i]);
    seg.push(d);
    total += d;
  }
  let target = clamped * total;
  for (let i = 0; i < seg.length; i++) {
    if (target <= seg[i] || i === seg.length - 1) {
      const r = seg[i] === 0 ? 0 : Math.min(1, target / seg[i]);
      return [path[i][0] + (path[i + 1][0] - path[i][0]) * r, path[i][1] + (path[i + 1][1] - path[i][1]) * r];
    }
    target -= seg[i];
  }
  return path[path.length - 1];
}

// --- fases (espaçamento) por cenário ----------------------------------------------------------

const frac = (x: number) => x - Math.floor(x);

/** Espaçamento regular. */
function regularPhase(k: number, count: number, n: number) {
  return frac(k / count + n * 0.07);
}
/** Bunching: veículos agrupados em pares/trios. */
function bunchedPhase(k: number, count: number, n: number) {
  const groups = Math.max(1, Math.ceil(count / 3));
  const g = Math.floor(k / 3);
  const within = k % 3;
  return frac(g / groups + within * 0.015 + n * 0.07);
}

function phaseFor(scenario: DemoScenario, k: number, count: number, n: number, now: number, recoveryStartedAt?: string | null) {
  if (scenario === "B_HIGH_RISK") return bunchedPhase(k, count, n);
  if (scenario === "D_RECOVERY") {
    const start = recoveryStartedAt ? Date.parse(recoveryStartedAt) : NaN;
    const f = Number.isFinite(start) ? Math.min(1, Math.max(0, (now - start) / RECOVERY_MS)) : 0.5;
    const a = bunchedPhase(k, count, n);
    const b = regularPhase(k, count, n);
    // interpolação pelo menor arco no círculo
    let d = b - a;
    if (d > 0.5) d -= 1;
    if (d < -0.5) d += 1;
    return frac(a + d * f);
  }
  return regularPhase(k, count, n);
}

function positionAt(d: DemoLineDef, phase: number, atMs: number): [number, number] {
  const s = frac(atMs / 1000 / d.periodSec + phase);
  const u = s < 0.5 ? s * 2 : (1 - s) * 2; // ida e volta sem teleporte
  return pointAlong(d.path, u);
}

export type DemoVehiclesResult = { vehicles: TransitVehicle[]; state: IntegrationState };

export function demoVehicles(
  id: string,
  scenario: DemoScenario,
  now: number = Date.now(),
  recoveryStartedAt?: string | null,
): DemoVehiclesResult {
  const d = def(id);
  if (!d) return { vehicles: [], state: "DEMO" };

  if (scenario === "C_UNAVAILABLE") {
    // Linhas pares: dados obsoletos (posições congeladas há ~20 min); ímpares: sem dados.
    if (d.n % 2 === 1) return { vehicles: [], state: "UNAVAILABLE" };
    const snap = Math.floor(now / SNAP_MS) * SNAP_MS - STALE_LAG_MS;
    return { vehicles: build(d, scenario, snap, now), state: "STALE" };
  }
  const snap = Math.floor(now / SNAP_MS) * SNAP_MS;
  return { vehicles: build(d, scenario, snap, now, recoveryStartedAt), state: "DEMO" };
}

function build(d: DemoLineDef, scenario: DemoScenario, atMs: number, now: number, recoveryStartedAt?: string | null): TransitVehicle[] {
  const out: TransitVehicle[] = [];
  for (let k = 0; k < d.vehicles; k++) {
    const phase = phaseFor(scenario, k, d.vehicles, d.n, atMs, recoveryStartedAt);
    const [lng, lat] = positionAt(d, phase, atMs);
    out.push({
      id: `dmv-${d.n}-${k + 1}`,
      lineId: lineId(d.n),
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lng.toFixed(6)),
      observedAt: new Date(atMs).toISOString(),
      source: "DEMO",
    });
  }
  void now;
  return out;
}

export function demoVehicleById(
  vehicleId: string,
  scenario: DemoScenario,
  now: number = Date.now(),
  recoveryStartedAt?: string | null,
): TransitVehicle | null {
  const m = DEMO_VEHICLE_ID_RE.exec(vehicleId);
  if (!m) return null;
  return demoVehicles(`demo-${m[1]}`, scenario, now, recoveryStartedAt).vehicles.find((v) => v.id === vehicleId) ?? null;
}
