import { describe, it, expect } from "vitest";
import { favoriteCreateSchema, favoriteUpdateSchema, favoriteListQuerySchema } from "@/features/favorites/schemas";
import {
  createFavorite,
  deleteFavorite,
  listFavorites,
  updateFavorite,
  MAX_FAVORITES_PER_USER,
  type FavoriteRecord,
  type FavoriteRepo,
} from "@/features/favorites/service";

const valid = {
  nickname: "Home to work",
  originLabel: "Home",
  destinationLabel: "Work",
  originLatitude: -23.55,
  originLongitude: -46.63,
  destinationLatitude: -23.56,
  destinationLongitude: -46.65,
};

function memRepo(): FavoriteRepo & { rows: FavoriteRecord[] } {
  const rows: FavoriteRecord[] = [];
  let n = 0;
  return {
    rows,
    list: async (u, skip, take) => rows.filter((r) => r.userId === u).slice(skip, skip + take),
    count: async (u) => rows.filter((r) => r.userId === u).length,
    create: async (u, d) => {
      const r = { ...d, id: `f${++n}`, userId: u, createdAt: new Date() };
      rows.push(r);
      return r;
    },
    findById: async (id) => rows.find((r) => r.id === id) ?? null,
    update: async (id, d) => {
      const r = rows.find((x) => x.id === id)!;
      Object.assign(r, d);
      return r;
    },
    remove: async (id) => {
      rows.splice(rows.findIndex((r) => r.id === id), 1);
    },
  };
}

describe("favorite schemas", () => {
  it("accepts valid and rejects bad coordinates / empty labels", () => {
    expect(favoriteCreateSchema.safeParse(valid).success).toBe(true);
    expect(favoriteCreateSchema.safeParse({ ...valid, originLatitude: 95 }).success).toBe(false);
    expect(favoriteCreateSchema.safeParse({ ...valid, destinationLongitude: -181 }).success).toBe(false);
    expect(favoriteCreateSchema.safeParse({ ...valid, nickname: "   " }).success).toBe(false);
    expect(favoriteCreateSchema.safeParse({ ...valid, originLabel: undefined }).success).toBe(false);
  });
  it("update requires at least one field", () => {
    expect(favoriteUpdateSchema.safeParse({}).success).toBe(false);
    expect(favoriteUpdateSchema.safeParse({ nickname: "New" }).success).toBe(true);
  });
  it("pagination defaults and bounds", () => {
    expect(favoriteListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(favoriteListQuerySchema.safeParse({ pageSize: "500" }).success).toBe(false);
    expect(favoriteListQuerySchema.parse({ page: "2", pageSize: "5" })).toEqual({ page: 2, pageSize: 5 });
  });
});

describe("favorite service", () => {
  it("lists only own favorites with pagination metadata", async () => {
    const repo = memRepo();
    for (let i = 0; i < 5; i++) await createFavorite(repo, "u1", valid);
    await createFavorite(repo, "u2", valid);
    const r = await listFavorites(repo, "u1", 2, 2);
    expect(r.total).toBe(5);
    expect(r.totalPages).toBe(3);
    expect(r.favorites).toHaveLength(2);
    expect(r.favorites.every((f) => f.userId === "u1")).toBe(true);
  });
  it("owner check: other user cannot update or delete (404)", async () => {
    const repo = memRepo();
    const f = await createFavorite(repo, "u1", valid);
    await expect(updateFavorite(repo, "u2", f.id, { nickname: "x" })).rejects.toMatchObject({ status: 404 });
    await expect(deleteFavorite(repo, "u2", f.id)).rejects.toMatchObject({ status: 404 });
    expect(repo.rows).toHaveLength(1);
    expect((await updateFavorite(repo, "u1", f.id, { nickname: "x" })).nickname).toBe("x");
    await deleteFavorite(repo, "u1", f.id);
    expect(repo.rows).toHaveLength(0);
  });
  it("nonexistent id gives 404", async () => {
    await expect(deleteFavorite(memRepo(), "u1", "nope")).rejects.toMatchObject({ status: 404 });
  });
  it("enforces per-user limit", async () => {
    const repo = memRepo();
    for (let i = 0; i < MAX_FAVORITES_PER_USER; i++) await createFavorite(repo, "u1", valid);
    await expect(createFavorite(repo, "u1", valid)).rejects.toMatchObject({ status: 409 });
    await expect(createFavorite(repo, "u2", valid)).resolves.toBeTruthy();
  });
});
