import { describe, it, expect, vi } from "vitest";
import bcrypt from "bcryptjs";
import { authenticate, type UserRecord } from "@/server/auth/login";
import { createRateLimiter } from "@/server/auth/rate-limit";
import { loginSchema } from "@/features/auth/schemas";

const hash = bcrypt.hashSync("GoodPass123!", 4);
const user: UserRecord = { id: "u1", name: "Ana", email: "a@x.com", passwordHash: hash, role: "USER" };
const admin: UserRecord = { ...user, id: "a1", email: "adm@x.com", role: "ADMIN" };
const find = (u: UserRecord | null) => async (e: string) => (u && u.email === e ? u : null);

describe("authenticate", () => {
  it("valid USER login redirects to /home", async () => {
    const r = await authenticate({ email: "a@x.com", password: "GoodPass123!" }, { findUserByEmail: find(user) });
    expect(r.redirectTo).toBe("/home");
    expect(r.session).toEqual({ userId: "u1", role: "USER", name: "Ana" });
  });
  it("valid ADMIN login redirects to /admin", async () => {
    const r = await authenticate({ email: "adm@x.com", password: "GoodPass123!" }, { findUserByEmail: find(admin) });
    expect(r.redirectTo).toBe("/admin");
  });
  it("wrong password and unknown user give the same generic error", async () => {
    const a = await authenticate({ email: "a@x.com", password: "bad" }, { findUserByEmail: find(user) }).catch((e) => e);
    const b = await authenticate({ email: "nobody@x.com", password: "bad" }, { findUserByEmail: find(user) }).catch((e) => e);
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.code).toBe(b.code);
    expect(a.message).toBe(b.message);
  });
  it("runs bcrypt compare even when the user does not exist", async () => {
    const compare = vi.fn(async () => false);
    await authenticate({ email: "ghost@x.com", password: "x" }, { findUserByEmail: find(null), compare }).catch(() => {});
    expect(compare).toHaveBeenCalledOnce();
  });
  it("rate limits after too many attempts and resets on success", async () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 60_000 });
    const deps = { findUserByEmail: find(user), limiter };
    const bad = { email: "a@x.com", password: "bad" };
    await authenticate(bad, deps, "ip|a").catch(() => {});
    await authenticate(bad, deps, "ip|a").catch(() => {});
    const e = await authenticate(bad, deps, "ip|a").catch((x) => x);
    expect(e.status).toBe(429);
    await authenticate({ email: "a@x.com", password: "GoodPass123!" }, deps, "ip|other");
    expect(limiter.check("ip|other").allowed).toBe(true);
  });
});

describe("rate limiter window", () => {
  it("allows again after the window passes", () => {
    let t = 0;
    const l = createRateLimiter({ max: 1, windowMs: 1000, now: () => t });
    expect(l.check("k").allowed).toBe(true);
    expect(l.check("k").allowed).toBe(false);
    t = 1500;
    expect(l.check("k").allowed).toBe(true);
  });
});

describe("loginSchema", () => {
  it("normalizes email and rejects invalid input", () => {
    expect(loginSchema.parse({ email: "  A@X.com ", password: "p" }).email).toBe("a@x.com");
    expect(loginSchema.safeParse({ email: "nope", password: "p" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@x.com", password: "" }).success).toBe(false);
  });
});
