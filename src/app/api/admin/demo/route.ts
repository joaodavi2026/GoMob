import { ZodError } from "zod";
import type { NextRequest } from "next/server";
import { ApiError, handle, ok } from "@/lib/api";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getScenario, resetScenario, setScenario } from "@/server/demo/scenario";
import { applyScenarioCommand, toScenarioView, SCENARIOS } from "@/features/admin/scenario";

export const dynamic = "force-dynamic";

async function actorName(id: string | null): Promise<string | null> {
  if (!id) return null;
  try {
    return (await db.user.findUnique({ where: { id }, select: { name: true } }))?.name ?? null;
  } catch {
    return null;
  }
}

async function view() {
  const state = await getScenario();
  return { state: toScenarioView(state, await actorName(state.setBy)), scenarios: SCENARIOS };
}

export const GET = handle(async () => {
  await requireAdmin();
  return ok(await view());
});

/** POST { scenario } executa um cenário; POST { reset: true } restaura o padrão. */
export const POST = handle(async (req: NextRequest) => {
  const session = await requireAdmin();
  const body = await req.json().catch(() => null);
  try {
    await applyScenarioCommand({ setScenario, resetScenario }, body, session.userId);
  } catch (e) {
    if (e instanceof ZodError) throw e;
    throw new ApiError(503, "DB_UNAVAILABLE", "Database unavailable. The scenario was not saved.");
  }
  return ok(await view());
});

export const DELETE = handle(async () => {
  const session = await requireAdmin();
  try {
    await resetScenario(session.userId);
  } catch {
    throw new ApiError(503, "DB_UNAVAILABLE", "Database unavailable. The demo was not reset.");
  }
  return ok(await view());
});
