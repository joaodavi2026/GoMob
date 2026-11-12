import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GtfsRouteProvider, runsAt } from "@/features/routes/gtfs-provider";
import { findPlace, placeToPoint } from "@/features/routes/places";
import { filterBusOnly, validateBusOnlyRoute } from "@/features/routes/validate";
import type { BusRouteOption } from "@/types/transit";

const provider = new GtfsRouteProvider(join(process.cwd(), "public", "gtfs", "network.json"));
const at = (id: string) => placeToPoint(findPlace(id)!);

describe("GtfsRouteProvider (GTFS oficial da SPTrans)", () => {
  it("encontra ônibus reais entre Paraíso e o MASP, com embarque e desembarque", async () => {
    const routes = await provider.searchRoutes(at("paraiso"), at("masp"));
    const { accepted } = filterBusOnly(routes);
    expect(accepted.length).toBeGreaterThan(0);
    const r = accepted[0];
    expect(r.source).toBe("GTFS");
    const bus = r.steps.find((s) => s.kind === "BUS");
    expect(bus && bus.kind === "BUS" && bus.boardStop && bus.alightStop && bus.lineName.startsWith("sentido ")).toBeTruthy();
    expect(r.durationMinutes).toBeGreaterThan(0);
  });

  it("acha rota com até uma baldeação entre locais distantes", async () => {
    const routes = await provider.searchRoutes(at("barrafunda"), at("ibirapuera"));
    expect(filterBusOnly(routes).accepted.length).toBeGreaterThan(0);
  });

  it("não sugere viagem quando origem e destino são praticamente o mesmo ponto", async () => {
    expect(await provider.searchRoutes(at("masp"), at("masp"))).toEqual([]);
  });

  it("respeita dias e horário de operação (linhas noturnas não aparecem à tarde)", () => {
    const tardeQuarta = new Date("2026-11-11T17:00:00Z"); // 14h em São Paulo, quarta-feira
    const madrugada = new Date("2026-11-12T05:30:00Z"); // 02h30 em São Paulo
    const noturna = { days: "1111111", first: "00:00", last: "04:59" };
    const diurna = { days: "1111100", first: "04:00", last: "23:59" };
    expect(runsAt(noturna, tardeQuarta)).toBe(false);
    expect(runsAt(noturna, madrugada)).toBe(true);
    expect(runsAt(diurna, tardeQuarta)).toBe(true);
    expect(runsAt({ ...diurna, days: "0000011" }, tardeQuarta)).toBe(false);
    expect(runsAt({ days: null, first: "22:00", last: "02:00" }, madrugada)).toBe(false);
    expect(runsAt({ days: null, first: "22:00", last: "03:00" }, madrugada)).toBe(true);
  });

  it("à tarde de um dia útil, só sugere linhas em operação", async () => {
    const p = new GtfsRouteProvider(join(process.cwd(), "public", "gtfs", "network.json"), () => new Date("2026-11-11T17:00:00Z"));
    const routes = await p.searchRoutes(at("barrafunda"), at("santoamaro"));
    const codes = routes.flatMap((r) => r.steps.filter((s) => s.kind === "BUS").map((s) => (s.kind === "BUS" ? s.lineCode : "")));
    expect(codes.length).toBeGreaterThan(0);
    expect(codes.some((c) => c.startsWith("N"))).toBe(false);
  });

  it("aceita ônibus GTFS com 'Metrô' no nome, mas mantém o filtro de texto para outras fontes", () => {
    const opt = (source: BusRouteOption["source"]): BusRouteOption => ({
      id: "x",
      source,
      transfers: 0,
      walkMinutes: 2,
      durationMinutes: 20,
      path: [],
      dataTimestamp: new Date().toISOString(),
      steps: [{ kind: "BUS", lineCode: "175P-10", lineName: "sentido Metrô Santana", boardStop: "A", alightStop: "B", minutes: 10 }],
    });
    expect(validateBusOnlyRoute(opt("GTFS")).valid).toBe(true);
    expect(validateBusOnlyRoute(opt("GOOGLE")).valid).toBe(false);
  });
});
