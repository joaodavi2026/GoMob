"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type Share = {
  userId: string;
  name: string;
  startedAt: string;
  updatedAt: string;
  origin: string;
  destination: string;
  lines: string[];
  title: string;
  detail: string;
  minutes: number;
  arrived: boolean;
  pos: [number, number] | null; // [lat, lon]
  dest: [number, number];
  path: [number, number][]; // [lon, lat]
};
export type FamilyView = {
  me: { id: string; name: string; isOwner: boolean };
  owner: { id: string; name: string };
  members: { id: string; userId: string; name: string; joinedAt: string; code?: string }[];
  invites: { code: string; createdAt: string }[];
  max: number;
  shares: Share[];
  lanOrigins: string[];
};

export const FAMILY_KEY = ["family"] as const;

/** Família e trajetos compartilhados. Com `live`, consulta a cada 3 s para acompanhar em tempo real. */
export function useFamily(live = false) {
  return useQuery({
    queryKey: FAMILY_KEY,
    queryFn: () => apiFetch<FamilyView>("/api/family"),
    refetchInterval: live ? 3000 : false,
    staleTime: live ? 0 : 30_000,
    retry: 1,
  });
}

export function ago(iso: string, nowMs: number): string {
  const s = Math.max(0, Math.round((nowMs - Date.parse(iso)) / 1000));
  if (s < 8) return "agora";
  if (s < 60) return `há ${s} s`;
  return `há ${Math.round(s / 60)} min`;
}
