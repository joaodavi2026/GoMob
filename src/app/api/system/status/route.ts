import { handle, ok } from "@/lib/api";
import { getSystemStatus } from "@/server/transit/service";

export const dynamic = "force-dynamic";

/** Público: não expõe segredos (apenas se está configurado, estado e horários). */
export const GET = handle(async () => {
  return ok(await getSystemStatus(), { headers: { "Cache-Control": "public, max-age=0, s-maxage=15, stale-while-revalidate=30" } });
});
