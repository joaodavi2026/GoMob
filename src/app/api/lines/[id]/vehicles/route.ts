import { handle, ok } from "@/lib/api";
import { requireUser } from "@/server/auth/guards";
import { LineIdSchema } from "@/server/transit/ids";
import { getVehicles } from "@/server/transit/service";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const id = LineIdSchema.parse((await ctx.params).id);
  return ok(await getVehicles(id), { headers: { "Cache-Control": "private, no-store" } });
});
