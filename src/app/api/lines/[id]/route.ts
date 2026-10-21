import { fail, handle, ok } from "@/lib/api";
import { requireUser } from "@/server/auth/guards";
import { LineIdSchema } from "@/server/transit/ids";
import { getLine, getLinePath } from "@/server/transit/service";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const id = LineIdSchema.parse((await ctx.params).id);
  const line = await getLine(id);
  if (!line) return fail(404, "NOT_FOUND", "Line not found.");
  // `path` ([lng,lat][]) é extra, usado para destacar o trajeto no mapa.
  const path = await getLinePath(id);
  return ok({ line, path }, { headers: { "Cache-Control": "private, max-age=60" } });
});
