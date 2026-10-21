import { afterEach, describe, expect, it, vi } from "vitest";
import { demoLines, demoVehicleById, demoVehicles, pointAlong, demoPath } from "@/server/transit/demo";
import { classifyFreshness, formatAge } from "@/server/transit/freshness";
import { LineIdSchema, VehicleIdSchema } from "@/server/transit/ids";
import {
  __setTransitDeps,
  aggregateState,
  getLine,
  getLines,
  getStops,
  getSystemStatus,
  getVehicle,
  getVehicles,
} from "@/server/transit/service";
import type { DemoScenario } from "@/types/transit";

const T0 = Date.parse("2026-10-21T15:00:07Z");

function gaps(positions: number[]) {
  const s = [...positions].sort((a, b) => a - b);
  return s.map((p, i) => (i === s.length - 1 ? s[0] + 1 - p : s[i + 1] - p));
}

describe("provedor DEMO", () => {
  it("tem ~5 linhas demo identificadas", () => {
    const lines = demoLines();
    expect(lines).toHaveLength(5);
    expect(lines.every((l) => l.source === "DEMO")).toBe(true);
  });

  it("é determinístico para o mesmo instante e cenário", () => {
    const a = demoVehicles("demo-1", "A_NORMAL", T0);
    const b = demoVehicles("demo-1", "A_NORMAL", T0 + 3000); // mesmo snapshot de 15s
    expect(a).toEqual(b);
    expect(a.vehicles.every((v) => v.source === "DEMO")).toBe(true);
  });

  it("veículos se movem ao longo do tempo e permanecem em SP", () => {
    const a = demoVehicles("demo-3", "A_NORMAL", T0).vehicles[0];
    const b = demoVehicles("demo-3", "A_NORMAL", T0 + 120_000).vehicles[0];
    expect(a.latitude !== b.latitude || a.longitude !== b.longitude).toBe(true);
    for (const v of [a, b]) {
      expect(v.latitude).toBeGreaterThan(-23.7);
      expect(v.latitude).toBeLessThan(-23.5);
    }
  });

  it("A: espaçamento regular; B: agrupado (bunching); D: converge para regular", () => {
    const path = demoPath("demo-3");
    const along = (sc: DemoScenario, now: number, rec?: string) =>
      demoVehicles("demo-3", sc, now, rec).vehicles.map((v) => {
        // projeta a posição em uma coordenada aproximada ao longo do trajeto (mais próxima de amostras)
        let best = 0;
        let bd = Infinity;
        for (let i = 0; i <= 400; i++) {
          const [x, y] = pointAlong(path, i / 400);
          const d = (x - v.longitude) ** 2 + (y - v.latitude) ** 2;
          if (d < bd) {
            bd = d;
            best = i / 400;
          }
        }
        return best;
      });
    const spread = (xs: number[]) => {
      const sorted = [...xs].sort((a, b) => a - b);
      const g = sorted.slice(1).map((x, i) => x - sorted[i]);
      return Math.min(...g);
    };
    const A = spread(along("A_NORMAL", T0));
    const B = spread(along("B_HIGH_RISK", T0));
    expect(B).toBeLessThan(A);
    const start = new Date(T0 - 10 * 60_000).toISOString();
    const dEnd = spread(along("D_RECOVERY", T0 + 60_000, start));
    const dStart = spread(along("D_RECOVERY", T0, new Date(T0).toISOString()));
    expect(dEnd).toBeGreaterThan(dStart);
    expect(gaps([0, 0.25, 0.5, 0.75])).toHaveLength(4);
  });

  it("C: linhas sem dados (UNAVAILABLE) ou obsoletas (STALE)", () => {
    const odd = demoVehicles("demo-1", "C_UNAVAILABLE", T0);
    expect(odd.state).toBe("UNAVAILABLE");
    expect(odd.vehicles).toEqual([]);
    const even = demoVehicles("demo-2", "C_UNAVAILABLE", T0);
    expect(even.state).toBe("STALE");
    expect(even.vehicles.length).toBeGreaterThan(0);
    expect(classifyFreshness(even.vehicles[0].observedAt, T0)).toBe("STALE");
  });

  it("demoVehicleById resolve ids válidos e rejeita inválidos", () => {
    expect(demoVehicleById("dmv-1-2", "A_NORMAL", T0)?.id).toBe("dmv-1-2");
    expect(demoVehicleById("dmv-1-99", "A_NORMAL", T0)).toBeNull();
    expect(demoVehicleById("foo", "A_NORMAL", T0)).toBeNull();
  });
});

