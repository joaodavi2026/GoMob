"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type SavedCardView = { brand: string; last4: string; exp: string; holder: string };
export type PlanView = {
  plan: { status: "FREE" | "PREMIUM"; since?: string; renewsAt?: string; canceledAt?: string };
  card: SavedCardView | null;
  events: { at: string; type: "SUBSCRIBED" | "CANCELED"; amountCents?: number; card?: string }[];
  priceCents: number;
  canManage: boolean;
  ownerName: string;
};

export const PLAN_KEY = ["plan"] as const;

/** Plano atual (simulado). `premium` só é verdadeiro depois de confirmado pelo servidor. */
export function usePlan() {
  const q = useQuery({ queryKey: PLAN_KEY, staleTime: 30_000, retry: 1, queryFn: () => apiFetch<PlanView>("/api/premium") });
  return { ...q, premium: q.data?.plan.status === "PREMIUM", loaded: q.isSuccess };
}

export const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
