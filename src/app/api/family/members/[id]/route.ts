import { ApiError, handle, ok } from "@/lib/api";
import { requireUser } from "@/server/auth/guards";
import { FamilyError, OWNER_ID, removeMember } from "@/features/family/store";

type Ctx = { params: Promise<{ id: string }> };

/** O dono remove um familiar (o link de acesso dele deixa de funcionar). */
export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const session = await requireUser();
  if (session.userId !== OWNER_ID) throw new ApiError(403, "FORBIDDEN", "Só quem criou a família pode remover pessoas.");
  const { id } = await params;
  try {
    removeMember(id);
  } catch (e) {
    if (e instanceof FamilyError) throw new ApiError(404, "NOT_FOUND", "Pessoa não encontrada na família.");
    throw e;
  }
  return ok({ removed: true });
});
