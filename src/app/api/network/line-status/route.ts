import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireUser } from "@/server/auth/guards";
import { getFleetSnapshot } from "@/server/sptrans/fleet";

export const dynamic = "force-dynamic";

const Query = z.object({
  code: z.string().trim().min(1).max(16),
  dir: z.coerce.number().int().min(0).max(1).default(0),
});

/**
 * Situação ao vivo de uma linha em um sentido (Olho Vivo, frota em cache):
 * quantos ônibus circulam agora e quantos estão cadastrados como acessíveis.
 */
export const GET = handle(async (req: Request) => {
  await requireUser();
  const { code, dir } = Query.parse(Object.fromEntries(new URL(req.url).searchParams));
  const fleet = await getFleetSnapshot();
  if (fleet.state !== "LIVE") return ok({ state: "UNAVAILABLE" as const, running: null, accessible: null, vehicles: [] });
  const buses = fleet.vehicles.filter((v) => v[0] === code && (v[1] === 2 ? 1 : 0) === dir);
  return ok(
    {
      state: "LIVE" as const,
      running: buses.length,
      accessible: buses.filter((v) => v[5] === 1).length,
      fetchedAt: fleet.fetchedAt,
      // posições para o modo "em trajeto": [lat, lon, prefixo, acessível, idade em s]
      vehicles: buses.map((v) => [v[2], v[3], v[4], v[5], v[6]] as const),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
