import { fail, handle, ok } from "@/lib/api";
import { requireUser } from "@/server/auth/guards";
import { VehicleIdSchema } from "@/server/transit/ids";
import { getVehicle } from "@/server/transit/service";

export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const id = VehicleIdSchema.parse((await ctx.params).id);
  const vehicle = await getVehicle(id);
  if (!vehicle) return fail(404, "NOT_FOUND", "Vehicle not found or its last position is too old.");
  return ok({ vehicle }, { headers: { "Cache-Control": "private, no-store" } });
});
