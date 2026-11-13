"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type Favorite = {
  id: string;
  nickname: string;
  originLabel: string;
  destinationLabel: string;
  originLatitude: number;
  originLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
};

/** Chave única do cache de favoritos: todas as telas guardam o MESMO formato (lista). */
export const FAVORITES_KEY = ["favorites"] as const;

/**
 * Favoritos do usuário. Início, Salvos e Perfil compartilham este cache, então o formato
 * precisa ser sempre o mesmo (antes cada tela guardava um formato e Salvos quebrava ao vir da Início).
 */
export function useFavorites() {
  return useQuery({
    queryKey: FAVORITES_KEY,
    retry: 0,
    queryFn: async (): Promise<Favorite[]> => {
      const data = await apiFetch<{ favorites?: Favorite[] }>("/api/favorites?pageSize=50");
      return data.favorites ?? [];
    },
  });
}
