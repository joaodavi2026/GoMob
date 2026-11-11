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
  { type: 3, label: "Bus" },
  { type: 1, label: "Metro" },
  { type: 2, label: "CPTM" },
] as const;
export const modeLabel = (t: number) => MODES.find((m) => m.type === t)?.label ?? "Transit";

/** Cores oficiais das 8 áreas de operação da SPTrans (route_color do GTFS). */
export const REGIONS = [
  { color: "#509E2F", label: "Northwest" },
  { color: "#002F6C", label: "North" },
  { color: "#FFD100", label: "Northeast" },
  { color: "#DA291C", label: "East" },
  { color: "#006341", label: "Southeast" },
  { color: "#0082BA", label: "South" },
  { color: "#782F40", label: "Southwest" },
  { color: "#FF671F", label: "West" },
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
      if (!res.ok) throw new Error("The GTFS network could not be loaded.");
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

const DAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export function daysLabel(mask: string | null): string {
  if (!mask) return "—";
  if (mask === "1111111") return "Every day";
  if (mask === "1111100") return "Weekdays";
  if (mask === "1111110") return "Mon–Sat";
  if (mask === "0000011") return "Weekends";
  return DAY.filter((_, i) => mask[i] === "1").join(", ") || "—";
}
