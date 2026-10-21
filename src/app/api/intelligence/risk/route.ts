import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireUser } from "@/server/auth/guards";
import { getLineRisk } from "@/features/intelligence/service";

export const dynamic = "force-dynamic";

const querySchema = z.object({ lineId: z.string().trim().min(1).max(40) });

export const GET = handle(async (req: Request) => {
  await requireUser();
  const { searchParams } = new URL(req.url);
  const { lineId } = querySchema.parse({ lineId: searchParams.get("lineId") ?? "" });
  const risk = await getLineRisk(lineId);
  return ok({ risk }, { headers: { "Cache-Control": "private, no-store" } });
});
