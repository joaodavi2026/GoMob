import { handle, ok } from "@/lib/api";
import { requireUser } from "@/server/auth/guards";
import { getFleetSnapshot } from "@/server/sptrans/fleet";

export const dynamic = "force-dynamic";

/** Posição de toda a frota SPTrans (Olho Vivo GET /Posicao), em formato compacto. */
export const GET = handle(async () => {
  await requireUser();
  const snap = await getFleetSnapshot();
  return ok(snap, { headers: { "Cache-Control": "private, no-store" } });
});
