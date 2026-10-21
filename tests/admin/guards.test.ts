import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/server/auth/session", () => ({ getSession: () => getSession() }));

import { requireAdmin, requireUser } from "@/server/auth/guards";
import { ApiError, handle } from "@/lib/api";

describe("admin access guards", () => {
  beforeEach(() => getSession.mockReset());

  it("allows an ADMIN session", async () => {
    getSession.mockResolvedValue({ userId: "a1", role: "ADMIN", name: "Admin" });
    await expect(requireAdmin()).resolves.toMatchObject({ userId: "a1", role: "ADMIN" });
  });

  it("denies a USER session with 403", async () => {
    getSession.mockResolvedValue({ userId: "u1", role: "USER", name: "User" });
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("denies an anonymous request with 401", async () => {
    getSession.mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toBeInstanceOf(ApiError);
    await expect(requireAdmin()).rejects.toMatchObject({ status: 401 });
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });

  it("a handler wrapped with handle() returns 403 JSON for USER and never runs the body", async () => {
    getSession.mockResolvedValue({ userId: "u1", role: "USER", name: "User" });
    const body = vi.fn();
    const route = handle(async () => {
      await requireAdmin();
      body();
      return new Response("ok");
    });
    const res = await route();
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(body).not.toHaveBeenCalled();
  });
});
