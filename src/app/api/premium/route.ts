import { z } from "zod";
import { ApiError, handle, ok } from "@/lib/api";
import { requireUser } from "@/server/auth/guards";
import { OPEN_SESSION } from "@/server/auth/session";
import { OWNER_ID } from "@/features/family/store";
import { CARD_BRANDS, PRICE_CENTS, cancel, getPlanState, subscribe } from "@/features/premium/plan";

export const dynamic = "force-dynamic";

/** Plano simulado. Quem assina é o dono da família; os familiares herdam o Premium. */
function view(isOwner: boolean) {
  const s = getPlanState();
  return {
    plan: s.plan,
    card: isOwner ? s.card : null,
    events: isOwner ? s.events : [],
    priceCents: PRICE_CENTS,
    canManage: isOwner,
    ownerName: OPEN_SESSION.name,
  };
}

const cardSchema = z
  .object({
    brand: z.enum(CARD_BRANDS),
    last4: z.string().regex(/^[0-9]{4}$/),
    exp: z.string().regex(/^(0[1-9]|1[0-2])\/[0-9]{2}$/),
    holder: z.string().trim().min(2).max(40),
  })
  .strict();
// só dados mascarados são aceitos: qualquer campo a mais (número completo, CVV) é rejeitado
const subscribeSchema = z.object({ card: cardSchema.optional(), verified: z.literal(true) }).strict();

function ownerOnly(userId: string) {
  if (userId !== OWNER_ID) throw new ApiError(403, "FORBIDDEN", `O plano da família é gerenciado por ${OPEN_SESSION.name}.`);
}

export const GET = handle(async () => {
  const session = await requireUser();
  return ok(view(session.userId === OWNER_ID), { headers: { "Cache-Control": "private, no-store" } });
});

export const POST = handle(async (req: Request) => {
  const session = await requireUser();
  ownerOnly(session.userId);
  const body = subscribeSchema.parse(await req.json().catch(() => ({})));
  if (!body.card && !getPlanState().card) throw new ApiError(400, "NO_CARD", "Cadastre um cartão para assinar.");
  subscribe(body.card);
  return ok(view(true));
});

export const DELETE = handle(async (req: Request) => {
  const session = await requireUser();
  ownerOnly(session.userId);
  z.object({ verified: z.literal(true) }).parse(await req.json().catch(() => ({})));
  cancel();
  return ok(view(true));
});
