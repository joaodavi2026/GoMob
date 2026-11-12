"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Flag, Info, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, EmptyState, ErrorState, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api";
import type { GeoPoint } from "@/types/transit";
import { findPlace, KNOWN_PLACES, matchKnownPlace, placeToPoint } from "../places";
import { formatPointParam, parsePointParam } from "../points";
import { SORT_LABELS, type RouteSearchResponse, type SortKey } from "../types";
import { RouteCard, type RouteTag } from "./route-card";
import { RouteDetails } from "./route-details";

const select = "-ml-1 h-7 w-full appearance-none truncate bg-transparent text-[15px] font-semibold text-ink outline-none";

function PointSelect({ label, value, onChange }: { label: string; value: GeoPoint | null; onChange: (p: GeoPoint) => void }) {
  const known = value ? matchKnownPlace(value) : undefined;
  const custom = value && !known;
  return (
    <label className="flex items-center gap-3 rounded-3xl bg-canvas px-4 py-3 pr-16">
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          label === "Origem" ? "bg-white text-primary shadow-soft" : "bg-night text-white",
        )}
      >
        {label === "Origem" ? <MapPin className="h-[18px] w-[18px]" aria-hidden /> : <Flag className="h-[17px] w-[17px]" aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
      <span className="block text-[11px] font-medium text-muted">{label === "Origem" ? "De" : "Para"}</span>
      <select
        aria-label={label}
        className={select}
        value={known?.id ?? (custom ? "custom" : "")}
        onChange={(e) => {
          const p = findPlace(e.target.value);
          if (p) onChange(placeToPoint(p));
        }}
      >
        {!value && <option value="">Escolha um local conhecido</option>}
        {custom && <option value="custom">{value.label ?? "Ponto personalizado"}</option>}
        {KNOWN_PLACES.map((p) => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>
      </span>
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
      add(data.recommendations.fastest?.routeId, "Mais rápida");
      add(data.recommendations.fewerTransfers?.routeId, "Menos baldeações");
      add(data.recommendations.lowerRisk?.routeId, "Menor risco estimado");
      add(data.recommendations.balanced?.routeId, "Equilibrada");
    }
    return map;
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      apiFetch("/api/favorites", {
        method: "POST",
        body: JSON.stringify({
          originLabel: origin!.label ?? "Origem",
          destinationLabel: destination!.label ?? "Destino",
          originLatitude: origin!.latitude,
          originLongitude: origin!.longitude,
          destinationLatitude: destination!.latitude,
          destinationLongitude: destination!.longitude,
          nickname: `${origin!.label ?? "Origem"} para ${destination!.label ?? "Destino"}`.slice(0, 60),
        }),
      }),
    onSuccess: () => toast.success("Salvo nos favoritos."),
    onError: (e) => toast.error((e as Error).message || "Não foi possível salvar o favorito."),
  });

  const swap = () => {
    setOrigin(destination);
    setDestination(origin);
    setSelectedId(null);
  };

  const recs = data?.recommendations;
  const recLines = [
    recs?.fastest && ["Mais rápida", recs.fastest.reasons],
    recs?.fewerTransfers && ["Menos baldeações", recs.fewerTransfers.reasons],
    recs?.lowerRisk && ["Menor risco estimado", recs.lowerRisk.reasons],
    recs?.balanced && ["Equilibrada", recs.balanced.reasons],
  ].filter(Boolean) as [string, string[]][];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 pb-4 pt-2">
      <header>
        <h1 className="text-[30px] leading-tight tracking-tight">
          <span className="font-light text-muted">Rotas</span> <span className="font-extrabold">inteligentes</span>
        </h1>
        <p className="mt-1 text-sm text-muted">Viagens só de ônibus. A caminhada é permitida para chegar às paradas e fazer baldeações.</p>
      </header>

      <div className="rounded-[28px] bg-white p-2 shadow-soft">
        <div className="relative space-y-2">
          <PointSelect label="Origem" value={origin} onChange={(p) => { setOrigin(p); setSelectedId(null); }} />
          <PointSelect label="Destino" value={destination} onChange={(p) => { setDestination(p); setSelectedId(null); }} />
          <button
            type="button"
            onClick={swap}
            aria-label="Inverter origem e destino"
            className="tap absolute right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow-soft ring-1 ring-border"
          >
            <ArrowUpDown className="h-[18px] w-[18px]" aria-hidden />
          </button>
        </div>
        <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="Ordenar por">
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={sort === k}
              onClick={() => setSort(k)}
              className={cn(
                "tap shrink-0 rounded-full px-4 py-2 text-xs font-semibold",
                sort === k ? "bg-night text-white" : "bg-canvas text-ink",
              )}
            >
              {SORT_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      {(!origin || !destination) && (
        <EmptyState title="Escolha uma origem e um destino" description="Escolha dois locais para comparar rotas de ônibus." />
      )}

      {search.isFetching && !data && (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {search.isError && (
        <ErrorState message="A busca de rotas está indisponível agora. Tente novamente em instantes." onRetry={() => search.refetch()} />
      )}

      {data && data.routes.length === 0 && (
        <EmptyState
          title="Nenhuma rota de ônibus encontrada."
          description={
            data.isDemo
              ? "A rede de demonstração cobre apenas um conjunto limitado de viagens de ônibus validadas em São Paulo. Tente outra origem ou outro destino."
              : "Tente outra origem ou outro destino, ou outro horário."
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
              <h2 className="text-sm font-semibold">Como recomendamos</h2>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {recLines.map(([name, reasons]) => (
                  <li key={name}><strong className="text-ink">{name}:</strong> {reasons.join(" ")}</li>
                ))}
                {recs?.notes.lowerRisk && <li><strong className="text-ink">Menor risco estimado:</strong> {recs.notes.lowerRisk}</li>}
              </ul>
            </Card>
          )}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <ul className="space-y-3" aria-label="Opções de rota">
              {data.routes.map((r) => (
                <li key={r.id}>
                  <RouteCard
                    route={r}
                    tags={tagsFor.get(r.id) ?? []}
                    selected={r.id === selectedId}
                    onView={() => setSelectedId(r.id)}
                    origin={origin?.label ?? "Origem"}
                    destination={destination?.label ?? "Destino"}
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
                <div className="hidden lg:block">
                  <EmptyState title="Escolha uma rota" description="Toque em Ver rota em um cartão para ver o trajeto, as etapas e o risco por linha." />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