describe("freshness / ids", () => {
  it("classifica frescor", () => {
    expect(classifyFreshness(new Date(T0 - 30_000).toISOString(), T0)).toBe("FRESH");
    expect(classifyFreshness(new Date(T0 - 10 * 60_000).toISOString(), T0)).toBe("STALE");
    expect(classifyFreshness("lixo", T0)).toBe("UNAVAILABLE");
    expect(classifyFreshness(new Date(T0 + 3_600_000).toISOString(), T0)).toBe("UNAVAILABLE");
    expect(formatAge(new Date(T0 - 120_000).toISOString(), T0)).toBe("2 minutes ago");
  });

  it("valida ids (injeção/formato)", () => {
    for (const ok of ["demo-1", "sp-1273"]) expect(LineIdSchema.safeParse(ok).success).toBe(true);
    for (const bad of ["", "../x", "sp-", "sp-abc", "demo-0", "sp-1;drop", "sp-12345678901"]) expect(LineIdSchema.safeParse(bad).success).toBe(false);
    expect(VehicleIdSchema.safeParse("dmv-2-3").success).toBe(true);
    expect(VehicleIdSchema.safeParse("spv-123").success).toBe(true);
    expect(VehicleIdSchema.safeParse("spv-1/../").success).toBe(false);
  });

  it("aggregateState", () => {
    expect(aggregateState([])).toBe("UNAVAILABLE");
    expect(aggregateState(["UNAVAILABLE", "UNAVAILABLE"])).toBe("UNAVAILABLE");
    expect(aggregateState(["UNAVAILABLE", "STALE"])).toBe("STALE");
    expect(aggregateState(["DEMO", "DEMO"])).toBe("DEMO");
  });
});

describe("service (contrato)", () => {
  afterEach(() => {
    __setTransitDeps(null);
    vi.unstubAllEnvs();
  });

  const demoDeps = (scenario: DemoScenario = "A_NORMAL") => ({
    configured: () => false,
    scenario: async () => ({ scenario }),
    now: () => T0,
    activeOverrides: async () => new Map<string, boolean>(),
  });

  it("DEMO sem token: linhas, linha, veículos, paradas e status", async () => {
    __setTransitDeps(demoDeps());
    const { lines, source, state } = await getLines();
    expect(lines).toHaveLength(5);
    expect(lines.every((l) => l.active)).toBe(true);
    expect(source).toBe("DEMO");
    expect(state).toBe("DEMO");
    expect((await getLines({ search: "paulista" })).lines).toHaveLength(1);
    expect(await getLine("demo-1")).toMatchObject({ id: "demo-1" });
    expect(await getLine("sp-999")).toBeNull();
    const v = await getVehicles("demo-1");
    expect(v.vehicles.length).toBeGreaterThan(0);
    expect(v.source).toBe("DEMO");
    expect((await getVehicle(v.vehicles[0].id))?.id).toBe(v.vehicles[0].id);
    expect((await getStops("demo-1")).stops.length).toBeGreaterThan(2);
    const st = await getSystemStatus();
    expect(st.mode).toBe("DEMO");
    expect(st.scenario).toBe("A_NORMAL");
    expect(JSON.stringify(st)).not.toMatch(/token/i);
  });

  it("respeita cenário C", async () => {
    __setTransitDeps(demoDeps("C_UNAVAILABLE"));
    expect((await getVehicles("demo-1")).state).toBe("UNAVAILABLE");
    expect((await getVehicles("demo-2")).state).toBe("STALE");
  });

  it("linha real sem provedor live -> UNAVAILABLE identificado (sem inventar posição)", async () => {
    __setTransitDeps(demoDeps());
    const r = await getVehicles("sp-1273");
    expect(r.vehicles).toEqual([]);
    expect(r.state).toBe("UNAVAILABLE");
  });

  it("LIVE com cliente simulado; falha do cliente -> fallback explícito para DEMO", async () => {
    const lines = [{ cl: 1273, lt: "8000", tl: 10, sl: 1, tp: "A", ts: "B" }];
    const positions = { vs: [{ p: 1, ta: new Date(T0 - 20_000).toISOString(), py: -23.55, px: -46.63 }] };
    let failing = false;
    const client = {
      searchLines: async () => {
        if (failing) throw new Error("x");
        return lines;
      },
      stopsByLine: async () => [],
      positionsByLine: async () => {
        if (failing) throw new Error("x");
        return positions;
      },
      getHealth: () => ({ configured: true, authenticated: true, lastQueryAt: T0, lastSuccessAt: T0, lastFailureAt: null, lastFailureKind: null }),
      clearCache: () => {},
    };
    vi.stubEnv("SPTRANS_API_TOKEN", "t");
    __setTransitDeps({ ...demoDeps(), configured: () => true, client: () => client as never });
    const l = await getLines();
    expect(l.source).toBe("SPTRANS");
    expect(l.lines[0]).toMatchObject({ id: "sp-1273", active: true });
    const v = await getVehicles("sp-1273");
    expect(v).toMatchObject({ source: "SPTRANS", state: "CONNECTED" });
    expect(v.vehicles[0].id).toBe("spv-1");
    expect((await getSystemStatus()).mode).toBe("LIVE");

    failing = true;
    const l2 = await getLines();
    expect(l2).toMatchObject({ source: "DEMO", fallbackFromLive: true });
    expect((await getSystemStatus()).mode).toBe("DEMO");
    expect((await getVehicles("sp-1273")).source).toBe("DEMO");
  });

  it("LIVE: posições antigas => STALE", async () => {
    const client = {
      searchLines: async () => [],
      stopsByLine: async () => [],
      positionsByLine: async () => ({ vs: [{ p: 7, ta: new Date(T0 - 10 * 60_000).toISOString(), py: -23.55, px: -46.63 }] }),
      getHealth: () => ({}),
    };
    vi.stubEnv("SPTRANS_API_TOKEN", "t");
    __setTransitDeps({ ...demoDeps(), configured: () => true, client: () => client as never });
    expect((await getVehicles("sp-5")).state).toBe("STALE");
  });
});
