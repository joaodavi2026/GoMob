import { describe, expect, it } from "vitest";
import { buildDemoNetwork, declaredTransferPoints, DECLARED_TRANSFER_STOP_IDS } from "@/features/routes/demo-network";
import { DemoRouteProvider } from "@/features/routes/demo-provider";
import { findPlace, KNOWN_PLACES, placeToPoint } from "@/features/routes/places";
import { formatPointParam, parsePointParam } from "@/features/routes/points";
import { RouteProviderUnavailableError, routeSearchSchema, runRouteSearch } from "@/features/routes/search";
import { filterBusOnly, validateBusOnlyRoute } from "@/features/routes/validate";
import type { BusRouteOption, RouteProvider } from "@/types/transit";
import { bus, NOW, option, risk, walk } from "./helpers";

const place = (id: string) => placeToPoint(findPlace(id)!);
const provider = new DemoRouteProvider(buildDemoNetwork(), () => NOW);

describe("demo network integrity", () => {
  const network = buildDemoNetwork();
  it("declared transfer stops are served by at least two lines", () => {
    for (const id of DECLARED_TRANSFER_STOP_IDS) {
      expect(network.filter((l) => l.stops.some((s) => s.id === id)).length, id).toBeGreaterThanOrEqual(2);
    }
    expect(declaredTransferPoints(network)).toHaveLength(DECLARED_TRANSFER_STOP_IDS.length);
  });
  it("lines have increasing travel offsets", () => {
    for (const l of network) for (let i = 1; i < l.offsets.length; i++) expect(l.offsets[i]).toBeGreaterThan(l.offsets[i - 1]);
  });
  it("known places are inside the São Paulo area", () => {
    for (const p of KNOWN_PLACES) {
      expect(p.latitude).toBeLessThan(-23.4);
      expect(p.latitude).toBeGreaterThan(-23.8);
      expect(p.longitude).toBeLessThan(-46.4);
      expect(p.longitude).toBeGreaterThan(-46.9);
    }
  });
});

describe("DemoRouteProvider", () => {
  const transferPoints = declaredTransferPoints(buildDemoNetwork());

  it("finds a direct bus route (Paraíso -> Higienópolis on D-100) with coherent path", async () => {
    const routes = await provider.searchRoutes(place("paraiso"), place("higienopolis"));
    expect(routes.length).toBeGreaterThan(0);
    const direct = routes.find((r) => r.transfers === 0 && r.steps.some((s) => s.kind === "BUS" && s.lineCode === "D-100"));
    expect(direct).toBeDefined();
    expect(direct!.source).toBe("DEMO");
    expect(direct!.steps[0].kind).toBe("WALK");
    expect(direct!.steps.at(-1)!.kind).toBe("WALK");
    // path começa na origem e termina no destino, em [lng, lat]
    expect(direct!.path[0]).toEqual([place("paraiso").longitude, place("paraiso").latitude]);
    expect(direct!.path.at(-1)).toEqual([place("higienopolis").longitude, place("higienopolis").latitude]);
    expect(direct!.durationMinutes).toBeGreaterThan(direct!.walkMinutes);
  });

  it("only returns BUS/WALK steps and routes valid under the declared transfer points", async () => {
    const pairs = KNOWN_PLACES.flatMap((a) => KNOWN_PLACES.filter((b) => b.id !== a.id).map((b) => [a.id, b.id] as const));
    let total = 0;
    let withTransfer = 0;
    for (const [o, d] of pairs) {
      const routes = await provider.searchRoutes(place(o), place(d));
      for (const r of routes) {
        total++;
        expect(r.steps.every((s) => s.kind === "WALK" || s.kind === "BUS")).toBe(true);
        expect(validateBusOnlyRoute(r, transferPoints), `${o}->${d} ${r.id}`).toEqual({ valid: true });
        expect(r.transfers).toBeLessThanOrEqual(1);
        expect(r.path.length).toBeGreaterThanOrEqual(2);
        if (r.transfers === 1) withTransfer++;
      }
    }
    expect(total).toBeGreaterThan(10);
    expect(withTransfer).toBeGreaterThan(0); // a rede demo exercita transferências declaradas
  });

  it("finds a one-transfer route at a declared point (Pinheiros -> Higienópolis via Consolação)", async () => {
    const routes = await provider.searchRoutes(place("pinheiros"), place("higienopolis"));
    const t = routes.find((r) => r.transfers === 1);
    expect(t).toBeDefined();
    const buses = t!.steps.filter((s) => s.kind === "BUS");
    expect(buses.map((b) => (b.kind === "BUS" ? b.lineCode : ""))).toEqual(["D-800", "D-100"]);
    expect(buses[0].kind === "BUS" && buses[0].alightStop).toBe(buses[1].kind === "BUS" && buses[1].boardStop);
  });

  it("does not invent a transfer between lines without a declared common point", async () => {
    // D-300 (Sé→Tatuapé) e D-500 (Barra Funda→Pompeia) não compartilham paradas nem pontos declarados
    const routes = await provider.searchRoutes(place("tatuape"), place("pompeia"));
    expect(routes).toEqual([]);
  });

  it("no route for the opposite direction of a one-way line", async () => {
    const routes = await provider.searchRoutes(place("higienopolis"), place("paraiso"));
    expect(routes).toEqual([]);
  });

  it("no routes when endpoints are too far from any stop or identical", async () => {
    expect(await provider.searchRoutes({ latitude: -22.9, longitude: -47.06 }, place("se"))).toEqual([]);
    expect(await provider.searchRoutes(place("se"), place("se"))).toEqual([]);
  });

  it("results never include non-bus options (filter would drop none)", async () => {
    const routes = await provider.searchRoutes(place("paraiso"), place("se"));
    expect(filterBusOnly(routes, transferPoints).rejected).toEqual([]);
  });
});

