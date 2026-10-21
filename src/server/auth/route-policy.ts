import { homeForRole, type Role } from "./roles";

export type AccessDecision = { action: "next" } | { action: "redirect"; to: string };

const PUBLIC_PATHS = ["/"];

/** Decide acesso a uma rota de página (função pura, usada por src/proxy.ts). */
export function decideAccess(pathname: string, session: { role: Role } | null): AccessDecision {
  if (pathname === "/login") {
    return session ? { action: "redirect", to: homeForRole(session.role) } : { action: "next" };
  }
  if (PUBLIC_PATHS.includes(pathname)) return { action: "next" };

  if (!session) return { action: "redirect", to: "/login" };

  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  if (isAdminArea && session.role !== "ADMIN") return { action: "redirect", to: "/home" };
  return { action: "next" };
}
