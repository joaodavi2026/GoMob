import { handle, ok } from "@/lib/api";
import { requireUser } from "@/server/auth/guards";
import { predictQuerySchema } from "@/features/predict/schema";
import { getPrediction } from "@/features/predict/service";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await requireUser();
  const sp = new URL(req.url).searchParams;
  const q = predictQuerySchema.parse({
    lineId: sp.get("lineId") ?? "",
    date: sp.get("date") || undefined,
    weekday: sp.get("weekday") || undefined,
    time: sp.get("time") ?? "",
    direction: sp.get("direction") || undefined,
  });
  const { line, ...prediction } = await getPrediction(q);
  return ok({ prediction, line }, { headers: { "Cache-Control": "private, no-store" } });
});
