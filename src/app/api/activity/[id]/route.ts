import { ApiError, handle, ok } from "@/lib/api";
import { requireUser } from "@/server/auth/guards";
import { removeActivity } from "@/features/activity/store";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const session = await requireUser();
  const { id } = await params;
  if (!removeActivity(session.userId, id)) throw new ApiError(404, "NOT_FOUND", "Trajeto não encontrado.");
  return ok({ removed: true });
});
