import { isDbAvailable } from "@/server/db/available";
import { localFavoriteRepo } from "./local-repo";
import { prismaFavoriteRepo } from "./prisma-repo";
import type { FavoriteRepo } from "./service";

/** Postgres quando disponível; senão, favoritos guardados localmente no servidor. */
export async function getFavoriteRepo(): Promise<FavoriteRepo> {
  return (await isDbAvailable()) ? prismaFavoriteRepo : localFavoriteRepo;
}
