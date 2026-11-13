import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireUser } from "@/server/auth/guards";
import { clearShare, setShare } from "@/features/family/store";

export const dynamic = "force-dynamic";

const lat = z.number().min(-90).max(90);
const lon = z.number().min(-180).max(180);
const schema = z.object({
  origin: z.string().trim().max(120),
  destination: z.string().trim().max(120),
  lines: z.array(z.string().max(16)).max(4),
  title: z.string().max(160),
  detail: z.string().max(200),
  minutes: z.number().min(0).max(600),
  arrived: z.boolean(),
  pos: z.tuple([lat, lon]).nullable(),
  dest: z.tuple([lat, lon]),
  path: z.array(z.tuple([lon, lat])).max(160),
});

/** Atualiza o trajeto que a pessoa está compartilhando com a família (chamado pelo modo em trajeto). */
export const PUT = handle(async (req: Request) => {
  const session = await requireUser();
  const body = schema.parse(await req.json().catch(() => ({})));
  const now = new Date().toISOString();
  setShare({ ...body, userId: session.userId, name: session.name, startedAt: now, updatedAt: now });
  return ok({ shared: true });
});

/** Encerramento enviado por sendBeacon (que só faz POST) quando a pessoa fecha a aba durante o trajeto. */
export const POST = handle(async () => {
  const session = await requireUser();
  clearShare(session.userId);
  return ok({ shared: false });
});

export const DELETE = handle(async () => {
  const session = await requireUser();
  clearShare(session.userId);
  return ok({ shared: false });
});
