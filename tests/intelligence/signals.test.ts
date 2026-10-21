import { describe, expect, it } from "vitest";
import { computeHourlyDemandFactor, saoPauloParts, type HistoryRow } from "@/features/intelligence/demand";
import { demoFactors } from "@/features/intelligence/demo";
import { computeRisk } from "@/features/intelligence/engine";
import { computeDelayFactor, computeSpacingSignals } from "@/features/intelligence/signals";
import type { TransitStop, TransitVehicle } from "@/types/transit";

const NOW = new Date("2026-10-21T15:00:00Z");

// Linha reta leste-oeste de ~10 km (0,1 grau de longitude ≈ 10,2 km em SP).
const stops: TransitStop[] = [0, 0.025, 0.05, 0.075, 0.1].map((d, i) => ({
  id: `s${i}`,
  name: `S${i}`,
  latitude: -23.55,
  longitude: -46.7 + d,
  source: "DEMO" as const,
}));
const veh = (id: number, lngOffset: number, ageMin = 0, source: "DEMO" | "SPTRANS" = "SPTRANS"): TransitVehicle => ({
  id: `v${id}`,
  lineId: "L",
  latitude: -23.55,
  longitude: -46.7 + lngOffset,
  observedAt: new Date(NOW.getTime() - ageMin * 60_000).toISOString(),
  source,
});

describe("headway / bunching from vehicle positions", () => {
  it("regularly spaced vehicles -> low irregularity", () => {
    const s = computeSpacingSignals([0.01, 0.03, 0.05, 0.07, 0.09].map((o, i) => veh(i, o)), stops, NOW);
    expect(s.headway.value).toBe(0);
    expect(s.operations.value).toBe(0);
    expect(s.vehiclesUsed).toBe(5);
  });
  it("bunched vehicles -> high irregularity and operations", () => {
    const s = computeSpacingSignals([0.01, 0.0105, 0.011, 0.09].map((o, i) => veh(i, o)), stops, NOW);
    expect(s.headway.value!).toBeGreaterThanOrEqual(70);
    expect(s.operations.value!).toBeGreaterThanOrEqual(60);
  });
  it("fewer than 3 usable vehicles -> null (never zero)", () => {
    const s = computeSpacingSignals([veh(1, 0.02), veh(2, 0.06)], stops, NOW);
    expect(s.headway.value).toBeNull();
    expect(s.operations.value).toBeNull();
    expect(s.reason).toBe("TOO_FEW_VEHICLES");
  });
  it("stale vehicles are ignored -> null", () => {
    const s = computeSpacingSignals([0.01, 0.04, 0.08].map((o, i) => veh(i, o, 30)), stops, NOW);
    expect(s.headway.value).toBeNull();
    expect(s.reason).toBe("STALE");
  });
  it("no geometry -> null", () => {
    const s = computeSpacingSignals([veh(1, 0.01), veh(2, 0.02), veh(3, 0.03)], [], NOW);
    expect(s.headway.value).toBeNull();
    expect(s.reason).toBe("NO_GEOMETRY");
  });
  it("vehicles far from the line are excluded", () => {
    const far: TransitVehicle[] = [0.01, 0.04, 0.08].map((o, i) => ({ ...veh(i, o), latitude: -23.4 }));
    expect(computeSpacingSignals(far, stops, NOW).headway.value).toBeNull();
  });
  it("delay factor needs a valid reference", () => {
    expect(computeDelayFactor(null).value).toBeNull();
    expect(computeDelayFactor(Number.NaN).value).toBeNull();
    expect(computeDelayFactor(0).value).toBe(0);
    expect(computeDelayFactor(7.5).value).toBe(50);
    expect(computeDelayFactor(60).value).toBe(100);
  });
  it("spacing signals feed the engine: bunched line is riskier than regular", () => {
    const reg = computeSpacingSignals([0.01, 0.03, 0.05, 0.07, 0.09].map((o, i) => veh(i, o)), stops, NOW);
    const bun = computeSpacingSignals([0.01, 0.0105, 0.011, 0.09].map((o, i) => veh(i, o)), stops, NOW);
    const rReg = computeRisk({ headway: reg.headway, operations: reg.operations }, { now: NOW });
    const rBun = computeRisk({ headway: bun.headway, operations: bun.operations }, { now: NOW });
    expect(rReg.level).toBe("LOW");
    expect(rBun.level).toBe("HIGH");
  });
});

