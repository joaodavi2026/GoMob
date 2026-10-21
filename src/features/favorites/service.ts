import { ApiError } from "@/lib/api";
import type { FavoriteCreateInput, FavoriteUpdateInput } from "./schemas";

export type FavoriteRecord = FavoriteCreateInput & { id: string; userId: string; createdAt: Date };

/** Repositório injetável (Prisma em produção, mock nos testes). */
export type FavoriteRepo = {
  list(userId: string, skip: number, take: number): Promise<FavoriteRecord[]>;
  count(userId: string): Promise<number>;
  create(userId: string, data: FavoriteCreateInput): Promise<FavoriteRecord>;
  findById(id: string): Promise<FavoriteRecord | null>;
  update(id: string, data: FavoriteUpdateInput): Promise<FavoriteRecord>;
  remove(id: string): Promise<void>;
};

export const MAX_FAVORITES_PER_USER = 50;

export async function listFavorites(repo: FavoriteRepo, userId: string, page: number, pageSize: number) {
  const [favorites, total] = await Promise.all([
    repo.list(userId, (page - 1) * pageSize, pageSize),
    repo.count(userId),
  ]);
  return { favorites, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function createFavorite(repo: FavoriteRepo, userId: string, data: FavoriteCreateInput) {
  if ((await repo.count(userId)) >= MAX_FAVORITES_PER_USER) {
    throw new ApiError(409, "LIMIT_REACHED", `You can save up to ${MAX_FAVORITES_PER_USER} favorites.`);
  }
  return repo.create(userId, data);
}

/** Retorna o favorito somente se pertencer ao usuário; 404 nos dois casos (não revela existência). */
export async function getOwnedFavorite(repo: FavoriteRepo, userId: string, id: string) {
  const fav = await repo.findById(id);
  if (!fav || fav.userId !== userId) throw new ApiError(404, "NOT_FOUND", "Favorite not found.");
  return fav;
}

export async function updateFavorite(repo: FavoriteRepo, userId: string, id: string, data: FavoriteUpdateInput) {
  await getOwnedFavorite(repo, userId, id);
  return repo.update(id, data);
}

export async function deleteFavorite(repo: FavoriteRepo, userId: string, id: string) {
  const fav = await getOwnedFavorite(repo, userId, id);
  await repo.remove(id);
  return fav;
}
