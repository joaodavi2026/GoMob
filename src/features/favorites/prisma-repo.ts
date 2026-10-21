import { db } from "@/server/db";
import type { FavoriteRepo } from "./service";

export const prismaFavoriteRepo: FavoriteRepo = {
  list: (userId, skip, take) => db.favorite.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, skip, take }),
  count: (userId) => db.favorite.count({ where: { userId } }),
  create: (userId, data) => db.favorite.create({ data: { ...data, userId } }),
  findById: (id) => db.favorite.findUnique({ where: { id } }),
  update: (id, data) => db.favorite.update({ where: { id }, data }),
  remove: async (id) => {
    await db.favorite.delete({ where: { id } });
  },
};
