import { handle, ok } from "@/lib/api";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { isDbAvailable } from "@/server/db/available";
import { loadLiveOverview } from "@/features/admin/live-overview";
import { loadOverview } from "@/features/admin/overview-service";

export const dynamic = "force-dynamic";

/** Com banco: histórico gravado. Sem banco: os mesmos indicadores a partir dos dados ao vivo. */
export const GET = handle(async () => {
  await requireAdmin();
  if (!(await isDbAvailable())) return ok(await loadLiveOverview());
  return ok(await loadOverview(db));
});
