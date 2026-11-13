import { cookies } from "next/headers";
import { handle, ok } from "@/lib/api";
import { MEMBER_COOKIE, memberByToken, removeMember } from "@/features/family/store";

export const dynamic = "force-dynamic";

/** O familiar sai da família neste aparelho, que volta a usar o usuário aberto. */
export const POST = handle(async () => {
  const jar = await cookies();
  const member = memberByToken(jar.get(MEMBER_COOKIE)?.value);
  if (member) removeMember(member.id);
  jar.delete(MEMBER_COOKIE);
  return ok({ left: true });
});
