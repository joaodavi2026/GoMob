"use client";

import { useQuery } from "@tanstack/react-query";

export type LineSummary = {
  code: string;
  name: string;
  type: number;
  color: string;
  textColor: string;
  fare: number | null;
  minHeadway: number | null;
  trip: number | null;
  stops: number;
  from: string | null;
  to: string | null;
  hours: string | null;
};
export type Highlights = {
  generatedAt: string;
  counts: { lines: number; stops: number; shapes: number; bus: number; rail: number };
  rail: LineSummary[];
  popular: LineSummary[];
};

/** Resumo leve do GTFS (public/gtfs/highlights.json, gerado por scripts/build-gtfs.ts). */
export function useHighlights() {
  return useQuery({
    queryKey: ["gtfs", "highlights"],
    staleTime: Infinity,
    queryFn: async () => {
      const r = await fetch("/gtfs/highlights.json");
      if (!r.ok) throw new Error("highlights");
      return (await r.json()) as Highlights;
    },
  });
}

export const networkHref = (code: string) => `/network?line=${encodeURIComponent(code)}`;
