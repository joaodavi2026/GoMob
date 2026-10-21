import { describe, expect, it } from "vitest";
import { decodePolyline, GOOGLE_ENDPOINT, GoogleRoutesProvider, isGoogleRoutesEnabled, parseGoogleRoutes } from "@/features/routes/google";
import { filterBusOnly, isBusVehicleType, looksNonBus, validateBusOnlyRoute } from "@/features/routes/validate";
import { bus, NOW, option, walk } from "./helpers";

describe("BUS-only validator", () => {
  it("accepts walk + bus + walk", () => {
    expect(validateBusOnlyRoute(option("r", [walk("A", "S1"), bus("L1", "S1", "S2"), walk("S2", "B")]))).toEqual({ valid: true });
  });

  it.each(["Metrô Linha 1-Azul", "Linha 2-Verde", "Trem CPTM Linha 7", "VLT Carioca", "Monotrilho Linha 15", "Metro Line", "Subway"])(
    "rejects non-bus line name: %s",
    (name) => {
      expect(looksNonBus(name)).toBe(true);
      const o = option("r", [walk("A", "S1"), bus("X1", "S1", "S2", 10, name), walk("S2", "B")]);
      expect(validateBusOnlyRoute(o).valid).toBe(false);
    },
  );

  it("does not flag normal bus names or stop names that mention stations", () => {
    expect(looksNonBus("8000-10 Term. Lapa - Pça. da Sé")).toBe(false);
    const o = option("r", [walk("A", "Estação Sé"), bus("8000-10", "Estação Sé", "Metrô Tatuapé"), walk("Metrô Tatuapé", "B")]);
    expect(validateBusOnlyRoute(o).valid).toBe(true);
  });

  it("rejects routes without a bus step or with unknown step kinds", () => {
    expect(validateBusOnlyRoute(option("r", [walk("A", "B")])).valid).toBe(false);
    expect(validateBusOnlyRoute(option("r", [])).valid).toBe(false);
    const bad = option("r", [walk("A", "S1"), bus("L1", "S1", "S2")]);
    (bad.steps as unknown[]).push({ kind: "RAIL", minutes: 5 });
    expect(validateBusOnlyRoute(bad).valid).toBe(false);
  });

  it("checks transfer consistency", () => {
    const ok = option("r", [bus("L1", "S1", "T"), bus("L2", "T", "S3")]);
    expect(validateBusOnlyRoute(ok).valid).toBe(true);
    expect(validateBusOnlyRoute({ ...ok, transfers: 0 }).valid).toBe(false);
    const disconnected = option("r", [bus("L1", "S1", "T"), bus("L2", "OTHER", "S3")]);
    expect(validateBusOnlyRoute(disconnected).valid).toBe(false);
  });

  it("only allows transfers at declared points served by both lines", () => {
    const o = option("r", [bus("L1", "S1", "T"), bus("L2", "T", "S3")]);
    expect(validateBusOnlyRoute(o, [{ stopName: "T", lineCodes: ["L1", "L2"] }]).valid).toBe(true);
    expect(validateBusOnlyRoute(o, [{ stopName: "T", lineCodes: ["L1"] }]).valid).toBe(false);
    expect(validateBusOnlyRoute(o, [{ stopName: "OTHER", lineCodes: ["L1", "L2"] }]).valid).toBe(false);
    expect(validateBusOnlyRoute(o, []).valid).toBe(false);
  });

  it("filterBusOnly separates accepted and rejected", () => {
    const good = option("good", [bus("L1", "S1", "S2")]);
    const metro = option("metro", [bus("Linha 3-Vermelha", "S1", "S2")]);
    const r = filterBusOnly([good, metro]);
    expect(r.accepted.map((o) => o.id)).toEqual(["good"]);
    expect(r.rejected.map((o) => o.id)).toEqual(["metro"]);
  });

  it("vehicle types: only BUS", () => {
    expect(isBusVehicleType("BUS")).toBe(true);
    for (const t of ["SUBWAY", "HEAVY_RAIL", "COMMUTER_TRAIN", "TRAM", "LIGHT_RAIL", "MONORAIL", "FERRY", "TROLLEYBUS", undefined]) {
      expect(isBusVehicleType(t as string | undefined)).toBe(false);
    }
  });
});

const gStep = (type: string, name = "8000-10") => ({
  travelMode: "TRANSIT",
  staticDuration: "600s",
  transitDetails: { stopDetails: { departureStop: { name: "A" }, arrivalStop: { name: "B" } }, transitLine: { name, nameShort: name, vehicle: { type } } },
});
const gWalk = { travelMode: "WALK", staticDuration: "180s", navigationInstruction: { instructions: "Walk to stop" } };
const gRoute = (steps: unknown[], duration = "1500s") => ({ duration, legs: [{ steps }] });
const O = { latitude: -23.55, longitude: -46.63, label: "O" };
const D = { latitude: -23.56, longitude: -46.65, label: "D" };

