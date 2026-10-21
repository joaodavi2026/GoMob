import { describe, it, expect, beforeAll, vi } from "vitest";
import { SignJWT } from "jose";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }));

beforeAll(() => {
  process.env.SESSION_SECRET = "x".repeat(40);
});

describe("session tokens", () => {
  it("round-trips a signed session", async () => {
    const { signSession, verifySessionToken } = await import("@/server/auth/session");
    const token = await signSession({ userId: "u1", role: "ADMIN", name: "N" });
    expect(await verifySessionToken(token)).toEqual({ userId: "u1", role: "ADMIN", name: "N" });
  });
  it("returns null for expired, tampered, wrong-secret, missing and bad-role tokens", async () => {
    const { signSession, verifySessionToken } = await import("@/server/auth/session");
    const key = new TextEncoder().encode("x".repeat(40));
    const now = Math.floor(Date.now() / 1000);
    const expired = await new SignJWT({ userId: "u1", role: "USER", name: "N" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(now - 100)
      .setExpirationTime(now - 50)
      .sign(key);
    expect(await verifySessionToken(expired)).toBeNull();
    const good = await signSession({ userId: "u1", role: "USER", name: "N" });
    expect(await verifySessionToken(good.slice(0, -3) + "abc")).toBeNull();
    const other = await new SignJWT({ userId: "u1", role: "USER" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("y".repeat(40)));
    expect(await verifySessionToken(other)).toBeNull();
    const badRole = await new SignJWT({ userId: "u1", role: "ROOT" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(key);
    expect(await verifySessionToken(badRole)).toBeNull();
    expect(await verifySessionToken(undefined)).toBeNull();
    expect(await verifySessionToken("garbage")).toBeNull();
  });
});
