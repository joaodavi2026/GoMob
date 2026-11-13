import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireUser } from "@/server/auth/guards";
import { addActivity, clearActivity, listActivity } from "@/features/activity/store";

export const dynamic = "force-dynamic";

const ll = z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]);
const schema = z.object({
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  elapsedSec: z.number().int().min(0).max(86_400),
  plannedMin: z.number().min(0).max(600).nullable(),
  origin: z.string().trim().min(1).max(120),
  destination: z.string().trim().min(1).max(120),
  from: ll,
  to: ll,
  lines: z.array(z.string().max(16)).max(4),
  transfers: z.number().int().min(0).max(4),
  distanceM: z.number().min(0).max(200_000),
  status: z.enum(["COMPLETED", "CANCELED"]),
  mode: z.enum(["gps", "sim", "manual"]),
  path: z.array(z.tuple([z.number(), z.number()])).max(120),
});

/** Tarifa de ônibus do GTFS (uma tarifa cobre as baldeações do Bilhete Único). */
let fare: number | null | undefined;
function busFare(): number | null {
  if (fare !== undefined) return fare;
  try {
    const file = join(process.cwd(), "public", "gtfs", "highlights.json");
    const h = JSON.parse(readFileSync(/*turbopackIgnore: true*/ file, "utf8")) as { popular?: { fare?: number }[] };
    fare = h.popular?.find((p) => typeof p.fare === "number")?.fare ?? null;
  } catch {
    fare = null;
  }
  return fare;
}

export const GET = handle(async () => {
  const session = await requireUser();
  return ok({ items: listActivity(session.userId) }, { headers: { "Cache-Control": "private, no-store" } });
});

export const POST = handle(async (req: Request) => {
  const session = await requireUser();
  const body = schema.parse(await req.json().catch(() => ({})));
  const charged = body.status === "COMPLETED" && body.lines.length > 0;
  return ok({ item: addActivity(session.userId, { ...body, fare: charged ? busFare() : null }) });
});

export const DELETE = handle(async () => {
  const session = await requireUser();
  clearActivity(session.userId);
  return ok({ cleared: true });
});
