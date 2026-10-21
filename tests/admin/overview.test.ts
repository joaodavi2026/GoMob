import { describe, expect, it } from "vitest";
import { apiStatus, buildOverview, classifyFreshness, observationBuckets, riskDistribution } from "@/features/admin/overview";
import { loadOverview, type OverviewDb } from "@/features/admin/overview-service";
import { buildLineWhere, lineListQuerySchema, lineToggleSchema, setLineActive, type LinesDb } from "@/features/admin/lines";

const now = new Date("2026-06-01T12:00:00.000Z");
const ago = (min: number) => new Date(now.getTime() - min * 60_000);

describe("overview aggregations", () => {
  it("classifies freshness", () => {
    expect(classifyFreshness(ago(1), now)).toBe("FRESH");
    expect(classifyFreshness(ago(5), now)).toBe("STALE");
    expect(classifyFreshness(ago(30), now)).toBe("UNAVAILABLE");
    expect(classifyFreshness(null, now)).toBe("UNAVAILABLE");
    expect(classifyFreshness("garbage", now)).toBe("UNAVAILABLE");
  });

  it("counts risk distribution, including unknown separately", () => {
    expect(riskDistribution([{ riskLevel: "LOW" }, { riskLevel: "LOW" }, { riskLevel: "HIGH" }, { riskLevel: "INSUFFICIENT_DATA" }])).toEqual({
      LOW: 2,
      MODERATE: 0,
      HIGH: 1,
      INSUFFICIENT_DATA: 1,
    });
  });

  it("buckets observations oldest -> newest and ignores out-of-window", () => {
    const b = observationBuckets([ago(1), ago(2), ago(15), ago(59), ago(61), ago(-5)], now);
    expect(b).toHaveLength(6);
    expect(b[5]).toEqual({ label: "now", count: 2 });
    expect(b[4].count).toBe(1);
    expect(b[0].count).toBe(1);
    expect(b.reduce((a, x) => a + x.count, 0)).toBe(4);
  });

  it("derives API status", () => {
    expect(apiStatus([], "DEMO")).toBe("DEMO");
    expect(apiStatus([{ state: "CONNECTED", configured: true }], "LIVE")).toBe("OK");
    expect(apiStatus([{ state: "UNAVAILABLE", configured: true }, { state: "CONNECTED", configured: true }], "LIVE")).toBe("DEGRADED");
    expect(apiStatus([{ state: "UNAVAILABLE", configured: true }], "LIVE")).toBe("DOWN");
    expect(apiStatus([], "LIVE")).toBe("DOWN");
  });

  it("builds metrics without fabricating values", () => {
    const o = buildOverview({
      now,
      mode: "DEMO",
      lines: [
        { active: true, source: "DEMO" },
        { active: false, source: "DEMO" },
        { active: true, source: "SPTRANS" },
      ],
      vehicles: [
        { observedAt: ago(1), isDemo: true },
        { observedAt: ago(8), isDemo: true },
        { observedAt: ago(40), isDemo: true },
      ],
      estimates: [
        { riskLevel: "LOW", expiresAt: ago(-5), calculatedAt: ago(2) },
        { riskLevel: "INSUFFICIENT_DATA", expiresAt: ago(-5), calculatedAt: ago(3) },
        { riskLevel: "HIGH", expiresAt: ago(10), calculatedAt: ago(20) },
      ],
      integrations: [],
    });
    expect(o.metrics).toMatchObject({ monitoredLines: 2, totalLines: 3, trackedVehicles: 2, availableEstimates: 1, apiStatus: "DEMO" });
    expect(o.isDemo).toBe(true);
    expect(o.riskDistribution).toEqual({ LOW: 1, MODERATE: 0, HIGH: 0, INSUFFICIENT_DATA: 1 });
    expect(o.dataFreshness).toEqual({ FRESH: 1, STALE: 1, UNAVAILABLE: 1 });
    expect(o.linesBySource).toEqual({ DEMO: { active: 1, inactive: 1 }, SPTRANS: { active: 1, inactive: 0 } });
    expect(o.latestEstimateAt).toBe(ago(2).toISOString());
  });

  it("returns zeros (not invented numbers) when the database fails", async () => {
    const boom = () => Promise.reject(new Error("no db"));
    const db = { busLine: { findMany: boom }, busVehicle: { findMany: boom }, riskEstimate: { findMany: boom } } as unknown as OverviewDb;
    const o = await loadOverview(db, { now, env: {} });
    expect(o.dbAvailable).toBe(false);
    expect(o.metrics).toMatchObject({ monitoredLines: 0, trackedVehicles: 0, availableEstimates: 0 });
    expect(o.isDemo).toBe(true);
  });
});

describe("lines admin logic", () => {
  it("builds search/filter where", () => {
    const q = lineListQuerySchema.parse({ search: " 8000 ", active: "true", source: "DEMO" });
    const w = buildLineWhere(q);
    expect(w.active).toBe(true);
    expect(w.source).toBe("DEMO");
    expect((w.OR as unknown[]).length).toBe(3);
    expect(q.pageSize).toBe(25);
  });

  it("requires exactly one of id/externalCode", () => {
    expect(lineToggleSchema.safeParse({ active: true }).success).toBe(false);
    expect(lineToggleSchema.safeParse({ id: "a", externalCode: "b", active: true }).success).toBe(false);
    expect(lineToggleSchema.safeParse({ externalCode: "b", active: false }).success).toBe(true);
  });

  it("toggles only the internal flag and audits", async () => {
    const row = { id: "l1", externalCode: "8000", displayCode: "8000-10", name: "X", direction: 1, source: "SPTRANS", active: false, lastSyncedAt: null };
    const calls: unknown[] = [];
    const db = {
      busLine: {
        findFirst: async () => row,
        updateMany: async (a: unknown) => {
          calls.push(a);
          return { count: 1 };
        },
      },
      auditLog: {
        create: async (a: unknown) => {
          calls.push(a);
          return {};
        },
      },
    } as unknown as LinesDb;
    const r = await setLineActive(db, { externalCode: "8000", active: true }, "admin1");
    expect(r?.active).toBe(true);
    expect(calls[0]).toEqual({ where: { id: "l1" }, data: { active: true } });
    expect(calls[1]).toMatchObject({ data: { actorId: "admin1", action: "LINE_MONITORING_ENABLED", entityId: "l1" } });
  });

  it("returns null for unknown line", async () => {
    const db = { busLine: { findFirst: async () => null }, auditLog: { create: async () => ({}) } } as unknown as LinesDb;
    expect(await setLineActive(db, { id: "nope", active: true }, "a")).toBeNull();
  });
});
