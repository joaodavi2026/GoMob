import { handle, ok } from "@/lib/api";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/guards";
import { setSessionCookie } from "@/server/auth/session";
import { profileSchema } from "@/features/auth/schemas";

export const PATCH = handle(async (req: Request) => {
  const session = await requireUser();
  const { name } = profileSchema.parse(await req.json().catch(() => ({})));
  const user = await db.user.update({
    where: { id: session.userId },
    data: { name },
    select: { id: true, name: true, role: true },
  });
  await setSessionCookie({ userId: user.id, role: user.role, name: user.name });
  return ok({ user });
});
