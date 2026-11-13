import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireUser } from "@/server/auth/guards";
import { answer } from "@/features/assistant/brain";

export const dynamic = "force-dynamic";

const place = z.object({ label: z.string().max(120), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) });
const schema = z.object({
  message: z.string().trim().min(1).max(300),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  line: z.string().max(16).optional(),
  expect: z.object({ kind: z.literal("origin"), destination: place }).optional(),
});

/** Pergunta ao Gobi. A resposta é montada só com dados do app (GTFS, Olho Vivo, rotas, lotação). */
export const POST = handle(async (req: Request) => {
  await requireUser();
  const body = schema.parse(await req.json().catch(() => ({})));
  try {
    return ok({ reply: await answer(body) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return ok({ reply: { text: "Tive um problema para buscar esses dados agora. Tente de novo em instantes." } });
  }
});
