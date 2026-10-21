import { describe, it, expect, vi, beforeEach } from "vitest";
import { hasRole, homeForRole } from "@/server/auth/roles";
import { decideAccess } from "@/server/auth/route-policy";

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

describe("decideAccess (proxy policy)", () => {
  const user = { role: "USER" as const };
  const admin = { role: "ADMIN" as const };
  it("login is public for anonymous, redirects by role when signed in", () => {
    expect(decideAccess("/login", null)).toEqual({ action: "next" });
    expect(decideAccess("/login", user)).toEqual({ action: "redirect", to: "/home" });
    expect(decideAccess("/login", admin)).toEqual({ action: "redirect", to: "/admin" });
  });
  it("anonymous is sent to /login on protected routes", () => {
    expect(decideAccess("/home", null)).toEqual({ action: "redirect", to: "/login" });
    expect(decideAccess("/admin/lines", null)).toEqual({ action: "redirect", to: "/login" });
  });
  it("USER cannot enter /admin, ADMIN can", () => {
    expect(decideAccess("/admin", user)).toEqual({ action: "redirect", to: "/home" });
    expect(decideAccess("/admin/settings", user)).toEqual({ action: "redirect", to: "/home" });
    expect(decideAccess("/admin/settings", admin)).toEqual({ action: "next" });
    expect(decideAccess("/administrator", user)).toEqual({ action: "next" });
    expect(decideAccess("/home", user)).toEqual({ action: "next" });
  });
});
