import { describe, expect, it } from "vitest";
import { classifyScore, clamp, computeRisk, normalize, type FactorObservation } from "@/features/intelligence/engine";
import { DEFAULT_WEIGHTS, parseWeights, weightsAreValid } from "@/features/intelligence/weights";

const NOW = new Date("2026-10-21T15:00:00Z");
const f = (value: number | null, extra: Partial<FactorObservation> = {}): FactorObservation => ({
  value,
  observedAt: NOW.toISOString(),
  granularity: "REALTIME",
  origin: "DERIVED",
  ...extra,
});

describe("weights", () => {
  it("default sums to 1 and is valid", () => {
    expect(DEFAULT_WEIGHTS.demand + DEFAULT_WEIGHTS.headway + DEFAULT_WEIGHTS.delay + DEFAULT_WEIGHTS.operations).toBeCloseTo(1, 10);
    expect(weightsAreValid(DEFAULT_WEIGHTS)).toBe(true);
  });
  it("accepts custom weights that sum to 1", () => {
    const w = { demand: 0.25, headway: 0.25, delay: 0.25, operations: 0.25 };
    expect(parseWeights(w)).toEqual(w);
  });
  it("falls back to defaults for invalid, missing or non-summing weights", () => {
    expect(parseWeights(null)).toEqual(DEFAULT_WEIGHTS);
    expect(parseWeights({ demand: 0.5, headway: 0.5, delay: 0.5, operations: 0.5 })).toEqual(DEFAULT_WEIGHTS);
    expect(parseWeights({ demand: -0.1, headway: 0.6, delay: 0.3, operations: 0.2 })).toEqual(DEFAULT_WEIGHTS);
    expect(parseWeights({ demand: "a" })).toEqual(DEFAULT_WEIGHTS);
  });
});

describe("normalization and limits", () => {
  it("normalizes into 0-100 and clamps", () => {
    expect(normalize(5, 0, 10)).toBe(50);
    expect(normalize(-5, 0, 10)).toBe(0);
    expect(normalize(50, 0, 10)).toBe(100);
    expect(normalize(Number.NaN, 0, 10)).toBe(0);
    expect(clamp(150)).toBe(100);
    expect(clamp(-3)).toBe(0);
  });
  it("clamps out-of-range factor values and treats NaN/Infinity as missing", () => {
    const r = computeRisk({ demand: f(250), headway: f(-40), delay: f(Number.NaN), operations: f(Number.POSITIVE_INFINITY) }, { now: NOW });
    expect(r.factors.demand).toBe(100);
    expect(r.factors.headway).toBe(0);
    expect(r.factors.delay).toBeNull();
    expect(r.factors.operations).toBeNull();
  });
});

describe("score formula", () => {
  it("applies 0.35D + 0.30I + 0.20A + 0.15O", () => {
    const r = computeRisk({ demand: f(80), headway: f(60), delay: f(40), operations: f(20) }, { now: NOW });
    expect(r.score).toBe(57); // 28 + 18 + 8 + 3
    expect(r.level).toBe("MODERATE");
    expect(r.source).toBe("DERIVED");
  });
  it("uses configurable weights", () => {
    const r = computeRisk(
      { demand: f(100), headway: f(0), delay: f(0), operations: f(0) },
      { now: NOW, weights: { demand: 0.7, headway: 0.1, delay: 0.1, operations: 0.1 } },
    );
    expect(r.score).toBe(70);
    expect(r.level).toBe("HIGH");
  });
});

describe("classification boundaries 34/35/69/70", () => {
  it("classifyScore", () => {
    expect(classifyScore(0)).toBe("LOW");
    expect(classifyScore(34)).toBe("LOW");
    expect(classifyScore(35)).toBe("MODERATE");
    expect(classifyScore(69)).toBe("MODERATE");
    expect(classifyScore(70)).toBe("HIGH");
    expect(classifyScore(100)).toBe("HIGH");
  });
  it.each([
    [34, "LOW"],
    [35, "MODERATE"],
    [69, "MODERATE"],
    [70, "HIGH"],
  ] as const)("computeRisk with all factors = %i -> %s", (v, level) => {
    const r = computeRisk({ demand: f(v), headway: f(v), delay: f(v), operations: f(v) }, { now: NOW });
    expect(r.score).toBe(v);
    expect(r.level).toBe(level);
  });
});

