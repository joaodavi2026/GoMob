import { fail, handle, ok } from "@/lib/api";
import { requireUser } from "@/server/auth/guards";
import { routeSearchSchema, RouteProviderUnavailableError } from "@/features/routes/search";
import { searchBusRoutes } from "@/features/routes/service";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  await requireUser();
  const body = routeSearchSchema.parse(await req.json().catch(() => null));
  try {
    const data = await searchBusRoutes(body);
    return ok(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof RouteProviderUnavailableError) {
      return fail(503, "ROUTES_UNAVAILABLE", "Route search is temporarily unavailable. Please try again later.");
    }
    throw e;
  }
});
