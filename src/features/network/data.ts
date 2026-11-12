"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { apiFetch } from "@/lib/api";
import type { FleetSnapshot, FleetVehicle } from "@/server/sptrans/fleet";

export type NetDir = {
  d: number;
  headsign: string;
  shape: number | null;
  stops: number[];
  days: string | null;
  first: string | null;
  last: string | null;
  minHeadway: number | null;
  trip: number | null;
  freq: [number, number][];
};
export type NetLine = {
  id: string;
  code: string;
  name: string;
  type: number;
  color: string;
  textColor: string;
  fare: number | null;
  dirs: NetDir[];
};
export type NetStop = [id: string, name: string, lat: number, lon: number];
export type Network = {
  generatedAt: string;
  agency: { name: string; url: string | null };
  counts: { lines: number; stops: number; shapes: number };
  lines: NetLine[];
  stops: NetStop[];
};
export type { FleetSnapshot, FleetVehicle };

/** Modos GTFS presentes no feed da SPTrans. */
export const MODES = [
  { type: 3, label: "Ônibus" },
  { type: 1, label: "Metrô" },
  { type: 2, label: "CPTM" },
] as const;
export const modeLabel = (t: number) => MODES.find((m) => m.type === t)?.label ?? "Transporte";

/** Cores oficiais das 8 áreas de operação da SPTrans (route_color do GTFS). */
export const REGIONS = [
  { color: "#509E2F", label: "Noroeste" },
  { color: "#002F6C", label: "Norte" },
  { color: "#FFD100", label: "Nordeste" },
  { color: "#DA291C", label: "Leste" },
  { color: "#006341", label: "Sudeste" },
  { color: "#0082BA", label: "Sul" },
  { color: "#782F40", label: "Sudoeste" },
  { color: "#FF671F", label: "Oeste" },
] as const;
export const regionLabel = (color: string) => REGIONS.find((r) => r.color === color)?.label ?? null;

export const SHAPES_URL = "/gtfs/shapes.geojson";

export function useNetwork() {
  return useQuery({
    queryKey: ["network", "gtfs"],
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => {
      const res = await fetch("/gtfs/network.json");
      if (!res.ok) throw new Error("Não foi possível carregar a rede GTFS.");
      return (await res.json()) as Network;
    },
  });
}

export function useFleet(enabled: boolean) {
  return useQuery<FleetSnapshot>({
    queryKey: ["network", "fleet"],
    enabled,
    refetchInterval: (q) => (q.state.data?.state === "LIVE" ? 30_000 : 90_000),
    refetchIntervalInBackground: false,
    staleTime: 15_000,
    queryFn: ({ signal }) => apiFetch<FleetSnapshot>("/api/network/vehicles", { signal }),
  });
}

/** Índices derivados: código → linha, parada → linhas que passam nela. */
export function useNetworkIndex(net: Network | undefined) {
  return useMemo(() => {
    const byCode = new Map<string, number>();
    const stopLines: number[][] = [];
    if (!net) return { byCode, stopLines };
    net.lines.forEach((l, i) => {
      byCode.set(l.code, i);
      const seen = new Set<number>();
      for (const d of l.dirs)
        for (const s of d.stops) {
          if (seen.has(s)) continue;
          seen.add(s);
          (stopLines[s] ??= []).push(i);
        }
    });
    return { byCode, stopLines };
  }, [net]);
}

/** Olho Vivo: sentido 1 = principal→secundário (GTFS direction 0); 2 = volta (direction 1). */
export const fleetDir = (sl: number) => (sl === 2 ? 1 : 0);

export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const DAY = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
export function daysLabel(mask: string | null): string {
  if (!mask) return "—";
  if (mask === "1111111") return "Todos os dias";
  if (mask === "1111100") return "Dias úteis";
  if (mask === "1111110") return "Seg–Sáb";
  if (mask === "0000011") return "Fins de semana";
  return DAY.filter((_, i) => mask[i] === "1").join(", ") || "—";
}
