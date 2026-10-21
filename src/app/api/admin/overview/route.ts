import { handle, ok } from "@/lib/api";
import { requireAdmin } from "@/server/auth/guards";
import { db } from "@/server/db";
import { loadOverview } from "@/features/admin/overview-service";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requireAdmin();
  return ok(await loadOverview(db));
});
