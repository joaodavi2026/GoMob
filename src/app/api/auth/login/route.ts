import { handle, ok } from "@/lib/api";
import { db } from "@/server/db";
import { setSessionCookie } from "@/server/auth/session";
import { authenticate } from "@/server/auth/login";
import { createRateLimiter } from "@/server/auth/rate-limit";
import { loginSchema } from "@/features/auth/schemas";
import { findDevDemoUser } from "@/server/auth/dev-fallback";

// 5 tentativas / 10 min por IP+email. Em memória: ver limitação serverless em rate-limit.ts.
const limiter = createRateLimiter({ max: 5, windowMs: 10 * 60 * 1000 });

export const POST = handle(async (req: Request) => {
  const body = loginSchema.parse(await req.json().catch(() => ({})));
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { session, redirectTo } = await authenticate(
    body,
    {
      limiter,
      findUserByEmail: async (email) => {
        try {
          return await db.user.findUnique({ where: { email } });
        } catch (e) {
          // Somente em `next dev` e sem banco: usa as contas demo locais (nunca em produção).
          if (process.env.NODE_ENV === "development") return findDevDemoUser(email);
          throw e;
        }
      },
    },
    `${ip}|${body.email}`,
  );
  await setSessionCookie(session);
  await db.auditLog
    .create({ data: { actorId: session.userId, action: "LOGIN", entityType: "User", entityId: session.userId } })
    .catch(() => undefined);
  return ok({ user: { id: session.userId, name: session.name, role: session.role }, redirectTo });
});
