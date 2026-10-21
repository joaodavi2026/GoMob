import { z } from "zod";

export const WEIGHT_KEYS = ["demand", "headway", "delay", "operations"] as const;
export type WeightKey = (typeof WEIGHT_KEYS)[number];
export type Weights = Record<WeightKey, number>;

export const WEIGHTS_SETTING_KEY = "intelligence.weights";
export const WEIGHT_TOLERANCE = 1e-6;

/** Hipótese inicial de demonstração acadêmica (spec 10.3) — não é parâmetro cientificamente validado. */
export const DEFAULT_WEIGHTS: Weights = { demand: 0.35, headway: 0.3, delay: 0.2, operations: 0.15 };

export const FACTOR_DEFINITIONS: { key: WeightKey; code: string; label: string; description: string }[] = [
  { key: "demand", code: "D", label: "Historical Demand", description: "Historical demand indicator, using only the granularity actually available. Daily aggregates do not show hourly peaks." },
  { key: "headway", code: "I", label: "Headway Irregularity", description: "Irregularity between buses compared with expected intervals, when a reliable reference exists." },
  { key: "delay", code: "A", label: "Delay Indicator", description: "Operational delay, calculated only when valid time references exist." },
  { key: "operations", code: "O", label: "Operational Irregularity", description: "Uneven vehicle distribution (spacing, bunching) inferred from operational signals." },
];

export function sumWeights(w: Weights): number {
  return WEIGHT_KEYS.reduce((acc, k) => acc + w[k], 0);
}

const weight = z.number().finite().min(0).max(1);
export const weightsSchema = z
  .object({ demand: weight, headway: weight, delay: weight, operations: weight })
  .strict()
  .superRefine((w, ctx) => {
    const sum = sumWeights(w);
    if (Math.abs(sum - 1) > WEIGHT_TOLERANCE) {
      ctx.addIssue({ code: "custom", message: `Weights must sum to 1 (current sum: ${sum.toFixed(4)}).`, path: [] });
    }
  });

export type WeightsValidation = { ok: true; weights: Weights } | { ok: false; error: string };

export function validateWeights(input: unknown): WeightsValidation {
  const parsed = weightsSchema.safeParse(input);
  if (parsed.success) return { ok: true, weights: parsed.data };
  return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid weights." };
}

/** Lê pesos persistidos; valor inválido/ausente cai nos padrões. */
export function weightsFromSetting(value: unknown): Weights {
  const v = validateWeights(value);
  return v.ok ? v.weights : { ...DEFAULT_WEIGHTS };
}

export function diffWeights(before: Weights, after: Weights): Partial<Record<WeightKey, { from: number; to: number }>> {
  const out: Partial<Record<WeightKey, { from: number; to: number }>> = {};
  for (const k of WEIGHT_KEYS) if (Math.abs(before[k] - after[k]) > WEIGHT_TOLERANCE) out[k] = { from: before[k], to: after[k] };
  return out;
}

export type SettingsDb = {
  appSetting: {
    findUnique(args: { where: { key: string } }): Promise<{ value: unknown } | null>;
    upsert(args: { where: { key: string }; create: { key: string; value: never }; update: { value: never } }): Promise<unknown>;
  };
  auditLog: { create(args: { data: { actorId: string; action: string; entityType: string; entityId: string } }): Promise<unknown> };
};

export class WeightsError extends Error {
  constructor(
    public code: "NOT_DEMO_MODE" | "INVALID",
    message: string,
  ) {
    super(message);
  }
}

export async function loadWeights(db: Pick<SettingsDb, "appSetting">): Promise<Weights> {
  try {
    const row = await db.appSetting.findUnique({ where: { key: WEIGHTS_SETTING_KEY } });
    return weightsFromSetting(row?.value);
  } catch {
    return { ...DEFAULT_WEIGHTS };
  }
}

/** Salva pesos (somente DEMO MODE) e registra no AuditLog. DB injetado. */
export async function saveWeights(
  db: SettingsDb,
  input: unknown,
  actorId: string,
  mode: "LIVE" | "DEMO",
): Promise<{ weights: Weights; changed: ReturnType<typeof diffWeights> }> {
  if (mode !== "DEMO") throw new WeightsError("NOT_DEMO_MODE", "Weights can only be adjusted in DEMO MODE.");
  const v = validateWeights(input);
  if (!v.ok) throw new WeightsError("INVALID", v.error);
  const before = await loadWeights(db);
  const changed = diffWeights(before, v.weights);
  const value = v.weights as never;
  await db.appSetting.upsert({ where: { key: WEIGHTS_SETTING_KEY }, create: { key: WEIGHTS_SETTING_KEY, value }, update: { value } });
  await db.auditLog.create({ data: { actorId, action: "INTELLIGENCE_WEIGHTS_UPDATED", entityType: "AppSetting", entityId: WEIGHTS_SETTING_KEY } });
  return { weights: v.weights, changed };
}

/** Modo operacional: LIVE só quando há token SPTrans configurado (nunca expõe o valor). */
export function operatingMode(env: Record<string, string | undefined> = process.env): "LIVE" | "DEMO" {
  return env.SPTRANS_API_TOKEN && env.SPTRANS_API_TOKEN.trim() ? "LIVE" : "DEMO";
}
