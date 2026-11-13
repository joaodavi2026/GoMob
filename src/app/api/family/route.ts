import { networkInterfaces } from "node:os";
import { handle, ok } from "@/lib/api";
import { requireUser } from "@/server/auth/guards";
import { OPEN_SESSION } from "@/server/auth/session";
import { MAX_MEMBERS, OWNER_ID, getFamily, listShares, memberUserId } from "@/features/family/store";

export const dynamic = "force-dynamic";

/** Endereços desta máquina na rede local: servem para o link de convite abrir no celular dos amigos. */
function lanOrigins(req: Request): string[] {
  const url = new URL(req.url);
  const port = url.port ? `:${url.port}` : "";
  const out: string[] = [];
  try {
    for (const list of Object.values(networkInterfaces())) {
      for (const i of list ?? []) if (i.family === "IPv4" && !i.internal) out.push(`${url.protocol}//${i.address}${port}`);
    }
  } catch {
    // sem acesso às interfaces de rede
  }
  return out.slice(0, 3);
}

export const GET = handle(async (req: Request) => {
  const session = await requireUser();
  const isOwner = session.userId === OWNER_ID;
  const fam = getFamily();
  return ok(
    {
      me: { id: session.userId, name: session.name, isOwner },
      owner: { id: OWNER_ID, name: OPEN_SESSION.name },
      members: fam.members.map((m) => ({ id: m.id, userId: memberUserId(m.id), name: m.name, joinedAt: m.joinedAt, code: isOwner ? m.code : undefined })),
      invites: isOwner ? fam.invites : [],
      max: MAX_MEMBERS,
      shares: listShares(),
      lanOrigins: isOwner ? lanOrigins(req) : [],
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
