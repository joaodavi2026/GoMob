import { handle, ok } from "@/lib/api";
import { requireUser } from "@/server/auth/guards";
import { LineIdSchema } from "@/server/transit/ids";
import { getStops } from "@/server/transit/service";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const id = LineIdSchema.parse((await ctx.params).id);
  return ok(await getStops(id), { headers: { "Cache-Control": "private, max-age=300" } });
});
