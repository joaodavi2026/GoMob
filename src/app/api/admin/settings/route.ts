import type { NextRequest } from "next/server";
import { ApiError, handle, ok } from "@/lib/api";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { DEFAULT_WEIGHTS, loadWeights, operatingMode, saveWeights, WeightsError, type SettingsDb } from "@/features/admin/weights";

export const dynamic = "force-dynamic";

const settingsDb = db as unknown as SettingsDb;

export const GET = handle(async () => {
  await requireAdmin();
  const mode = operatingMode();
  return ok({
    weights: await loadWeights(settingsDb),
    defaults: DEFAULT_WEIGHTS,
    mode,
    editable: mode === "DEMO",
    disclaimer: "Weights are academic-demonstration hypotheses, not scientifically validated parameters. Adjusting them is not AI training.",
  });
});

export const PUT = handle(async (req: NextRequest) => {
  const session = await requireAdmin();
  const body = await req.json().catch(() => null);
  const input = body && typeof body === "object" && "weights" in body ? (body as { weights: unknown }).weights : body;
  try {
    const result = await saveWeights(settingsDb, input, session.userId, operatingMode());
    return ok({ weights: result.weights, changed: result.changed });
  } catch (e) {
    if (e instanceof WeightsError) throw new ApiError(e.code === "NOT_DEMO_MODE" ? 403 : 400, e.code, e.message);
    throw new ApiError(503, "DB_UNAVAILABLE", "Database unavailable. The change was not saved.");
  }
});
