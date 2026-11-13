import { describe, expect, it } from "vitest";
import { computeRisk } from "@/features/intelligence/engine";
import { estimatedIntervalMinutes, intervalFactor, routeLengthMeters, typicalDemand } from "@/features/intelligence/profile";

describe("estimativa de reserva (poucos ônibus ao vivo)", () => {
  it("demanda típica: pico nos horários de pico, baixa de madrugada e menor no domingo", () => {
    const peak = typicalDemand(2, 7).value!;
    const night = typicalDemand(2, 23).value!;
    expect(peak).toBeGreaterThan(80);
    expect(night).toBeLessThan(35);
    expect(typicalDemand(0, 7).value!).toBeLessThan(peak);
    expect(typicalDemand(3, 99).value).toBe(typicalDemand(3, 23).value);
  });

  it("intervalo estimado cresce com o trajeto e cai com mais ônibus", () => {
    expect(estimatedIntervalMinutes(15_000, 2)).toBeCloseTo(30);
    expect(estimatedIntervalMinutes(15_000, 6)).toBeCloseTo(10);
    expect(estimatedIntervalMinutes(15_000, 0)).toBeNull();
    const at = new Date().toISOString();
    expect(intervalFactor(15_000, 1, at).value).toBe(100);
    expect(intervalFactor(15_000, 10, at).value).toBe(0);
    expect(intervalFactor(15_000, 0, at).value).toBeNull();
  });

  it("mede a extensão do trajeto pelas paradas", () => {
    const stops = [
      { latitude: -23.55, longitude: -46.63 },
      { latitude: -23.56, longitude: -46.63 },
      { latitude: -23.57, longitude: -46.63 },
    ];
    expect(routeLengthMeters(stops)).toBeGreaterThan(2100);
    expect(routeLengthMeters(stops)).toBeLessThan(2300);
    expect(routeLengthMeters([])).toBe(0);
  });

  it("vira uma estimativa com confiança limitada, em vez de 'dados insuficientes'", () => {
    const now = new Date("2026-11-12T10:00:00Z");
    const at = now.toISOString();
    const opts = { now, essential: [], minCoverage: 0.3, confidenceCap: 0.4 };
    const onlyDemand = computeRisk({ demand: typicalDemand(4, 7) }, opts);
    expect(onlyDemand.level).not.toBe("INSUFFICIENT_DATA");
    expect(onlyDemand.confidence).toBeLessThanOrEqual(0.4);
    const fewBuses = computeRisk({ demand: typicalDemand(4, 7), headway: intervalFactor(20_000, 1, at) }, opts);
    expect(fewBuses.level).toBe("HIGH");
    // sem nenhum sinal continua sem estimativa
    expect(computeRisk({}, opts).level).toBe("INSUFFICIENT_DATA");
  });
});
