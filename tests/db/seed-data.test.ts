import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { demoUsers } from "../../prisma/demo-users";

describe("demo users", () => {
  it("have unique emails, both roles, and hash/verify with bcrypt", async () => {
    expect(new Set(demoUsers.map((u) => u.email)).size).toBe(demoUsers.length);
    expect(demoUsers.map((u) => u.role).sort()).toEqual(["ADMIN", "ADMIN", "USER", "USER"]);
    for (const u of demoUsers) {
      const h = await bcrypt.hash(u.password, 4);
      expect(await bcrypt.compare(u.password, h)).toBe(true);
      expect(await bcrypt.compare("wrong", h)).toBe(false);
    }
  });
});
