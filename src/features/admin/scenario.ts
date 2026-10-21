import { z } from "zod";
import type { DemoScenario } from "@/types/transit";

export const SCENARIO_IDS = ["A_NORMAL", "B_HIGH_RISK", "C_UNAVAILABLE", "D_RECOVERY"] as const;
export const scenarioSchema = z.enum(SCENARIO_IDS);

export const SCENARIOS: { id: DemoScenario; letter: string; title: string; description: string }[] = [
  { id: "A_NORMAL", letter: "A", title: "Normal operation", description: "Vehicles with regular intervals and hypothetically low risk." },
  { id: "B_HIGH_RISK", letter: "B", title: "High crowding risk", description: "Irregular intervals, delays and a hypothetical increase in risk." },
  { id: "C_UNAVAILABLE", letter: "C", title: "Data unavailable", description: "Insufficient or outdated data; estimates fall back to unknown." },
  { id: "D_RECOVERY", letter: "D", title: "Recovery", description: "Gradual return to normal operation." },
];

export function scenarioTitle(id: DemoScenario | null | undefined): string {
  const s = SCENARIOS.find((x) => x.id === id);
  return s ? `Scenario ${s.letter} — ${s.title}` : "Unknown scenario";
}

export type ScenarioState = { scenario: DemoScenario; setBy: string | null; setAt: string | null; recoveryStartedAt?: string | null };
export type ScenarioActions = {
  setScenario(scenario: DemoScenario, actorId: string): Promise<ScenarioState>;
  resetScenario(actorId: string): Promise<ScenarioState>;
};

const commandSchema = z.union([z.object({ scenario: scenarioSchema }), z.object({ reset: z.literal(true) })]);

/** Valida o comando e executa a transição via ações injetadas (persistência + auditoria ficam nelas). */
export async function applyScenarioCommand(actions: ScenarioActions, input: unknown, actorId: string): Promise<ScenarioState> {
  const parsed = commandSchema.parse(input);
  return "reset" in parsed ? actions.resetScenario(actorId) : actions.setScenario(parsed.scenario, actorId);
}

export type ScenarioView = ScenarioState & { title: string; isDemo: true; setByName: string | null };

export function toScenarioView(state: ScenarioState, setByName: string | null = null): ScenarioView {
  return { ...state, title: scenarioTitle(state.scenario), isDemo: true, setByName };
}
