import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { SCENARIOS, applyScenarioCommand, scenarioTitle, toScenarioView, type ScenarioActions, type ScenarioState } from "@/features/admin/scenario";

function actions() {
  const mk = (scenario: ScenarioState["scenario"], actor: string): ScenarioState => ({ scenario, setBy: actor, setAt: "2026-01-01T00:00:00.000Z" });
  const setScenario = vi.fn(async (s: ScenarioState["scenario"], a: string) => mk(s, a));
  const resetScenario = vi.fn(async (a: string) => mk("A_NORMAL", a));
  return { a: { setScenario, resetScenario } as ScenarioActions, setScenario, resetScenario };
}

describe("scenario transitions", () => {
  it("defines the four scenarios A-D", () => expect(SCENARIOS.map((s) => s.letter)).toEqual(["A", "B", "C", "D"]));

  it("sets scenario B recording the actor", async () => {
    const { a, setScenario } = actions();
    const r = await applyScenarioCommand(a, { scenario: "B_HIGH_RISK" }, "admin1");
    expect(setScenario).toHaveBeenCalledWith("B_HIGH_RISK", "admin1");
    expect(r).toMatchObject({ scenario: "B_HIGH_RISK", setBy: "admin1" });
  });

  it("supports C and D", async () => {
    const { a } = actions();
    expect((await applyScenarioCommand(a, { scenario: "C_UNAVAILABLE" }, "x")).scenario).toBe("C_UNAVAILABLE");
    expect((await applyScenarioCommand(a, { scenario: "D_RECOVERY" }, "x")).scenario).toBe("D_RECOVERY");
  });

  it("reset returns to scenario A", async () => {
    const { a, resetScenario, setScenario } = actions();
    const r = await applyScenarioCommand(a, { reset: true }, "admin1");
    expect(resetScenario).toHaveBeenCalledWith("admin1");
    expect(setScenario).not.toHaveBeenCalled();
    expect(r.scenario).toBe("A_NORMAL");
  });

  it("rejects unknown scenarios and malformed commands without side effects", async () => {
    const { a, setScenario, resetScenario } = actions();
    await expect(applyScenarioCommand(a, { scenario: "Z" }, "x")).rejects.toBeInstanceOf(ZodError);
    await expect(applyScenarioCommand(a, { reset: false }, "x")).rejects.toBeInstanceOf(ZodError);
    await expect(applyScenarioCommand(a, null, "x")).rejects.toBeInstanceOf(ZodError);
    expect(setScenario).not.toHaveBeenCalled();
    expect(resetScenario).not.toHaveBeenCalled();
  });

  it("view is always flagged as demo data", () => {
    const v = toScenarioView({ scenario: "B_HIGH_RISK", setBy: "u", setAt: "t" }, "Ana");
    expect(v).toMatchObject({ isDemo: true, setByName: "Ana", title: "Scenario B — High crowding risk" });
    expect(scenarioTitle(null)).toBe("Unknown scenario");
  });
});
