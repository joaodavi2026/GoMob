import bcrypt from "bcryptjs";
import { ApiError } from "@/lib/api";
import { homeForRole, type Role } from "./roles";
import type { SessionPayload } from "./session";
import type { RateLimiter } from "./rate-limit";

export type UserRecord = { id: string; name: string; email: string; passwordHash: string; role: Role };

export type LoginDeps = {
  findUserByEmail: (email: string) => Promise<UserRecord | null>;
  limiter?: RateLimiter;
  compare?: (plain: string, hash: string) => Promise<boolean>;
};

// Hash válido de uma senha irrelevante: garante custo bcrypt mesmo quando o usuário não existe.
const DUMMY_HASH = "$2b$10$h6Tv.l1NCdHuUT34ATCKQOyiCs9g5OGHTYQE2emKH.MrU7a.r6QT6";

export const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";

export type LoginResult = { session: SessionPayload; redirectTo: string };

export async function authenticate(
  input: { email: string; password: string },
  deps: LoginDeps,
  rateKey: string = input.email,
): Promise<LoginResult> {
  const compare = deps.compare ?? bcrypt.compare;
  if (deps.limiter) {
    const r = deps.limiter.check(rateKey);
    if (!r.allowed) {
      throw new ApiError(429, "RATE_LIMITED", `Too many attempts. Try again in ${r.retryAfterSeconds}s.`);
    }
  }
  const user = await deps.findUserByEmail(input.email);
  const valid = await compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) throw new ApiError(401, "INVALID_CREDENTIALS", INVALID_CREDENTIALS_MESSAGE);
  deps.limiter?.reset(rateKey);
  return {
    session: { userId: user.id, role: user.role, name: user.name },
    redirectTo: homeForRole(user.role),
  };
}
