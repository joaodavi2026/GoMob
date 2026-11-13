"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Footprints, LocateFixed, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api";
import { geoErrorText, locate as locateDevice } from "@/lib/geo";
import { ArrivalsBoard, StopSheet, type StopArrivals } from "./stop-arrivals";

type Here = { lat: number; lon: number; label: string; real: boolean };
type Near = { stops: (StopArrivals & { meters: number })[]; outside?: string | null };

/** Ponto de referência enquanto a localização não é ativada (deixado explícito na tela). */
const FALLBACK: Here = { lat: -23.5616, lon: -46.6557, label: "MASP - Av. Paulista", real: false };

/** "Ao redor": pontos de ônibus próximos com as próximas chegadas em tempo real. */
export function Around() {
  const toast = useToast();
  const [here, setHere] = useState<Here>(FALLBACK);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [stopId, setStopId] = useState<string | null>(null);
  // deixa a tela inicial aparecer antes de buscar as chegadas
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 500);
    return () => clearTimeout(t);
  }, []);

  const near = useQuery({
    queryKey: ["stops-nearby", here.lat.toFixed(4), here.lon.toFixed(4)],
    enabled: ready,
    refetchInterval: 30_000,
    queryFn: () => apiFetch<Near>(`/api/stops/nearby?lat=${here.lat}&lon=${here.lon}`),
  });

  async function locate() {
    setLocating(true);
    setGeoError(null);
    try {
      const p = await locateDevice();
      setHere({ lat: p.lat, lon: p.lon, label: "você", real: true });
    } catch (e) {
      const msg = geoErrorText(e);
      setGeoError(msg);
      toast.error(msg);
    } finally {
      setLocating(false);
    }
  }

  const stops = near.data?.stops ?? [];

  return (
    <section aria-labelledby="around-h" className="mt-8">
      <h2 id="around-h" className="text-xl font-bold tracking-tight text-ink">
        Ao redor
      </h2>
      <p className="mb-3 mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">
        <span>{here.real ? "Pontos perto de você" : `Pontos perto de ${here.label} (localização não ativada)`}</span>
        {!here.real && (
          <button type="button" onClick={locate} disabled={locating} className="inline-flex h-9 items-center gap-1 font-semibold text-primary-pressed disabled:opacity-60">
            <LocateFixed className="h-3.5 w-3.5" aria-hidden /> {locating ? "Localizando..." : "Usar minha localização"}
          </button>
        )}
      </p>

      {geoError && (
        <p role="alert" className="mb-3 rounded-2xl bg-primary-light px-3 py-2 text-sm text-primary-pressed">
          {geoError}
        </p>
      )}
      {near.data?.outside && (
        <div role="status" className="mb-3 rounded-2xl bg-primary-light px-3 py-2 text-sm text-primary-pressed">
          <p>{near.data.outside}</p>
          <button type="button" onClick={() => setHere(FALLBACK)} className="mt-1 h-9 font-bold underline underline-offset-4">
            Ver pontos perto do MASP
          </button>
        </div>
      )}
      {!near.data && !near.isError ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-36 w-full rounded-3xl" />
          <Skeleton className="h-36 w-full rounded-3xl" />
        </div>
      ) : near.isError ? (
        <p className="rounded-3xl bg-white p-5 text-center text-sm text-muted shadow-soft">Não foi possível carregar os pontos próximos agora.</p>
      ) : stops.length === 0 ? (
        !near.data?.outside && <p className="rounded-3xl bg-white p-5 text-center text-sm text-muted shadow-soft">Nenhum ponto de ônibus a menos de 1,2 km.</p>
      ) : (
        <ul className="space-y-3">
          {stops.slice(0, 3).map((s) => (
            <li key={s.stop.id} className="rounded-3xl bg-white p-4 shadow-soft">
              <button type="button" onClick={() => setStopId(s.stop.id)} className="flex w-full items-center gap-3 text-left">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-primary">
                  <MapPin className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-[15px] font-extrabold leading-snug text-ink">{s.stop.name}</span>
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <Footprints className="h-3.5 w-3.5" aria-hidden /> {s.meters} m · {Math.max(1, Math.round(s.meters / 80))} min a pé
                  </span>
                </span>
                <span className="flex shrink-0 items-center text-xs font-bold text-primary-pressed">
                  Ver todas <ChevronRight className="h-4 w-4" aria-hidden />
                </span>
              </button>
              <div className="mt-2 border-t border-border pt-2">
                <ArrivalsBoard data={s} limit={3} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <StopSheet stopId={stopId} onClose={() => setStopId(null)} />
    </section>
  );
}
