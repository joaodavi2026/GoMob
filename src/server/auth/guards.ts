import { getSession, type SessionPayload } from "./session";
import { ApiError } from "@/lib/api";

export async function requireUser(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return session;
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireUser();
  if (session.role !== "ADMIN") throw new ApiError(403, "FORBIDDEN", "Administrator access required.");
  return session;
}
