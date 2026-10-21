import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_WEIGHTS,
  WEIGHTS_SETTING_KEY,
  WeightsError,
  diffWeights,
  loadWeights,
  operatingMode,
  saveWeights,
  sumWeights,
  validateWeights,
  weightsFromSetting,
  type SettingsDb,
} from "@/features/admin/weights";

function fakeDb(stored?: unknown) {
  const upsert = vi.fn().mockResolvedValue({});
  const create = vi.fn().mockResolvedValue({});
  const db = {
    appSetting: { findUnique: vi.fn().mockResolvedValue(stored === undefined ? null : { value: stored }), upsert },
    auditLog: { create },
  } as unknown as SettingsDb;
  return { db, upsert, create };
}

describe("weights validation", () => {
  it("defaults sum to 1", () => expect(sumWeights(DEFAULT_WEIGHTS)).toBeCloseTo(1, 10));
  it("accepts weights summing to 1", () => expect(validateWeights({ demand: 0.4, headway: 0.3, delay: 0.2, operations: 0.1 }).ok).toBe(true));
  it("accepts tiny float error within 1e-6", () => expect(validateWeights({ demand: 0.1, headway: 0.2, delay: 0.3, operations: 0.4000004 }).ok).toBe(true));
  it("rejects sum != 1", () => {
    const r = validateWeights({ demand: 0.5, headway: 0.3, delay: 0.2, operations: 0.15 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/sum to 1/);
  });
  it("rejects out-of-range, NaN and extra keys", () => {
    expect(validateWeights({ demand: 1.2, headway: -0.2, delay: 0, operations: 0 }).ok).toBe(false);
    expect(validateWeights({ demand: NaN, headway: 0.5, delay: 0.25, operations: 0.25 }).ok).toBe(false);
    expect(validateWeights({ ...DEFAULT_WEIGHTS, extra: 0 }).ok).toBe(false);
    expect(validateWeights(null).ok).toBe(false);
  });
  it("falls back to defaults for invalid stored value", () => expect(weightsFromSetting({ demand: 2 })).toEqual(DEFAULT_WEIGHTS));
  it("diffWeights lists only changed factors", () => {
    expect(diffWeights(DEFAULT_WEIGHTS, { ...DEFAULT_WEIGHTS, demand: 0.45, delay: 0.1 })).toEqual({ demand: { from: 0.35, to: 0.45 }, delay: { from: 0.2, to: 0.1 } });
  });
});

describe("saveWeights", () => {
  const next = { demand: 0.25, headway: 0.25, delay: 0.25, operations: 0.25 };

  it("persists and writes an audit log in DEMO mode", async () => {
    const { db, upsert, create } = fakeDb();
    const r = await saveWeights(db, next, "admin1", "DEMO");
    expect(r.weights).toEqual(next);
    expect(Object.keys(r.changed).sort()).toEqual(["delay", "demand", "headway", "operations"]);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { key: WEIGHTS_SETTING_KEY } }));
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ actorId: "admin1", action: "INTELLIGENCE_WEIGHTS_UPDATED" }) });
  });

  it("refuses in LIVE mode without touching the database", async () => {
    const { db, upsert, create } = fakeDb();
    await expect(saveWeights(db, next, "admin1", "LIVE")).rejects.toMatchObject({ code: "NOT_DEMO_MODE" });
    expect(upsert).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses invalid weights without persisting", async () => {
    const { db, upsert, create } = fakeDb();
    const p = saveWeights(db, { ...next, demand: 0.9 }, "admin1", "DEMO");
    await expect(p).rejects.toBeInstanceOf(WeightsError);
    await expect(p).rejects.toMatchObject({ code: "INVALID" });
    expect(upsert).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("loadWeights degrades to defaults when the DB throws", async () => {
    const db = { appSetting: { findUnique: vi.fn().mockRejectedValue(new Error("down")) } };
    expect(await loadWeights(db as never)).toEqual(DEFAULT_WEIGHTS);
  });
});

describe("operatingMode", () => {
  it("is DEMO without token and LIVE with one", () => {
    expect(operatingMode({})).toBe("DEMO");
    expect(operatingMode({ SPTRANS_API_TOKEN: "  " })).toBe("DEMO");
    expect(operatingMode({ SPTRANS_API_TOKEN: "abc" })).toBe("LIVE");
  });
});
