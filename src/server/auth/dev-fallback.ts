import bcrypt from "bcryptjs";
import { demoUsers } from "../../../prisma/demo-users";
import type { UserRecord } from "./login";

/**
 * Fallback de DESENVOLVIMENTO: permite entrar com as contas demo quando não há banco.
 * Só deve ser chamado quando NODE_ENV === "development".
 */
export async function findDevDemoUser(email: string): Promise<UserRecord | null> {
  const u = demoUsers.find((d) => d.email === email);
  if (!u) return null;
  return { id: `dev-${u.role.toLowerCase()}-${u.email}`, name: u.name, email: u.email, role: u.role, passwordHash: await bcrypt.hash(u.password, 8) };
}
