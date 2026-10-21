import { describe, expect, it } from "vitest";
import { deriveLineAlerts, deriveSystemAlerts, type LineSignals } from "@/features/alerts/derive";
import type { RiskResult } from "@/types/transit";

const NOW = new Date("2026-10-21T15:00:00Z");
const risk = (over: Partial<RiskResult> = {}, factors: Partial<RiskResult["factors"]> = {}): RiskResult => ({
  score: 20,
  level: "LOW",
  confidence: 0.8,
  factors: { demand: null, headway: 10, delay: null, operations: 10, ...factors },
  source: "DERIVED",
  calculatedAt: NOW.toISOString(),
  explanation: "x",
  ...over,
});
const base = (over: Partial<LineSignals> = {}): LineSignals => ({
  lineId: "SP-1",
  lineLabel: "8000-10",
  vehiclesState: "CONNECTED",
  vehicleCount: 5,
  risk: risk(),
  isDemo: false,
  ...over,
});

describe("derived alerts", () => {
  it("emits nothing when everything is normal (no invented incidents)", () => {
    expect(deriveLineAlerts(base(), NOW)).toEqual([]);
  });
  it("API failure and stale data", () => {
    expect(deriveLineAlerts(base({ vehiclesState: "UNAVAILABLE" }), NOW).map((a) => a.type)).toEqual(["API_FAILURE"]);
    expect(deriveLineAlerts(base({ vehiclesState: "STALE" }), NOW).map((a) => a.type)).toEqual(["STALE_DATA"]);
  });
  it("high observed intervals only from a calculated headway factor", () => {
    expect(deriveLineAlerts(base({ risk: risk({}, { headway: 85 }) }), NOW).map((a) => a.type)).toContain("HIGH_INTERVALS");
    expect(deriveLineAlerts(base({ risk: risk({}, { headway: null }) }), NOW)).toEqual([]);
  });
  it("delay alert requires a calculated delay factor", () => {
    expect(deriveLineAlerts(base({ risk: risk({}, { delay: 80 }) }), NOW).map((a) => a.type)).toContain("DELAY_INFERRED");
    expect(deriveLineAlerts(base(), NOW).map((a) => a.type)).not.toContain("DELAY_INFERRED");
  });
  it("risk change only between two calculated levels", () => {
    const up = deriveLineAlerts(base({ risk: risk({ level: "HIGH", score: 80 }), previous: { level: "LOW", score: 20 } }), NOW);
    expect(up.find((a) => a.type === "RISK_CHANGE")?.title).toMatch(/increased/);
    const unknown = deriveLineAlerts(base({ risk: risk({ level: "HIGH", score: 80 }), previous: { level: "INSUFFICIENT_DATA", score: null } }), NOW);
    expect(unknown.map((a) => a.type)).not.toContain("RISK_CHANGE");
  });
  it("demo alerts are flagged and ids are stable within a time bucket", () => {
    const a = deriveLineAlerts(base({ isDemo: true, vehiclesState: "STALE" }), NOW);
    expect(a[0].isDemo).toBe(true);
    expect(a[0].id).toBe(deriveLineAlerts(base({ isDemo: true, vehiclesState: "STALE" }), new Date(NOW.getTime() + 60_000))[0].id);
  });
  it("system alerts for failed integrations only when configured", () => {
    const out = deriveSystemAlerts(
      [
        { key: "sptrans", label: "SPTrans Olho Vivo", configured: true, state: "UNAVAILABLE", lastFailureAt: null },
        { key: "google", label: "Google Routes", configured: false, state: "UNAVAILABLE", lastFailureAt: null },
      ],
      false,
      NOW,
    );
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("API_FAILURE");
  });
});
