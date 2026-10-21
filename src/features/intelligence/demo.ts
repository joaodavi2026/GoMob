import type { DemoScenario } from "@/types/transit";
import { clamp, FACTOR_KEYS, type FactorKey, type RiskInputs } from "./engine";

type Four = Record<FactorKey, number>;

const A_NORMAL: Four = { demand: 35, headway: 22, delay: 18, operations: 20 };
const B_HIGH: Four = { demand: 82, headway: 86, delay: 72, operations: 78 };

export const DEMO_LABEL = "Demonstration scenario (simulated data, not real operations).";
export const RECOVERY_MINUTES = 10;

/** Hash determinístico -> [-1, 1]. */
export function hashUnit(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 2001) / 1000 - 1;
}

/**
 * Fatores demonstrativos determinísticos por cenário e linha. C_UNAVAILABLE => null (dados indisponíveis).
 * D_RECOVERY interpola de B para A durante RECOVERY_MINUTES desde recoveryStartedAt.
 */
export function demoFactors(
  scenario: DemoScenario,
  lineKey: string,
  opts: { recoveryStartedAt?: string | null; now?: Date } = {},
): RiskInputs | null {
  if (scenario === "C_UNAVAILABLE") return null;
  const now = opts.now ?? new Date();
  let base: Four;
  if (scenario === "D_RECOVERY") {
    const started = opts.recoveryStartedAt ? Date.parse(opts.recoveryStartedAt) : NaN;
    const p = Number.isNaN(started) ? 0.5 : clamp((now.getTime() - started) / 60000 / RECOVERY_MINUTES, 0, 1);
    base = { ...A_NORMAL };
    for (const k of FACTOR_KEYS) base[k] = B_HIGH[k] + (A_NORMAL[k] - B_HIGH[k]) * p;
  } else base = scenario === "B_HIGH_RISK" ? B_HIGH : A_NORMAL;
  const out: RiskInputs = {};
  for (const k of FACTOR_KEYS) {
    out[k] = {
      value: Math.round(clamp(base[k] + hashUnit(`${lineKey}:${k}`) * 6)),
      observedAt: now.toISOString(),
      granularity: "REALTIME",
      origin: "DEMO",
    };
  }
  return out;
}
