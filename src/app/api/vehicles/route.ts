import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { MAX_LINES_PER_VEHICLES_REQUEST } from "@/config/transit";
import { requireUser } from "@/server/auth/guards";
import { LineIdSchema } from "@/server/transit/ids";
import { aggregateState, getVehicles } from "@/server/transit/service";

export const dynamic = "force-dynamic";

const Query = z.object({
  lineIds: z
    .string()
    .max(200)
    .transform((s) => [...new Set(s.split(",").map((x) => x.trim()).filter(Boolean))])
    .pipe(z.array(LineIdSchema).min(1).max(MAX_LINES_PER_VEHICLES_REQUEST)),
});

export const GET = handle(async (req: Request) => {
  await requireUser();
  const { lineIds } = Query.parse({ lineIds: new URL(req.url).searchParams.get("lineIds") ?? "" });
  const results = await Promise.all(lineIds.map((id) => getVehicles(id)));
  const sources = new Set(results.map((r) => r.source));
  return ok(
    {
      vehicles: results.flatMap((r) => r.vehicles),
      state: aggregateState(results.map((r) => r.state)),
      fetchedAt: new Date().toISOString(),
      source: sources.size === 1 ? [...sources][0] : "DEMO",
      lines: lineIds.map((lineId, i) => ({ lineId, state: results[i].state, source: results[i].source })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
