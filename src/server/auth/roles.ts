export type Role = "USER" | "ADMIN";

export function homeForRole(role: Role): string {
  return role === "ADMIN" ? "/admin" : "/home";
}

/** Puro: true se o papel da sessão atende ao exigido. ADMIN também acessa o que é de USER. */
export function hasRole(sessionRole: Role | undefined, required: Role): boolean {
  if (!sessionRole) return false;
  return required === "USER" ? true : sessionRole === "ADMIN";
}
