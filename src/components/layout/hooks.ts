"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { SystemStatusView } from "./types";

export type MeUser = { id: string; name: string; email: string; role: "USER" | "ADMIN"; createdAt?: string };

/** GET /api/auth/me — tolerant to `{ user }` or a bare user object. */
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    retry: false,
    staleTime: 60_000,
    queryFn: async (): Promise<MeUser> => {
      const data = await apiFetch<{ user?: MeUser } & Partial<MeUser>>("/api/auth/me");
      return (data.user ?? data) as MeUser;
    },
  });
}

/** GET /api/system/status — never throws to the UI; errors surface through `isError`. */
export function useSystemStatus() {
  return useQuery({
    queryKey: ["system-status"],
    retry: 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: () => apiFetch<SystemStatusView>("/api/system/status"),
  });
}

export function initials(name: string | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "G";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
