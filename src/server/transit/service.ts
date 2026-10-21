import { DISCARD_AFTER_MS, LIVE_SEED_SEARCH_TERMS } from "@/config/transit";
import { getSptransClient, isSptransConfigured, type SptransClient } from "@/server/sptrans/client";
import { normalizeLines, normalizePositions, normalizeStops, SP_LINE_ID_RE } from "@/server/sptrans/normalize";
import { SptransError } from "@/server/sptrans/types";
import type {
  DataSourceKind,
  DemoScenario,
  IntegrationState,
  TransitLine,
  TransitStop,
  TransitVehicle,
} from "@/types/transit";
import { classifyFreshness } from "./freshness";
import { DEMO_LINE_ID_RE, DEMO_VEHICLE_ID_RE, demoLine, demoLines, demoPath, demoStops, demoVehicleById, demoVehicles } from "./demo";

export type SystemStatus = {
  mode: "LIVE" | "DEMO";
  scenario: DemoScenario | null;
  integrations: {
    key: string;
    label: string;
    configured: boolean;
    state: IntegrationState;
    lastQueryAt: string | null;
    lastFailureAt: string | null;
  }[];
};

type ScenarioInfo = { scenario: DemoScenario; recoveryStartedAt?: string | null };

// --- dependências substituíveis (testes) -------------------------------------------------------
type Deps = {
  client: () => SptransClient;
  configured: () => boolean;
  scenario: () => Promise<ScenarioInfo>;
  now: () => number;
  activeOverrides: (source: DataSourceKind, codes: string[]) => Promise<Map<string, boolean>>;
};