describe("historical demand granularity", () => {
  // 6 segundas-feiras, horas 6..20 (hora de São Paulo)
  const mondays = ["2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19"];
  const hourly: HistoryRow[] = mondays.flatMap((d) =>
    Array.from({ length: 15 }, (_, i) => {
      const hour = 6 + i;
      const count = hour === 8 ? 1000 : hour === 14 ? 300 : 100;
      return { referenceDate: new Date(`${d}T${String(hour + 3).padStart(2, "0")}:00:00Z`), passengerCount: count, granularity: "HOURLY", source: "TEST" };
    }),
  );

  it("converts to America/Sao_Paulo parts", () => {
    expect(saoPauloParts(new Date("2026-10-19T11:00:00Z"))).toEqual({ dateKey: "2026-10-19", weekday: 1, hour: 8 });
    expect(saoPauloParts(new Date("2026-10-19T02:00:00Z")).dateKey).toBe("2026-10-18");
  });
  it("hourly data supports an hour-specific factor", () => {
    const peak = computeHourlyDemandFactor(hourly, { weekday: 1, hour: 8 });
    const off = computeHourlyDemandFactor(hourly, { weekday: 1, hour: 14 });
    expect(peak.factor.value).toBe(100);
    expect(off.factor.value).toBe(30);
    expect(peak.support.granularity).toBe("HOURLY");
  });
  it("day-aggregated data does NOT produce an hourly peak", () => {
    const daily: HistoryRow[] = mondays.map((d) => ({ referenceDate: new Date(`${d}T12:00:00Z`), passengerCount: 50000, granularity: "DAILY", source: "TEST" }));
    const r = computeHourlyDemandFactor(daily, { weekday: 1, hour: 8 });
    expect(r.factor.value).toBeNull();
    expect(r.support.reason).toBe("DAILY_AGGREGATE_ONLY");
    expect(r.support.granularity).toBe("DAILY");
  });
  it("no rows or sparse rows -> null", () => {
    expect(computeHourlyDemandFactor([], { weekday: 1, hour: 8 }).support.reason).toBe("NO_DATA");
    expect(computeHourlyDemandFactor(hourly.slice(0, 5), { weekday: 1, hour: 8 }).support.reason).toBe("INSUFFICIENT_SAMPLES");
    expect(computeHourlyDemandFactor(hourly, { weekday: 3, hour: 8 }).factor.value).toBeNull(); // sem quartas
  });
});

describe("demo factors by scenario", () => {
  it("A is LOW, B is HIGH, deterministic, flagged DEMO", () => {
    const a = computeRisk(demoFactors("A_NORMAL", "demo-1", { now: NOW })!, { now: NOW, forceSource: "DEMO" });
    const b = computeRisk(demoFactors("B_HIGH_RISK", "demo-1", { now: NOW })!, { now: NOW, forceSource: "DEMO" });
    expect(a.level).toBe("LOW");
    expect(b.level).toBe("HIGH");
    expect(a.source).toBe("DEMO");
    expect(demoFactors("B_HIGH_RISK", "demo-1", { now: NOW })).toEqual(demoFactors("B_HIGH_RISK", "demo-1", { now: NOW }));
  });
  it("C is unavailable -> INSUFFICIENT_DATA (still identified as DEMO)", () => {
    expect(demoFactors("C_UNAVAILABLE", "demo-1")).toBeNull();
    const r = computeRisk(demoFactors("C_UNAVAILABLE", "demo-1") ?? {}, { now: NOW, forceSource: "DEMO" });
    expect(r.level).toBe("INSUFFICIENT_DATA");
    expect(r.source).toBe("DEMO");
  });
  it("D recovery moves from high toward normal over time", () => {
    const start = NOW.toISOString();
    const at = (min: number) => {
      const now = new Date(NOW.getTime() + min * 60_000);
      return computeRisk(demoFactors("D_RECOVERY", "demo-2", { recoveryStartedAt: start, now })!, { now, forceSource: "DEMO" }).score!;
    };
    expect(at(0)).toBeGreaterThan(at(5));
    expect(at(5)).toBeGreaterThan(at(10));
    expect(at(10)).toBeLessThan(35);
  });
});
