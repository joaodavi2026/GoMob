import { describe, it, expect, vi, beforeEach } from "vitest";
import { hasRole, homeForRole } from "@/server/auth/roles";

const getSession = vi.fn();
vi.mock("@/server/auth/session", () => ({ getSession: () => getSession() }));

describe("guards", () => {
  beforeEach(() => getSession.mockReset());
  it("requireUser throws 401 without session", async () => {
    const { requireUser } = await import("@/server/auth/guards");
    getSession.mockResolvedValue(null);
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });
  it("requireAdmin throws 403 for USER and passes ADMIN", async () => {
    const { requireAdmin } = await import("@/server/auth/guards");
    getSession.mockResolvedValue({ userId: "u", role: "USER", name: "n" });
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
    getSession.mockResolvedValue({ userId: "a", role: "ADMIN", name: "n" });
    await expect(requireAdmin()).resolves.toMatchObject({ role: "ADMIN" });
  });
});

describe("roles", () => {
  it("hasRole and homeForRole", () => {
    expect(hasRole("ADMIN", "ADMIN")).toBe(true);
    expect(hasRole("USER", "ADMIN")).toBe(false);
    expect(hasRole("USER", "USER")).toBe(true);
    expect(hasRole(undefined, "USER")).toBe(false);
    expect(homeForRole("USER")).toBe("/home");
    expect(homeForRole("ADMIN")).toBe("/admin");
  });
});

describe("open access (no login)", () => {
  it("without a session cookie every visitor gets the open session", async () => {
    vi.resetModules();
    vi.doUnmock("@/server/auth/session");
    vi.doMock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
    const { getSession: real, OPEN_SESSION } = await import("@/server/auth/session");
    await expect(real()).resolves.toEqual(OPEN_SESSION);
    expect(OPEN_SESSION.role).toBe("ADMIN");
  });
});
