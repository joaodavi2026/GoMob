"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, ErrorState, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api";
import type { GeoPoint } from "@/types/transit";
import { findPlace, KNOWN_PLACES, matchKnownPlace, placeToPoint } from "../places";
import { formatPointParam, parsePointParam } from "../points";
import { SORT_LABELS, type RouteSearchResponse, type SortKey } from "../types";
import { RouteCard, type RouteTag } from "./route-card";
import { RouteDetails } from "./route-details";

const select = "h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function PointSelect({ label, value, onChange }: { label: string; value: GeoPoint | null; onChange: (p: GeoPoint) => void }) {
  const known = value ? matchKnownPlace(value) : undefined;
  const custom = value && !known;
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <select
        className={select}
        value={known?.id ?? (custom ? "custom" : "")}
        onChange={(e) => {
          const p = findPlace(e.target.value);
          if (p) onChange(placeToPoint(p));
        }}
      >
        {!value && <option value="">Select a known place</option>}
        {custom && <option value="custom">{value.label ?? "Custom point"}</option>}
        {KNOWN_PLACES.map((p) => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>
    </label>
  );
}

export function RoutesView() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [origin, setOrigin] = useState<GeoPoint | null>(() => parsePointParam(params.get("o")));
  const [destination, setDestination] = useState<GeoPoint | null>(() => parsePointParam(params.get("d")));
  const [sort, setSort] = useState<SortKey>("fastest");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Mantém a URL (?o=&d=) em sincronia para compartilhamento/retorno.
  useEffect(() => {
    if (!origin || !destination) return;
    const qs = new URLSearchParams({ o: formatPointParam(origin), d: formatPointParam(destination) });
    router.replace(`/routes?${qs.toString()}`, { scroll: false });
  }, [origin, destination, router]);

  const search = useQuery({
    queryKey: ["routes", origin, destination, sort],
    enabled: !!origin && !!destination,
    queryFn: () =>
      apiFetch<RouteSearchResponse>("/api/routes/search", { method: "POST", body: JSON.stringify({ origin, destination, sort }) }),
    staleTime: 30_000,
    retry: 0,
  });

  const data = search.data;
  const selected = data?.routes.find((r) => r.id === selectedId) ?? null;

  const tagsFor = useMemo(() => {
    const map = new Map<string, RouteTag[]>();
    const add = (id: string | undefined, t: RouteTag) => id && map.set(id, [...(map.get(id) ?? []), t]);
    if (data) {
      add(data.recommendations.fastest?.routeId, "Fastest");
      add(data.recommendations.fewerTransfers?.routeId, "Fewer transfers");
      add(data.recommendations.lowerRisk?.routeId, "Lower estimated risk");
      add(data.recommendations.balanced?.routeId, "Balanced");
    }
    return map;
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      apiFetch("/api/favorites", {
        method: "POST",
        body: JSON.stringify({
          originLabel: origin!.label ?? "Origin",
          destinationLabel: destination!.label ?? "Destination",
          originLatitude: origin!.latitude,
          originLongitude: origin!.longitude,
          destinationLatitude: destination!.latitude,
          destinationLongitude: destination!.longitude,
          nickname: `${origin!.label ?? "Origin"} to ${destination!.label ?? "Destination"}`.slice(0, 60),
        }),
      }),
    onSuccess: () => toast.success("Saved to favorites."),
    onError: (e) => toast.error((e as Error).message || "Could not save the favorite."),
  });

  const swap = () => {
    setOrigin(destination);
    setDestination(origin);
    setSelectedId(null);
  };

  const recs = data?.recommendations;
  const recLines = [
    recs?.fastest && ["Fastest", recs.fastest.reasons],
    recs?.fewerTransfers && ["Fewer transfers", recs.fewerTransfers.reasons],
    recs?.lowerRisk && ["Lower estimated risk", recs.lowerRisk.reasons],
    recs?.balanced && ["Balanced", recs.balanced.reasons],
  ].filter(Boolean) as [string, string[]][];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Smart Routes</h1>
        <p className="mt-1 text-muted">Bus-only trips. Walking is allowed to reach stops and transfer.</p>
      </header>

      <Card className="p-4">
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <PointSelect label="Origin" value={origin} onChange={(p) => { setOrigin(p); setSelectedId(null); }} />
          <Button type="button" variant="secondary" size="icon" onClick={swap} aria-label="Swap origin and destination" className="mx-auto rounded-full">
            <ArrowUpDown className="h-4 w-4" aria-hidden />
          </Button>
          <PointSelect label="Destination" value={destination} onChange={(p) => { setDestination(p); setSelectedId(null); }} />
        </div>
        <label className="mt-3 block sm:max-w-xs">
          <span className="mb-1.5 block text-sm font-medium">Sort by</span>
          <select className={select} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>{SORT_LABELS[k]}</option>
            ))}
          </select>
        </label>
      </Card>

      {(!origin || !destination) && (
        <EmptyState title="Choose an origin and a destination" description="Pick two places to compare bus routes." />
      )}

      {search.isFetching && !data && (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {search.isError && (
        <ErrorState message="Route search is unavailable right now. Please try again in a moment." onRetry={() => search.refetch()} />
      )}

      {data && data.routes.length === 0 && (
        <EmptyState
          title="No bus routes found."
          description={
            data.isDemo
              ? "The demonstration network only covers a limited set of validated bus trips in São Paulo. Try another origin or destination."
              : "Try another origin or destination, or a different time."
          }
        />
      )}

      {data && data.routes.length > 0 && (
        <>
          {data.notice && (
            <p role="status" className="flex items-start gap-2 rounded-xl border border-border bg-canvas p-3 text-sm text-muted">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {data.notice}
            </p>
          )}
          {recLines.length > 0 && (
            <Card className="p-4">
              <h2 className="text-sm font-semibold">How we recommend</h2>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {recLines.map(([name, reasons]) => (
                  <li key={name}><strong className="text-ink">{name}:</strong> {reasons.join(" ")}</li>
                ))}
                {recs?.notes.lowerRisk && <li><strong className="text-ink">Lower estimated risk:</strong> {recs.notes.lowerRisk}</li>}
              </ul>
            </Card>
          )}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <ul className="space-y-3" aria-label="Route options">
              {data.routes.map((r) => (
                <li key={r.id}>
                  <RouteCard
                    route={r}
                    tags={tagsFor.get(r.id) ?? []}
                    selected={r.id === selectedId}
                    onView={() => setSelectedId(r.id)}
                    origin={origin?.label ?? "Origin"}
                    destination={destination?.label ?? "Destination"}
                  />
                </li>
              ))}
            </ul>
            <div>
              {selected && origin && destination ? (
                <RouteDetails
                  route={selected}
                  origin={origin}
                  destination={destination}
                  onClose={() => setSelectedId(null)}
                  onSave={() => save.mutate()}
                  saving={save.isPending}
                />
              ) : (
                <EmptyState title="Select a route" description="Choose View route on a card to see the path, steps and risk per line." />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