describe("Google Routes adapter", () => {
  it("is disabled by default and needs both key and explicit flag", () => {
    expect(isGoogleRoutesEnabled({})).toBe(false);
    expect(isGoogleRoutesEnabled({ GOOGLE_ROUTES_API_KEY: "k" })).toBe(false);
    expect(isGoogleRoutesEnabled({ GOOGLE_ROUTES_ENABLED: "true" })).toBe(false);
    expect(isGoogleRoutesEnabled({ GOOGLE_ROUTES_API_KEY: "  ", GOOGLE_ROUTES_ENABLED: "true" })).toBe(false);
    expect(isGoogleRoutesEnabled({ GOOGLE_ROUTES_API_KEY: "k", GOOGLE_ROUTES_ENABLED: "true" })).toBe(true);
  });

  it("accepts BUS-only routes with walking", () => {
    const { accepted, rejected } = parseGoogleRoutes({ routes: [gRoute([gWalk, gStep("BUS"), gWalk])] }, NOW.toISOString(), O, D);
    expect(rejected).toEqual([]);
    expect(accepted).toHaveLength(1);
    expect(accepted[0]).toMatchObject({ source: "GOOGLE", transfers: 0, walkMinutes: 6, durationMinutes: 25 });
  });

  it("rejects the whole route if any step is not a bus (metro, train, tram...)", () => {
    for (const type of ["SUBWAY", "HEAVY_RAIL", "COMMUTER_TRAIN", "TRAM", "MONORAIL", "LIGHT_RAIL"]) {
      const { accepted, rejected } = parseGoogleRoutes({ routes: [gRoute([gWalk, gStep("BUS"), gStep(type, "Linha 1"), gWalk])] }, NOW.toISOString(), O, D);
      expect(accepted).toEqual([]);
      expect(rejected[0].reason).toMatch(/Non-bus/);
    }
  });

  it("rejects unknown travel modes and routes with no bus", () => {
    expect(parseGoogleRoutes({ routes: [gRoute([{ travelMode: "DRIVE" }])] }, "t", O, D).accepted).toEqual([]);
    expect(parseGoogleRoutes({ routes: [gRoute([gWalk])] }, "t", O, D).accepted).toEqual([]);
    expect(parseGoogleRoutes({}, "t", O, D).accepted).toEqual([]);
  });

  it("keeps good alternatives while dropping mixed ones; counts transfers", () => {
    const { accepted, rejected } = parseGoogleRoutes(
      { routes: [gRoute([gStep("BUS", "A1"), gStep("BUS", "B2")]), gRoute([gStep("BUS"), gStep("SUBWAY", "Linha 1")])] },
      "t",
      O,
      D,
    );
    expect(accepted).toHaveLength(1);
    expect(accepted[0].transfers).toBe(1);
    expect(rejected).toHaveLength(1);
  });

  it("requests TRANSIT with BUS preference, sends the key header and caches results", async () => {
    let calls = 0;
    let captured: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls++;
      captured = { url, init };
      return new Response(JSON.stringify({ routes: [gRoute([gWalk, gStep("BUS"), gWalk])] }), { status: 200 });
    }) as unknown as typeof fetch;
    const p = new GoogleRoutesProvider({ apiKey: "KEY", fetchImpl, now: () => NOW.getTime() });
    const r1 = await p.searchRoutes(O, D);
    const r2 = await p.searchRoutes(O, D);
    expect(r1).toHaveLength(1);
    expect(r2).toBe(r1);
    expect(calls).toBe(1);
    const body = JSON.parse(String(captured!.init.body));
    expect(captured!.url).toBe(GOOGLE_ENDPOINT);
    expect(body.travelMode).toBe("TRANSIT");
    expect(body.transitPreferences.allowedTravelModes).toEqual(["BUS"]);
    expect((captured!.init.headers as Record<string, string>)["X-Goog-Api-Key"]).toBe("KEY");
  });

  it("propagates HTTP failures so the service can report unavailability", async () => {
    const fetchImpl = (async () => new Response("no", { status: 500 })) as unknown as typeof fetch;
    await expect(new GoogleRoutesProvider({ apiKey: "k", fetchImpl }).searchRoutes(O, D)).rejects.toThrow();
  });

  it("decodes encoded polylines to [lng, lat]", () => {
    // exemplo da documentação do Google
    const pts = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(pts[0][1]).toBeCloseTo(38.5, 5);
    expect(pts[0][0]).toBeCloseTo(-120.2, 5);
    expect(pts[2][1]).toBeCloseTo(43.252, 5);
  });
});
