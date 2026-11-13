import { beforeAll, describe, expect, it } from "vitest";
import { decodeSnapshot, encodeSnapshot, planChangedAt, reconcile, snapshotOf, type PlanSnapshot } from "@/features/premium/plan-cookie";
import type { Plan, SavedCard } from "@/features/premium/plan";

beforeAll(() => {
  process.env.SESSION_SECRET = "x".repeat(40);
});

const card: SavedCard = { brand: "Mastercard", last4: "4444", exp: "03/28", holder: "JOAO TESTE" };
const other: SavedCard = { brand: "Visa", last4: "4242", exp: "12/30", holder: "JOAO TESTE" };
const T1 = "2026-11-13T03:00:00.000Z";
const T2 = "2026-11-13T03:05:00.000Z";

describe("cópia do plano no aparelho (cookie assinado)", () => {
  it("vai e volta sem perder nada", () => {
    const snap: PlanSnapshot = { status: "PREMIUM", at: T1, renewsAt: "2026-12-13T03:00:00.000Z", card };
    expect(decodeSnapshot(encodeSnapshot(snap))).toEqual(snap);
  });
  it("recusa cookie adulterado, sem assinatura ou malformado", () => {
    const good = encodeSnapshot({ status: "FREE", at: T1, card: null });
    const forged = `${Buffer.from(JSON.stringify({ status: "PREMIUM", at: T2, card: null })).toString("base64url")}.${good.split(".")[1]}`;
    expect(decodeSnapshot(forged)).toBeNull();
    expect(decodeSnapshot(good.split(".")[0])).toBeNull();
    expect(decodeSnapshot("lixo")).toBeNull();
    expect(decodeSnapshot(undefined)).toBeNull();
  });
  it("só guarda dados mascarados do cartão", () => {
    const value = encodeSnapshot(snapshotOf({ status: "PREMIUM", since: T1 }, card));
    const json = Buffer.from(value.split(".")[0], "base64url").toString("utf8");
    expect(JSON.parse(json).card).toEqual(card);
    expect(json).not.toMatch(/\d{12,}/); // nenhum número completo
  });
});

describe("servidor sem memória (serverless): vale a mudança mais recente", () => {
  const fresh: { plan: Plan; card: SavedCard | null } = { plan: { status: "FREE" }, card };

  it("instância nova do servidor + aparelho que assinou = Premium (o caso do anúncio que reaparecia)", () => {
    const r = reconcile(fresh, { status: "PREMIUM", at: T1, renewsAt: "2026-12-13T03:00:00.000Z", card: other });
    expect(r.plan).toEqual({ status: "PREMIUM", since: T1, renewsAt: "2026-12-13T03:00:00.000Z" });
    expect(r.card).toEqual(other); // o cartão trocado na compra também volta
    expect(r.fromCookie).toBe(true);
  });
  it("instância antiga ainda 'Premium' + aparelho que cancelou depois = grátis", () => {
    const r = reconcile({ plan: { status: "PREMIUM", since: T1 }, card }, { status: "FREE", at: T2, card });
    expect(r.plan).toEqual({ status: "FREE", canceledAt: T2 });
  });
  it("servidor mais novo que o aparelho continua valendo (ex.: cancelado em outro aparelho)", () => {
    const server = { plan: { status: "FREE", canceledAt: T2 } as Plan, card };
    const r = reconcile(server, { status: "PREMIUM", at: T1, card });
    expect(r.plan.status).toBe("FREE");
    expect(r.fromCookie).toBe(false);
  });
  it("sem cookie, vale o servidor; estado inicial conta como nunca alterado", () => {
    expect(reconcile(fresh, null)).toEqual({ ...fresh, fromCookie: false });
    expect(planChangedAt({ status: "FREE" })).toBe(0);
    expect(planChangedAt({ status: "PREMIUM", since: T1 })).toBe(Date.parse(T1));
  });
});
