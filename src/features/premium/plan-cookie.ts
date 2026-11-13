import { createHmac, timingSafeEqual } from "node:crypto";
import type { Plan, SavedCard } from "./plan";

/**
 * Cópia do plano guardada no próprio aparelho (cookie assinado).
 *
 * Em hospedagem serverless (ex.: Vercel) o servidor não tem disco gravável e cada requisição pode cair em uma
 * instância diferente, com a memória zerada. Sem esta cópia, quem assinou o Premium voltava a aparecer como
 * "grátis" na requisição seguinte (e os anúncios reapareciam). O cookie leva o estado mais recente de volta.
 */
export const PLAN_COOKIE = "gomob_plan";
export const PLAN_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type PlanSnapshot = { status: "FREE" | "PREMIUM"; at: string; renewsAt?: string; card: SavedCard | null };

const secret = () => process.env.SESSION_SECRET || "gomob-demo-plan-cookie";
const sign = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");

export function encodeSnapshot(s: PlanSnapshot): string {
  const body = Buffer.from(JSON.stringify(s), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeSnapshot(value: string | undefined): PlanSnapshot | null {
  if (!value) return null;
  const [body, mac] = value.split(".");
  if (!body || !mac) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<PlanSnapshot>;
    if ((s.status !== "FREE" && s.status !== "PREMIUM") || typeof s.at !== "string" || Number.isNaN(Date.parse(s.at))) return null;
    const c = s.card;
    const card = c && typeof c.brand === "string" && /^\d{4}$/.test(String(c.last4)) && typeof c.exp === "string" && typeof c.holder === "string" ? c : null;
    return { status: s.status, at: s.at, renewsAt: typeof s.renewsAt === "string" ? s.renewsAt : undefined, card };
  } catch {
    return null;
  }
}

/** Quando o plano mudou pela última vez (0 = estado inicial, nunca mexido). */
export function planChangedAt(plan: Plan): number {
  const t = Date.parse((plan.status === "PREMIUM" ? plan.since : plan.canceledAt) ?? "");
  return Number.isNaN(t) ? 0 : t;
}

export function snapshotOf(plan: Plan, card: SavedCard | null): PlanSnapshot {
  const at = (plan.status === "PREMIUM" ? plan.since : plan.canceledAt) ?? new Date(0).toISOString();
  return { status: plan.status, at, renewsAt: plan.renewsAt, card };
}

/**
 * Entre o que o servidor lembra e o que o aparelho guarda, vale a mudança mais recente.
 * `fromCookie` indica que o servidor estava desatualizado e deve adotar o estado do aparelho.
 */
export function reconcile(server: { plan: Plan; card: SavedCard | null }, cookie: PlanSnapshot | null): { plan: Plan; card: SavedCard | null; fromCookie: boolean } {
  if (!cookie || Date.parse(cookie.at) <= planChangedAt(server.plan)) return { ...server, fromCookie: false };
  const plan: Plan = cookie.status === "PREMIUM" ? { status: "PREMIUM", since: cookie.at, renewsAt: cookie.renewsAt } : { status: "FREE", canceledAt: cookie.at };
  return { plan, card: cookie.card ?? server.card, fromCookie: true };
}
