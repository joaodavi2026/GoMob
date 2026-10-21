import { db } from "@/server/db";
import type { DemoScenario } from "@/types/transit";

const KEY = "demo.scenario";
const DEFAULT: DemoScenario = "A_NORMAL";

export type ScenarioState = { scenario: DemoScenario; setBy: string | null; setAt: string | null; recoveryStartedAt?: string | null };

const VALID: DemoScenario[] = ["A_NORMAL", "B_HIGH_RISK", "C_UNAVAILABLE", "D_RECOVERY"];

/** Lê o cenário demo atual. Sem banco disponível, cai no cenário padrão (A). */
export async function getScenario(): Promise<ScenarioState> {
  try {
    const row = await db.appSetting.findUnique({ where: { key: KEY } });
    const v = row?.value as Partial<ScenarioState> | null | undefined;
    if (v && v.scenario && VALID.includes(v.scenario)) {
      return { scenario: v.scenario, setBy: v.setBy ?? null, setAt: v.setAt ?? null, recoveryStartedAt: v.recoveryStartedAt ?? null };
    }
  } catch {
    // banco indisponível: usa padrão
  }
  return { scenario: DEFAULT, setBy: null, setAt: null };
}

export async function setScenario(scenario: DemoScenario, actorId: string): Promise<ScenarioState> {
  const state: ScenarioState = {
    scenario,
    setBy: actorId,
    setAt: new Date().toISOString(),
    recoveryStartedAt: scenario === "D_RECOVERY" ? new Date().toISOString() : null,
  };
  await db.appSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: state }, update: { value: state } });
  await db.auditLog.create({ data: { actorId, action: "DEMO_SCENARIO_SET", entityType: "AppSetting", entityId: scenario } });
  return state;
}

export async function resetScenario(actorId: string): Promise<ScenarioState> {
  const state = await setScenario(DEFAULT, actorId);
  await db.auditLog.create({ data: { actorId, action: "DEMO_RESET", entityType: "AppSetting", entityId: KEY } });
  return state;
}
