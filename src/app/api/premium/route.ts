import { cookies } from "next/headers";
import { z } from "zod";
import { ApiError, handle, ok } from "@/lib/api";
import { requireUser } from "@/server/auth/guards";
import { OPEN_SESSION } from "@/server/auth/session";
import { OWNER_ID } from "@/features/family/store";
import { CARD_BRANDS, PRICE_CENTS, adoptPlan, cancel, getPlanState, subscribe } from "@/features/premium/plan";
import { PLAN_COOKIE, PLAN_COOKIE_MAX_AGE, decodeSnapshot, encodeSnapshot, reconcile, snapshotOf } from "@/features/premium/plan-cookie";

export const dynamic = "force-dynamic";

/**
 * Plano simulado. Quem assina é o dono da família; os familiares herdam o Premium.
 * O estado também fica em um cookie assinado no aparelho do dono: em hospedagem sem disco gravável
 * o servidor esquece o plano entre uma requisição e outra, e o cookie traz o estado mais recente de volta.
 */
async function current(isOwner: boolean) {
  const s = getPlanState();
  if (!isOwner) return s;
  const r = reconcile(s, decodeSnapshot((await cookies()).get(PLAN_COOKIE)?.value));
  if (r.fromCookie) adoptPlan(r.plan, r.card); // esta instância do servidor estava desatualizada
  return { ...s, plan: r.plan, card: r.card };
}

async function remember(req: Request) {
  const s = getPlanState();
  (await cookies()).set(PLAN_COOKIE, encodeSnapshot(snapshotOf(s.plan, s.card)), {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(req.url).protocol === "https:",
    path: "/",
    maxAge: PLAN_COOKIE_MAX_AGE,
  });
}

function view(s: Awaited<ReturnType<typeof current>>, isOwner: boolean) {
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
  const isOwner = session.userId === OWNER_ID;
  return ok(view(await current(isOwner), isOwner), { headers: { "Cache-Control": "private, no-store" } });
});

export const POST = handle(async (req: Request) => {
  const session = await requireUser();
  ownerOnly(session.userId);
  const body = subscribeSchema.parse(await req.json().catch(() => ({})));
  const before = await current(true); // traz o cartão guardado no aparelho, se o servidor o esqueceu
  if (!body.card && !before.card) throw new ApiError(400, "NO_CARD", "Cadastre um cartão para assinar.");
  subscribe(body.card);
  await remember(req);
  return ok(view(getPlanState(), true));
});

export const DELETE = handle(async (req: Request) => {
  const session = await requireUser();
  ownerOnly(session.userId);
  z.object({ verified: z.literal(true) }).parse(await req.json().catch(() => ({})));
  await current(true);
  cancel();
  await remember(req);
  return ok(view(getPlanState(), true));
});
