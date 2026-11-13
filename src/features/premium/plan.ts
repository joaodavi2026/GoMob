import { jsonStore } from "@/server/store/local";

/**
 * Plano Premium SIMULADO (apresentação acadêmica): não há cobrança nem operadora de pagamento.
 * Do cartão, só ficam bandeira, 4 últimos dígitos, validade e nome. O número completo e o CVV
 * nunca saem do navegador nem são gravados.
 */
export const PRICE_CENTS = 990;
export const CARD_BRANDS = ["Mastercard", "Visa", "Elo", "American Express", "Hipercard", "Cartão"] as const;
export type CardBrand = (typeof CARD_BRANDS)[number];
export type SavedCard = { brand: CardBrand; last4: string; exp: string; holder: string };
export type PlanEvent = { at: string; type: "SUBSCRIBED" | "CANCELED"; amountCents?: number; card?: string };
export type Plan = { status: "FREE" | "PREMIUM"; since?: string; renewsAt?: string; canceledAt?: string };
type Doc = { plan: Plan; card: SavedCard | null; events: PlanEvent[] };

/** Cartão de teste já cadastrado (dados mascarados) para a demonstração da compra. */
const DEMO_CARD: SavedCard = { brand: "Mastercard", last4: "7301", exp: "03/28", holder: "JOÃO DAVI GO MOB" };

const store = jsonStore<Doc>("premium", () => ({ plan: { status: "FREE" }, card: { ...DEMO_CARD }, events: [] }));

export function getPlanState() {
  const d = store.read();
  return { plan: d.plan, card: d.card, events: d.events.slice(-10).reverse() };
}

export const isPremium = () => store.read().plan.status === "PREMIUM";

export function subscribe(card: SavedCard | undefined, now = new Date()) {
  return store.update((d) => {
    if (card) d.card = card;
    if (!d.card) throw new Error("NO_CARD");
    const renews = new Date(now);
    renews.setMonth(renews.getMonth() + 1);
    d.plan = { status: "PREMIUM", since: now.toISOString(), renewsAt: renews.toISOString() };
    d.events.push({ at: now.toISOString(), type: "SUBSCRIBED", amountCents: PRICE_CENTS, card: `${d.card.brand} •••• ${d.card.last4}` });
    return d.plan;
  });
}

export function cancel(now = new Date()) {
  return store.update((d) => {
    d.plan = { status: "FREE", canceledAt: now.toISOString() };
    d.events.push({ at: now.toISOString(), type: "CANCELED" });
    return d.plan;
  });
}

export function removeCard() {
  store.update((d) => {
    d.card = null;
  });
}
