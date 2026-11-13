import { ApiError, handle, ok } from "@/lib/api";
import { requireUser } from "@/server/auth/guards";
import { getStopArrivals } from "@/features/network/arrivals";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Próximas chegadas em uma parada (previsão do Olho Vivo + horário programado do GTFS). */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  await requireUser();
  const { id } = await params;
  const data = await getStopArrivals(id.slice(0, 20));
  if (!data) throw new ApiError(404, "NOT_FOUND", "Parada não encontrada.");
  return ok(data, { headers: { "Cache-Control": "private, no-store" } });
});
