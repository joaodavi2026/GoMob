"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FAVORITES_KEY } from "@/features/favorites/use-favorites";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { useA11y } from "@/features/a11y/a11y";
import { apiFetch } from "@/lib/api";
import type { GeoPoint } from "@/types/transit";
import { formatPointParam, parsePointParam } from "../points";
import { SORT_LABELS, type RouteSearchResponse, type SortKey } from "../types";
import { PlaceSearch } from "./place-search";
import { RouteCard, type RouteTag } from "./route-card";
import { RouteDetails } from "./route-details";
import { TripMode } from "@/features/trip/trip-mode";
import { useAds } from "@/features/ads/ads";

/** true em telas largas (lg): os detalhes ficam na coluna da direita; no celular, abaixo do cartão. */
const LG = "(min-width: 1024px)";
function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(LG);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(LG).matches,
    () => false,
  );
}

export function RoutesView() {
  const isDesktop = useIsDesktop();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { announce } = useA11y();
  const qc = useQueryClient();
  const ads = useAds();
  /** No plano grátis, um anúncio aparece antes de o trajeto começar. */
  const startTrip = (id: string) => ads.request(() => setTripId(id));
  const [origin, setOrigin] = useState<GeoPoint | null>(() => parsePointParam(params.get("o")));
  const [destination, setDestination] = useState<GeoPoint | null>(() => parsePointParam(params.get("d")));
  const [sort, setSort] = useState<SortKey>("fastest");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Rota aberta no modo "em trajeto" (mapa guiando a viagem). */
  const [tripId, setTripId] = useState<string | null>(null);

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

  // selos e explicações ("Por que esta rota?") por rota
  const { tagsFor, whyFor } = useMemo(() => {
    const tags = new Map<string, RouteTag[]>();
    const why = new Map<string, string[]>();
    const add = (rec: { routeId: string; reasons: string[] } | undefined, t: RouteTag) => {
      if (!rec) return;
      tags.set(rec.routeId, [...(tags.get(rec.routeId) ?? []), t]);
      why.set(rec.routeId, [...(why.get(rec.routeId) ?? []), `${t}: ${rec.reasons.join(" ")}`]);
    };
    if (data) {
      add(data.recommendations.fastest, "Mais rápida");
      add(data.recommendations.fewerTransfers, "Menos baldeações");
      add(data.recommendations.lowerRisk, "Menor risco estimado");
      add(data.recommendations.balanced, "Equilibrada");
    }
    return { tagsFor: tags, whyFor: why };
  }, [data]);
  const riskNote = data?.recommendations.notes.lowerRisk;

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FAVORITES_KEY });
      toast.success("Trajeto salvo em Salvos.");
      announce("Trajeto salvo em Salvos.");
    },
    onError: (e) => {
      const msg = `Não foi possível salvar o trajeto. ${(e as Error).message || ""} Toque em Salvar trajeto para tentar de novo.`.replace(/s+/g, " ");
      toast.error(msg);
      announce(msg);
    },
  });

  const details =
    selected && origin && destination ? (
      <RouteDetails
        route={selected}
        origin={origin}
        destination={destination}
        onClose={() => setSelectedId(null)}
        onSave={() => save.mutate()}
        saving={save.isPending}
        saved={save.isSuccess}
        onStart={selected.steps.some((s) => s.kind === "BUS" && s.legStops?.length) ? () => startTrip(selected.id) : undefined}
      />
    ) : null;

  const tripRoute = data?.routes.find((r) => r.id === tripId) ?? null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 pb-4 pt-2">
      {tripRoute && origin && destination && <TripMode route={tripRoute} origin={origin} destination={destination} onClose={() => setTripId(null)} />}
      <header>
        <h1 className="text-[30px] font-extrabold leading-tight tracking-tight">Para onde vamos?</h1>
        <p className="mt-1 text-sm text-muted">Viagens de ônibus, com caminhada até as paradas e nas baldeações.</p>
      </header>

      <PlaceSearch
        origin={origin}
        destination={destination}
        onOrigin={(p) => {
          setOrigin(p);
          setSelectedId(null);
        }}
        onDestination={(p) => {
          setDestination(p);
          setSelectedId(null);
        }}
      >
        <div className="no-scrollbar mt-1 flex gap-2 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="Ordenar por">
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={sort === k}
              onClick={() => setSort(k)}
              className={cn("tap shrink-0 rounded-full px-4 py-2 text-xs font-semibold", sort === k ? "bg-night text-white" : "bg-canvas text-ink")}
            >
              {SORT_LABELS[k]}
            </button>
          ))}
        </div>
      </PlaceSearch>

      {(!origin || !destination) && <EmptyState title="Escolha uma origem e um destino" description="Escolha dois locais da lista para comparar rotas de ônibus." />}

      {search.isFetching && !data && (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-40 w-full rounded-3xl" />
          <Skeleton className="h-40 w-full rounded-3xl" />
        </div>
      )}

      {search.isError && <ErrorState message="A busca de rotas está indisponível agora. Tente novamente em instantes." onRetry={() => search.refetch()} />}

      {data && data.routes.length === 0 && (
        <EmptyState
          title="Nenhuma rota de ônibus encontrada."
          description={
            data.isDemo
              ? "A rede de demonstração cobre apenas algumas viagens entre os locais da lista. Tente outra origem ou outro destino."
              : (data.notice ?? "Não encontramos uma viagem de ônibus com até uma baldeação entre esses locais. Tente um destino próximo a um terminal ou outra origem.")
          }
        />
      )}

      {data && data.routes.length > 0 && (
        <>
          {data.notice && (
            <p role="status" className="flex items-start gap-2 rounded-2xl bg-white p-3 text-sm text-muted shadow-soft">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {data.notice}
            </p>
          )}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <ul className="space-y-3" aria-label="Opções de rota">
              {data.routes.map((r) => (
                <li key={r.id} className="space-y-3">
                  <RouteCard
                    route={r}
                    tags={tagsFor.get(r.id) ?? []}
                    why={[...(whyFor.get(r.id) ?? []), ...(riskNote ? [`Risco de lotação: ${riskNote}`] : [])]}
                    selected={r.id === selectedId}
                    onView={() => {
                      save.reset();
                      setSelectedId(r.id === selectedId ? null : r.id);
                    }}
                    onStart={r.steps.some((s) => s.kind === "BUS" && s.legStops?.length) ? () => startTrip(r.id) : undefined}
                    origin={origin?.label ?? "Origem"}
                    destination={destination?.label ?? "Destino"}
                  />
                  {/* no celular, os detalhes abrem logo abaixo do cartão escolhido */}
                  {r.id === selectedId && !isDesktop && details}
                </li>
              ))}
            </ul>
            <div className="hidden lg:block">
              {(isDesktop && details) || <EmptyState title="Escolha uma rota" description="Toque em Ver detalhes ou em Iniciar trajeto em um cartão." />}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