describe("point params", () => {
  it("parses lat,lng,label", () => {
    expect(parsePointParam("-23.5614,-46.6559,Av. Paulista (MASP)")).toEqual({ latitude: -23.5614, longitude: -46.6559, label: "Av. Paulista (MASP)" });
    expect(parsePointParam("-23.5,-46.6,Rua A, 100")?.label).toBe("Rua A, 100");
    expect(parsePointParam("-23.5,-46.6")?.label).toBeUndefined();
  });
  it("rejects invalid values", () => {
    for (const bad of [null, undefined, "", "abc", "1", "x,y,z", "95,10,a", "10,200,a"]) expect(parsePointParam(bad)).toBeNull();
  });
  it("round-trips", () => {
    const p = { latitude: -23.5614, longitude: -46.6559, label: "MASP" };
    expect(parsePointParam(formatPointParam(p))).toEqual(p);
  });
});

describe("request schema", () => {
  it("validates coordinates and sort", () => {
    const o = { latitude: -23.5, longitude: -46.6 };
    expect(routeSearchSchema.safeParse({ origin: o, destination: o }).success).toBe(true);
    expect(routeSearchSchema.safeParse({ origin: o, destination: o, sort: "lower_risk" }).success).toBe(true);
    expect(routeSearchSchema.safeParse({ origin: o, destination: o, sort: "cheapest" }).success).toBe(false);
    expect(routeSearchSchema.safeParse({ origin: { latitude: 200, longitude: 0 }, destination: o }).success).toBe(false);
    expect(routeSearchSchema.safeParse({ origin: o }).success).toBe(false);
  });
});

describe("runRouteSearch", () => {
  const fake = (options: BusRouteOption[]): RouteProvider => ({ name: "DEMO", searchRoutes: async () => options });
  const O = place("se");
  const D = place("masp");

  it("drops non-bus options returned by a provider and adds risk, sorting and recommendations", async () => {
    const good = option("good", [walk("A", "S1"), bus("L1", "S1", "S2"), walk("S2", "B")], { durationMinutes: 30 });
    const metro = option("metro", [walk("A", "S1"), bus("Linha 1-Azul", "S1", "S2", 10, "Metrô Linha 1-Azul"), walk("S2", "B")], { durationMinutes: 10 });
    const res = await runRouteSearch({ origin: O, destination: D }, { provider: fake([metro, good]), riskFor: async () => risk(20), now: () => NOW });
    expect(res.routes.map((r) => r.id)).toEqual(["good"]);
    expect(res.routes[0].risk?.level).toBe("LOW");
    expect(res.routes[0].lineRisks["L1"]).toBeDefined();
    expect(res.recommendations.fastest?.routeId).toBe("good");
    expect(res.provider).toBe("DEMO");
    expect(res.isDemo).toBe(true);
  });

  it("returns an empty list when the provider finds nothing", async () => {
    const res = await runRouteSearch({ origin: O, destination: D }, { provider: fake([]), riskFor: async () => risk(20) });
    expect(res.routes).toEqual([]);
    expect(res.recommendations.fastest).toBeUndefined();
    expect(res.recommendations.balanced).toBeUndefined();
  });

  it("a failing risk lookup becomes insufficient data, not low risk", async () => {
    const o = option("a", [bus("L1", "S1", "S2")]);
    const res = await runRouteSearch({ origin: O, destination: D }, { provider: fake([o]), riskFor: async () => { throw new Error("db down"); } });
    expect(res.routes[0].risk?.level).toBe("INSUFFICIENT_DATA");
    expect(res.routes[0].risk?.score).toBeNull();
  });

  it("maps provider failure to an explicit unavailable error", async () => {
    const failing: RouteProvider = { name: "GOOGLE", searchRoutes: async () => { throw new Error("boom"); } };
    await expect(runRouteSearch({ origin: O, destination: D }, { provider: failing, riskFor: async () => null })).rejects.toBeInstanceOf(RouteProviderUnavailableError);
  });

  it("lower_risk sort with insufficient data falls back to fastest with a notice", async () => {
    const a = option("a", [bus("L1", "S1", "S2")], { durationMinutes: 40 });
    const b = option("b", [bus("L2", "S1", "S2")], { durationMinutes: 20 });
    const res = await runRouteSearch({ origin: O, destination: D, sort: "lower_risk" }, { provider: fake([a, b]), riskFor: async () => null });
    expect(res.sortApplied).toBe("fastest");
    expect(res.notice).toMatch(/Not enough comparable risk data/);
    expect(res.routes.map((r) => r.id)).toEqual(["b", "a"]);
    expect(res.recommendations.lowerRisk).toBeUndefined();
  });
});
