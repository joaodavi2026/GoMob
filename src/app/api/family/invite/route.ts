import { z } from "zod";
import { ApiError, handle, ok } from "@/lib/api";
import { requireUser } from "@/server/auth/guards";
import { FamilyError, OWNER_ID, createInvite, revokeInvite } from "@/features/family/store";

export const dynamic = "force-dynamic";

async function owner() {
  const session = await requireUser();
  if (session.userId !== OWNER_ID) throw new ApiError(403, "FORBIDDEN", "Só quem criou a família pode convidar.");
}

export const POST = handle(async () => {
  await owner();
  try {
    return ok({ invite: createInvite() });
  } catch (e) {
    if (e instanceof FamilyError && e.reason === "FULL") throw new ApiError(409, "FULL", "A família já está completa (você e mais 2 pessoas).");
    throw e;
  }
});

export const DELETE = handle(async (req: Request) => {
  await owner();
  const { code } = z.object({ code: z.string().trim().min(4).max(12) }).parse(await req.json().catch(() => ({})));
  revokeInvite(code.toUpperCase());
  return ok({ revoked: true });
});
