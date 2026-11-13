import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireUser } from "@/server/auth/guards";
import { getStopArrivals } from "@/features/network/arrivals";
import { gtfs, nearestStops } from "@/features/network/server";

export const dynamic = "force-dynamic";

const schema = z.object({ lat: z.coerce.number().min(-90).max(90), lon: z.coerce.number().min(-180).max(180) });

/** Pontos ao redor com as próximas chegadas (os 4 pontos de ônibus mais próximos). */
export const GET = handle(async (req: Request) => {
  await requireUser();
  const q = new URL(req.url).searchParams;
  const { lat, lon } = schema.parse({ lat: q.get("lat"), lon: q.get("lon") });
  const { net } = gtfs();
  const near = nearestStops(lat, lon, 4, 1200, true);
  const stops = await Promise.all(
    near.map(async (n) => {
      const data = await getStopArrivals(net.stops[n.index][0]).catch(() => null);
      return data ? { ...data, meters: Math.round(n.meters) } : null;
    }),
  );
  return ok({ stops: stops.filter((s) => s !== null) }, { headers: { "Cache-Control": "private, no-store" } });
});
