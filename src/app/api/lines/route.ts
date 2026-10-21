import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireUser } from "@/server/auth/guards";
import { getLines } from "@/server/transit/service";

export const dynamic = "force-dynamic";

const Query = z.object({ search: z.string().trim().max(60).optional() });

export const GET = handle(async (req: Request) => {
  await requireUser();
  const { search } = Query.parse({ search: new URL(req.url).searchParams.get("search") ?? undefined });
  const data = await getLines({ search });
  return ok(data, { headers: { "Cache-Control": "private, max-age=60" } });
});
