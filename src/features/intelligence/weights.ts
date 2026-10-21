/** Pesos do GoMob Intelligence. São hipóteses de demonstração acadêmica, não parâmetros validados. */
export type RiskWeights = { demand: number; headway: number; delay: number; operations: number };

export const WEIGHTS_SETTING_KEY = "intelligence.weights";

export const DEFAULT_WEIGHTS: RiskWeights = { demand: 0.35, headway: 0.3, delay: 0.2, operations: 0.15 };

const KEYS = ["demand", "headway", "delay", "operations"] as const;

export function weightsAreValid(w: unknown): w is RiskWeights {
  if (!w || typeof w !== "object") return false;
  const o = w as Record<string, unknown>;
  let sum = 0;
  for (const k of KEYS) {
    const v = o[k];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) return false;
    sum += v;
  }
  return Math.abs(sum - 1) <= 0.001;
}

/** Valida o valor lido de AppSetting; se inválido (ou ausente), usa o padrão. */
export function parseWeights(raw: unknown): RiskWeights {
  return weightsAreValid(raw) ? { ...(raw as RiskWeights) } : { ...DEFAULT_WEIGHTS };
}