describe("missing data policy", () => {
  it("no factors -> INSUFFICIENT_DATA with null score and confidence", () => {
    const r = computeRisk({}, { now: NOW });
    expect(r.level).toBe("INSUFFICIENT_DATA");
    expect(r.score).toBeNull();
    expect(r.confidence).toBeNull();
    expect(r.explanation).toMatch(/never treated as low risk/);
  });
  it("essential factor (headway) missing -> INSUFFICIENT_DATA even if others exist", () => {
    const r = computeRisk({ demand: f(90), delay: f(90), operations: f(90) }, { now: NOW });
    expect(r.level).toBe("INSUFFICIENT_DATA");
    expect(r.score).toBeNull();
  });
  it("headway alone does not reach minimum coverage", () => {
    expect(computeRisk({ headway: f(90) }, { now: NOW }).level).toBe("INSUFFICIENT_DATA");
  });
  it("missing factors are NOT zeros: weights are renormalized over available factors", () => {
    const r = computeRisk({ headway: f(60), operations: f(30) }, { now: NOW });
    expect(r.score).toBe(50); // (0.30*60 + 0.15*30) / 0.45, not 22.5 as if missing were 0
    expect(r.factors.demand).toBeNull();
    expect(r.factors.delay).toBeNull();
  });
  it("explanation only cites calculated factors as basis and flags the rest as not available", () => {
    const r = computeRisk({ headway: f(90), operations: f(80) }, { now: NOW });
    expect(r.level).toBe("HIGH");
    expect(r.explanation).toMatch(/irregular bus intervals/);
    expect(r.explanation).not.toMatch(/operational delays/);
    expect(r.explanation).not.toMatch(/historically high demand/);
    expect(r.explanation).toMatch(/Based on 2 of 4 signals/);
    expect(r.explanation).toMatch(/Not available: historical demand, operational delay/);
  });
  it("fewer factors lower confidence versus full data", () => {
    const full = computeRisk({ demand: f(50), headway: f(50), delay: f(50), operations: f(50) }, { now: NOW });
    const partial = computeRisk({ headway: f(50), operations: f(50) }, { now: NOW });
    expect(partial.confidence!).toBeLessThan(full.confidence!);
  });
});

describe("confidence", () => {
  it("is within 0-1 and decays with stale observations", () => {
    const fresh = computeRisk({ headway: f(50), operations: f(50) }, { now: NOW });
    const old = new Date(NOW.getTime() - 14 * 60_000).toISOString();
    const stale = computeRisk({ headway: f(50, { observedAt: old }), operations: f(50, { observedAt: old }) }, { now: NOW });
    expect(fresh.confidence!).toBeGreaterThan(stale.confidence!);
    for (const r of [fresh, stale]) {
      expect(r.confidence!).toBeGreaterThanOrEqual(0);
      expect(r.confidence!).toBeLessThanOrEqual(1);
    }
  });
  it("DEMO origin yields DEMO source and lower confidence than DERIVED", () => {
    const demo = computeRisk({ headway: f(50, { origin: "DEMO" }), operations: f(50, { origin: "DEMO" }) }, { now: NOW });
    const real = computeRisk({ headway: f(50), operations: f(50) }, { now: NOW });
    expect(demo.source).toBe("DEMO");
    expect(demo.confidence!).toBeLessThan(real.confidence!);
  });
  it("respects confidence cap", () => {
    const r = computeRisk({ headway: f(50), operations: f(50) }, { now: NOW, confidenceCap: 0.3 });
    expect(r.confidence!).toBeLessThanOrEqual(0.3);
  });
});
