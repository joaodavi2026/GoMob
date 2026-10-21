import { handle, ok } from "@/lib/api";
import { requireUser } from "@/server/auth/guards";
import { favoriteCreateSchema, favoriteListQuerySchema } from "@/features/favorites/schemas";
import { createFavorite, listFavorites } from "@/features/favorites/service";
import { prismaFavoriteRepo } from "@/features/favorites/prisma-repo";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const session = await requireUser();
  const q = favoriteListQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await listFavorites(prismaFavoriteRepo, session.userId, q.page, q.pageSize));
});

export const POST = handle(async (req: Request) => {
  const session = await requireUser();
  const body = favoriteCreateSchema.parse(await req.json().catch(() => ({})));
  const favorite = await createFavorite(prismaFavoriteRepo, session.userId, body);
  return ok({ favorite }, { status: 201 });
});