const defaultDeps: Deps = {
  client: getSptransClient,
  configured: () => isSptransConfigured() && process.env.TRANSIT_FORCE_DEMO !== "1",
  scenario: async () => {
    try {
      const { getScenario } = await import("@/server/demo/scenario");
      const s = await withTimeout(getScenario(), 1500);
      return { scenario: s.scenario, recoveryStartedAt: s.recoveryStartedAt };
    } catch {
      return { scenario: "A_NORMAL" };
    }
  },
  now: () => Date.now(),
  activeOverrides: async (source, codes) => {
    const map = new Map<string, boolean>();
    if (!process.env.DATABASE_URL) return map;
    try {
      const { db } = await import("@/server/db");
      const rows = await withTimeout(
        db.busLine.findMany({ where: { source, externalCode: { in: codes } }, select: { externalCode: true, active: true } }),
        1500,
      );
      for (const r of rows) map.set(r.externalCode, r.active);
    } catch {
      // DB indisponível: usa padrão
    }
    return map;
  },
};
let deps: Deps = defaultDeps;
/** Somente testes. */
export function __setTransitDeps(d: Partial<Deps> | null) {
  deps = d ? { ...defaultDeps, ...d } : defaultDeps;
  lineRegistry.clear();
  vehicleRegistry.clear();
  liveState.lastFailureAt = null;
  liveState.lastSuccessAt = null;
  liveState.lastAttemptAt = null;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

// --- estado -------------------------------------------------------------------------------------
const lineRegistry = new Map<string, TransitLine>();
const vehicleRegistry = new Map<string, TransitVehicle>();
const liveState = { lastAttemptAt: null as number | null, lastSuccessAt: null as number | null, lastFailureAt: null as number | null };

function liveOk() {
  liveState.lastAttemptAt = deps.now();
  liveState.lastSuccessAt = deps.now();
}
function liveFail(e: unknown) {
  liveState.lastAttemptAt = deps.now();
  liveState.lastFailureAt = deps.now();
  const kind = e instanceof SptransError ? e.kind : "UNKNOWN";
  console.warn(`[transit] live provider failed (${kind}); falling back to DEMO`);
}
/** Live é considerado ativo se configurado e a última tentativa não falhou. */
function liveHealthy() {
  const { lastSuccessAt, lastFailureAt } = liveState;
  return !(lastFailureAt && (!lastSuccessAt || lastFailureAt >= lastSuccessAt));
}

const iso = (ms: number | null) => (ms ? new Date(ms).toISOString() : null);

function register(lines: TransitLine[]) {
  for (const l of lines) lineRegistry.set(l.id, l);
}

// --- linhas -------------------------------------------------------------------------------------
type LinesResult = { lines: (TransitLine & { active: boolean })[]; source: DataSourceKind; state: IntegrationState; fallbackFromLive?: boolean };

async function liveSeedLines(): Promise<TransitLine[]> {
  const client = deps.client();
  const results = await Promise.all(LIVE_SEED_SEARCH_TERMS.map((t) => client.searchLines(t)));
  const seen = new Map<string, TransitLine>();
  for (const r of results) for (const l of normalizeLines(r)) seen.set(l.id, l);
  return [...seen.values()];
}

async function withActive(lines: TransitLine[], defaultActive: (l: TransitLine) => boolean): Promise<(TransitLine & { active: boolean })[]> {
  if (!lines.length) return [];
  const overrides = await deps.activeOverrides(lines[0].source, lines.map((l) => l.externalCode));
  return lines.map((l) => ({ ...l, active: overrides.get(l.externalCode) ?? defaultActive(l) }));
}

export async function getLines(opts: { search?: string } = {}): Promise<LinesResult> {
  const search = opts.search?.trim().slice(0, 60) ?? "";
  let fallback = false;
  if (deps.configured()) {
    try {
      const seed = await liveSeedLines();
      const seedIds = new Set(seed.map((l) => l.id));
      let lines = seed;
      if (search) {
        const found = normalizeLines(await deps.client().searchLines(search));
        lines = found;
      }
      liveOk();
      register(lines);
      return { lines: await withActive(lines, (l) => seedIds.has(l.id)), source: "SPTRANS", state: "CONNECTED" };
    } catch (e) {
      liveFail(e);
      fallback = true;
    }
  }
  const q = search.toLowerCase();
  const base = demoLines().filter((l) => !q || l.displayCode.toLowerCase().includes(q) || l.name.toLowerCase().includes(q));
  register(base);
  const out: LinesResult = { lines: await withActive(base, () => true), source: "DEMO", state: "DEMO" };
  if (fallback) out.fallbackFromLive = true;
  return out;
}

export async function getLine(id: string): Promise<TransitLine | null> {
  if (DEMO_LINE_ID_RE.test(id)) return demoLine(id);
  if (!SP_LINE_ID_RE.test(id)) return null;
  if (!lineRegistry.has(id) && deps.configured()) {
    try {
      register(await liveSeedLines());
      liveOk();
    } catch (e) {
      liveFail(e);
    }
  }
  return lineRegistry.get(id) ?? null;
}

// --- veículos -----------------------------------------------------------------------------------
export type VehiclesResult = { vehicles: TransitVehicle[]; state: IntegrationState; fetchedAt: string; source: DataSourceKind; fallbackFromLive?: boolean };

async function demoResult(lineId: string, fallback: boolean): Promise<VehiclesResult> {
  const sc = await deps.scenario();
  const now = deps.now();
  const r = demoVehicles(lineId, sc.scenario, now, sc.recoveryStartedAt);
  for (const v of r.vehicles) vehicleRegistry.set(v.id, v);
  const out: VehiclesResult = { vehicles: r.vehicles, state: r.state, fetchedAt: new Date(now).toISOString(), source: "DEMO" };
  if (fallback) out.fallbackFromLive = true;
  return out;
}

export async function getVehicles(lineId: string): Promise<VehiclesResult> {
  if (DEMO_LINE_ID_RE.test(lineId)) return demoResult(lineId, false);
  if (!SP_LINE_ID_RE.test(lineId)) return { vehicles: [], state: "UNAVAILABLE", fetchedAt: new Date(deps.now()).toISOString(), source: "DEMO" };
  if (deps.configured()) {
    try {
      const raw = await deps.client().positionsByLine(Number(lineId.slice(3)));
      const now = deps.now();
      const { vehicles } = normalizePositions(raw, lineId, now);
      liveOk();
      for (const v of vehicles) vehicleRegistry.set(v.id, v);
      const allStale = vehicles.length > 0 && vehicles.every((v) => classifyFreshness(v.observedAt, now) !== "FRESH");
      return { vehicles, state: allStale ? "STALE" : "CONNECTED", fetchedAt: new Date(now).toISOString(), source: "SPTRANS" };
    } catch (e) {
      liveFail(e);
    }
  }
  // Linha real sem provedor live: não há posições demo para ela; devolve UNAVAILABLE identificado.
  return { vehicles: [], state: "UNAVAILABLE", fetchedAt: new Date(deps.now()).toISOString(), source: "DEMO", fallbackFromLive: true };
}

export async function getVehicle(id: string): Promise<TransitVehicle | null> {
  if (DEMO_VEHICLE_ID_RE.test(id)) {
    const sc = await deps.scenario();
    return demoVehicleById(id, sc.scenario, deps.now(), sc.recoveryStartedAt);
  }
  const v = vehicleRegistry.get(id);
  if (!v) return null;
  return deps.now() - Date.parse(v.observedAt) > DISCARD_AFTER_MS ? null : v;
}

// --- paradas ------------------------------------------------------------------------------------
export async function getStops(lineId: string): Promise<{ stops: TransitStop[]; source: DataSourceKind; fallbackFromLive?: boolean }> {
  if (DEMO_LINE_ID_RE.test(lineId)) return { stops: demoStops(lineId), source: "DEMO" };
  if (SP_LINE_ID_RE.test(lineId) && deps.configured()) {
    try {
      const stops = normalizeStops(await deps.client().stopsByLine(Number(lineId.slice(3))));
      liveOk();
      return { stops, source: "SPTRANS" };
    } catch (e) {
      liveFail(e);
    }
  }
  return { stops: [], source: "DEMO", fallbackFromLive: true };
}

/** Trajeto demo ([lng,lat]) para destaque no mapa. Linhas reais: a Olho Vivo não fornece shape; usa-se a sequência de paradas. */
export async function getLinePath(lineId: string): Promise<[number, number][]> {
  if (DEMO_LINE_ID_RE.test(lineId)) return demoPath(lineId);
  const { stops } = await getStops(lineId);
  return stops.map((s) => [s.longitude, s.latitude] as [number, number]);
}

// --- status -------------------------------------------------------------------------------------
export async function getSystemStatus(): Promise<SystemStatus> {
  const configured = isSptransConfigured();
  const forcedDemo = process.env.TRANSIT_FORCE_DEMO === "1";
  const live = configured && !forcedDemo && liveHealthy();
  const health = configured ? deps.client().getHealth() : null;
  let state: IntegrationState = "DEMO";
  if (configured && !forcedDemo) {
    if (!liveState.lastAttemptAt) state = "UPDATING";
    else if (!liveHealthy()) state = "UNAVAILABLE";
    else state = "CONNECTED";
  }
  const scenario = live ? null : (await deps.scenario()).scenario;
  return {
    mode: live ? "LIVE" : "DEMO",
    scenario,
    integrations: [
      {
        key: "sptrans",
        label: "SPTrans Olho Vivo",
        configured,
        state,
        lastQueryAt: iso(health?.lastQueryAt ?? liveState.lastAttemptAt),
        lastFailureAt: iso(health?.lastFailureAt ?? liveState.lastFailureAt),
      },
      {
        key: "map-tiles",
        label: "Map tiles (MapLibre)",
        configured: !!process.env.NEXT_PUBLIC_MAP_STYLE_URL,
        state: process.env.NEXT_PUBLIC_MAP_STYLE_URL ? "CONNECTED" : "UNAVAILABLE",
        lastQueryAt: null,
        lastFailureAt: null,
      },
    ],
  };
}

/** Agrega estados de várias linhas em um único estado (UNAVAILABLE só se todas estiverem indisponíveis). */
export function aggregateState(states: IntegrationState[]): IntegrationState {
  if (!states.length) return "UNAVAILABLE";
  if (states.every((s) => s === "UNAVAILABLE")) return "UNAVAILABLE";
  if (states.includes("STALE")) return "STALE";
  if (states.includes("CONNECTED")) return "CONNECTED";
  if (states.includes("UPDATING")) return "UPDATING";
  return states.includes("DEMO") ? "DEMO" : "UNAVAILABLE";
}
