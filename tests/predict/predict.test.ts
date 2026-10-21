import { describe, expect, it } from "vitest";
import type { HistoryRow } from "@/features/intelligence/demand";
import { buildPrediction, illustrativeDemandProfile, parseTarget } from "@/features/predict/engine";
import { predictQuerySchema } from "@/features/predict/schema";

const NOW = new Date("2026-10-21T15:00:00Z");
const mondays = ["2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19"];
const hourly: HistoryRow[] = mondays.flatMap((d) =>
  Array.from({ length: 15 }, (_, i) => {
    const hour = 6 + i;
    return { referenceDate: new Date(`${d}T${String(hour + 3).padStart(2, "0")}:00:00Z`), passengerCount: hour === 8 ? 1000 : 200, granularity: "HOURLY", source: "TEST" };
  }),
);
const daily: HistoryRow[] = mondays.map((d) => ({ referenceDate: new Date(`${d}T12:00:00Z`), passengerCount: 40000, granularity: "DAILY", source: "TEST" }));
const monday8 = parseTarget({ weekday: 1, time: "08:00" })!;

describe("parseTarget", () => {
  it("derives the weekday from a date and validates time", () => {
    expect(parseTarget({ date: "2026-10-19", time: "07:30" })).toMatchObject({ weekday: 1, hour: 7, minute: 30 });
    expect(parseTarget({ date: "2026-10-19", time: "25:00" })).toBeNull();
    expect(parseTarget({ date: "2026-13-45", time: "10:00" })).toBeNull();
    expect(parseTarget({ time: "10:00" })).toBeNull();
    expect(parseTarget({ weekday: 9, time: "10:00" })).toBeNull();
  });
});

describe("query schema", () => {
  it("requires a date or weekday and a valid time", () => {
    expect(predictQuerySchema.safeParse({ lineId: "demo-1", time: "08:00" }).success).toBe(false);
    expect(predictQuerySchema.safeParse({ lineId: "demo-1", time: "8:00", weekday: "1" }).success).toBe(false);
    expect(predictQuerySchema.safeParse({ lineId: "demo-1", time: "08:00", weekday: "1" }).success).toBe(true);
    expect(predictQuerySchema.safeParse({ lineId: "demo-1", time: "08:00", date: "2026-10-19", direction: "2" }).success).toBe(true);
  });
});

describe("buildPrediction", () => {
  const common = { target: monday8, scenario: "A_NORMAL" as const, lineKey: "demo-1", now: NOW };

  it("sustained hourly history -> pattern-based, not demo, capped confidence", () => {
    const p = buildPrediction({ ...common, history: hourly, mode: "LIVE" });
    expect(p.isDemo).toBe(false);
    expect(p.historicalSource.kind).toBe("HISTORICAL");
    expect(p.historicalSource.granularity).toBe("HOURLY");
    expect(p.risk.level).toBe("HIGH"); // 08h é o pico (100)
    expect(p.risk.source).toBe("DERIVED");
    expect(p.risk.confidence!).toBeLessThanOrEqual(0.6);
    expect(p.limitations.join(" ")).toMatch(/cannot be known in advance/);
  });

  it("off-peak hour from the same history is lower", () => {
    const p = buildPrediction({ ...common, target: parseTarget({ weekday: 1, time: "12:00" })!, history: hourly, mode: "LIVE" });
    expect(p.risk.level).toBe("LOW"); // 200/1000 = 20
  });

  it("daily-only data never yields an hourly pattern (LIVE -> insufficient)", () => {
    const p = buildPrediction({ ...common, history: daily, mode: "LIVE" });
    expect(p.risk.level).toBe("INSUFFICIENT_DATA");
    expect(p.risk.score).toBeNull();
    expect(p.isDemo).toBe(false);
    expect(p.limitations.join(" ")).toMatch(/day-level aggregated/);
    expect(p.historicalSource.kind).toBe("NONE");
  });

  it("no history in LIVE mode -> insufficient, nothing fabricated", () => {
    const p = buildPrediction({ ...common, history: [], mode: "LIVE" });
    expect(p.risk.level).toBe("INSUFFICIENT_DATA");
    expect(p.dataQuality.level).toBe("NONE");
  });

  it("no sustained pattern in DEMO mode -> explicitly labeled demonstration scenario", () => {
    const p = buildPrediction({ ...common, history: daily, mode: "DEMO" });
    expect(p.isDemo).toBe(true);
    expect(p.risk.source).toBe("DEMO");
    expect(p.historicalSource.kind).toBe("DEMO_SCENARIO");
    expect(p.dataQuality.level).toBe("DEMO");
    expect(p.limitations.join(" ")).toMatch(/not a validated forecast/);
    expect(p.risk.explanation).toMatch(/not a validated forecast/);
    expect(p.risk.confidence!).toBeLessThanOrEqual(0.4);
  });

  it("demo peak vs off-peak follows the illustrative profile", () => {
    const peak = buildPrediction({ ...common, history: [], mode: "DEMO" });
    const night = buildPrediction({ ...common, target: parseTarget({ weekday: 1, time: "23:00" })!, history: [], mode: "DEMO" });
    expect(illustrativeDemandProfile(1, 8)).toBeGreaterThan(illustrativeDemandProfile(1, 23));
    expect(peak.risk.score!).toBeGreaterThan(night.risk.score!);
  });

  it("demo scenario C (unavailable) -> insufficient data, still labeled demo", () => {
    const p = buildPrediction({ ...common, scenario: "C_UNAVAILABLE", history: [], mode: "DEMO" });
    expect(p.risk.level).toBe("INSUFFICIENT_DATA");
    expect(p.isDemo).toBe(true);
  });

  it("flags dates in the past", () => {
    const p = buildPrediction({ ...common, target: parseTarget({ date: "2026-10-12", time: "08:00" })!, history: hourly, mode: "LIVE", todaySp: "2026-10-21" });
    expect(p.limitations.join(" ")).toMatch(/in the past/);
  });
});
