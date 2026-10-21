import { handle, ok } from "@/lib/api";
import { requireUser } from "@/server/auth/guards";
import { favoriteUpdateSchema } from "@/features/favorites/schemas";
import { deleteFavorite, updateFavorite } from "@/features/favorites/service";
import { prismaFavoriteRepo } from "@/features/favorites/prisma-repo";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const session = await requireUser();
  const { id } = await params;
  const body = favoriteUpdateSchema.parse(await req.json().catch(() => ({})));
  return ok({ favorite: await updateFavorite(prismaFavoriteRepo, session.userId, id, body) });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const session = await requireUser();
  const { id } = await params;
  return ok({ favorite: await deleteFavorite(prismaFavoriteRepo, session.userId, id) });
});
