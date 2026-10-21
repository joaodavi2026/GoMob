import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireUser } from "@/server/auth/guards";
import { getAlerts } from "@/features/alerts/service";

export const dynamic = "force-dynamic";

const querySchema = z.object({ lineId: z.string().trim().min(1).max(40).optional() });

export const GET = handle(async (req: Request) => {
  await requireUser();
  const sp = new URL(req.url).searchParams;
  const { lineId } = querySchema.parse({ lineId: sp.get("lineId") || undefined });
  const alerts = await getAlerts({ lineId });
  return ok({ alerts }, { headers: { "Cache-Control": "private, no-store" } });
});
