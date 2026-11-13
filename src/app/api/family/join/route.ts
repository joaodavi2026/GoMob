import { cookies } from "next/headers";
import { z } from "zod";
import { ApiError, handle, ok } from "@/lib/api";
import { OPEN_SESSION } from "@/server/auth/session";
import { FamilyError, MEMBER_COOKIE, inviteStatus, joinFamily } from "@/features/family/store";

export const dynamic = "force-dynamic";

const codeSchema = z.string().trim().min(4).max(12);

/** Situação do convite (para a tela /convite/CODIGO). */
export const GET = handle(async (req: Request) => {
  const code = codeSchema.parse(new URL(req.url).searchParams.get("code") ?? "").toUpperCase();
  return ok({ status: inviteStatus(code), ownerName: OPEN_SESSION.name });
});

/** Entra na família: só o nome, sem senha. O aparelho passa a usar o perfil do familiar. */
export const POST = handle(async (req: Request) => {
  const body = z
    .object({ code: codeSchema, name: z.string().trim().min(2, "Digite seu nome.").max(30).optional() })
    .parse(await req.json().catch(() => ({})));
  const code = body.code.toUpperCase();
  const status = inviteStatus(code);
  if (status.kind === "NEW" && !body.name) throw new ApiError(400, "NAME_REQUIRED", "Digite seu nome para entrar.");
  try {
    const member = joinFamily(code, body.name ?? "");
    (await cookies()).set(MEMBER_COOKIE, member.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(req.url).protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return ok({ member: { id: member.id, name: member.name } });
  } catch (e) {
    if (e instanceof FamilyError) {
      if (e.reason === "FULL") throw new ApiError(409, "FULL", "Esta família já está completa.");
      throw new ApiError(404, "INVALID_CODE", "Este convite não vale mais. Peça um novo link.");
    }
    throw e;
  }
});
