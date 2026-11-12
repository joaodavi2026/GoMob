import { getSession, type SessionPayload } from "./session";
import { ApiError } from "@/lib/api";

export async function requireUser(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new ApiError(401, "UNAUTHENTICATED", "Sessão indisponível. Recarregue a página e tente novamente.");
  return session;
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireUser();
  if (session.role !== "ADMIN") throw new ApiError(403, "FORBIDDEN", "Acesso de administrador necessário.");
  return session;
}
