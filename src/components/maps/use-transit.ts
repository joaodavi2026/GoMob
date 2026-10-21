"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { POLL_INTERVAL_MS } from "@/config/transit";
import { apiFetch } from "@/lib/api";
import type { DataSourceKind, IntegrationState, RiskResult, TransitLine, TransitStop, TransitVehicle } from "@/types/transit";

export type LinesData = { lines: (TransitLine & { active: boolean })[]; source: DataSourceKind; state: IntegrationState; fallbackFromLive?: boolean };
export type VehiclesData = {
  vehicles: TransitVehicle[];
  state: IntegrationState;
  fetchedAt: string;
  source: DataSourceKind;
  fallbackFromLive?: boolean;
};

export function useLines() {
  return useQuery({ queryKey: ["transit", "lines"], queryFn: () => apiFetch<LinesData>("/api/lines"), staleTime: 60_000 });
}

export function useLinePath(lineId: string | null) {
  return useQuery({
    queryKey: ["transit", "line", lineId],
    enabled: !!lineId,
    staleTime: 5 * 60_000,
    queryFn: () => apiFetch<{ line: TransitLine; path: [number, number][] }>(`/api/lines/${encodeURIComponent(lineId!)}`),
  });
}

export function useLineStops(lineId: string | null) {
  return useQuery({
    queryKey: ["transit", "stops", lineId],
    enabled: !!lineId,
    staleTime: 5 * 60_000,
    queryFn: () => apiFetch<{ stops: TransitStop[]; source: DataSourceKind }>(`/api/lines/${encodeURIComponent(lineId!)}/stops`),
  });
}

/**
 * Polling sob demanda: só consulta enquanto `enabled` e a aba está visível
 * (refetchIntervalInBackground=false pausa o timer em aba inativa).
 */
export function useVehicles(lineIds: string[], enabled = true, intervalMs = POLL_INTERVAL_MS) {
  const key = [...lineIds].sort().join(",");
  return useQuery({
    queryKey: ["transit", "vehicles", key],
    enabled: enabled && lineIds.length > 0,
    refetchInterval: intervalMs,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
    queryFn: ({ signal }) => apiFetch<VehiclesData>(`/api/vehicles?lineIds=${encodeURIComponent(key)}`, { signal }),
  });
}

/** Risco estimado; tolerante a erro (retorna null quando indisponível). */
export function useLineRisk(lineId: string | null) {
  return useQuery({
    queryKey: ["intelligence", "risk", lineId],
    enabled: !!lineId,
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      try {
        return (await apiFetch<{ risk: RiskResult }>(`/api/intelligence/risk?lineId=${encodeURIComponent(lineId!)}`)).risk;
      } catch {
        return null;
      }
    },
  });
}

/** Relógio que atualiza a cada `ms` (para "Last updated X ago" e frescor). */
export function useNow(ms = 10_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export type UiStatus = "CONNECTED" | "UPDATING" | "UNAVAILABLE" | "STALE" | "DEMO";

export const STATUS_LABEL: Record<UiStatus, string> = {
  CONNECTED: "Connected",
  UPDATING: "Updating",
  UNAVAILABLE: "Temporarily unavailable",
  STALE: "Stale data",
  DEMO: "Demo mode",
};

/** Deriva o estado exibido a partir da consulta (nunca esconde falhas/dados antigos). */
export function deriveStatus(q: { data?: VehiclesData; isFetching: boolean; isError: boolean }): UiStatus {
  if (q.isError) return q.data ? "STALE" : "UNAVAILABLE";
  if (!q.data) return q.isFetching ? "UPDATING" : "UNAVAILABLE";
  if (q.isFetching) return "UPDATING";
  return q.data.state;
}
