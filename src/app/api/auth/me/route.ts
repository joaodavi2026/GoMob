import { handle, ok } from "@/lib/api";
import { getSession } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const session = await getSession();
  return ok({ user: session ? { id: session.userId, name: session.name, role: session.role } : null });
});
