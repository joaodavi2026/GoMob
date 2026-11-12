"use client";

import { useState } from "react";
import { ArrowUpDown, Flag, Info, LocateFixed, MapPin } from "lucide-react";
import { Combobox, type ComboOption } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast";
import type { GeoPoint } from "@/types/transit";
import { findPlace, KNOWN_PLACES, placeToPoint } from "../places";

const OPTIONS: ComboOption[] = KNOWN_PLACES.map((p) => ({ value: p.id, label: p.label }));

/**
 * Campos "De / Para" usados na Início e em Rotas (mesmo componente, mesma lista de locais).
 * A demonstração só calcula rotas entre os locais pré-definidos, e isso aparece antes da busca.
 */
export function PlaceSearch({
  origin,
  destination,
  onOrigin,
  onDestination,
  children,
}: {
  origin: GeoPoint | null;
  destination: GeoPoint | null;
  onOrigin: (p: GeoPoint | null) => void;
  onDestination: (p: GeoPoint | null) => void;
  /** Conteúdo extra no fim do cartão (ex.: botão Buscar rotas, ordenação). */
  children?: React.ReactNode;
}) {
  const toast = useToast();
  const [oq, setOq] = useState(origin?.label ?? "");
  const [dq, setDq] = useState(destination?.label ?? "");
  const [locating, setLocating] = useState(false);

  function swap() {
    onOrigin(destination);
    onDestination(origin);
    setOq(dq);
    setDq(oq);
  }

  function locate() {
    if (!("geolocation" in navigator)) return toast.error("Este aparelho não informa a localização.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const p: GeoPoint = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, label: "Minha localização" };
        onOrigin(p);
        setOq(p.label!);
      },
      (err) => {
        setLocating(false);
        toast.error(err.code === err.PERMISSION_DENIED ? "Permissão de localização negada. Escolha um local da lista." : "Não foi possível obter sua localização.");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  function pickQuick(id: string) {
    const p = findPlace(id);
    if (!p) return;
    if (!origin) {
      onOrigin(placeToPoint(p));
      setOq(p.label);
    } else {
      onDestination(placeToPoint(p));
      setDq(p.label);
    }
  }

  const row = "relative flex items-center gap-3 rounded-3xl bg-canvas px-4 py-3";
  return (
    <div className="rounded-[28px] bg-white p-2 shadow-soft">
      <p className="mx-2 mb-2 mt-1 flex items-start gap-1.5 text-xs text-muted">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Rotas pela rede real da SPTrans (horário programado). Escolha um local da lista ou use sua localização.
      </p>
      <div className="relative space-y-2">
        <div className={row}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-primary shadow-soft">
            <MapPin className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 pr-12">
            <p className="text-xs font-medium text-muted">De</p>
            <Combobox
              bare
              label="De onde você sai?"
              placeholder="De onde você sai?"
              options={OPTIONS}
              query={oq}
              onQueryChange={setOq}
              onSelect={(o) => {
                const p = findPlace(o.value);
                if (p) onOrigin(placeToPoint(p));
                setOq(o.label);
              }}
              emptyText="Nenhum local da demonstração com esse nome."
            />
          </div>
        </div>
        <div className={row}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-night text-white">
            <Flag className="h-[17px] w-[17px]" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 pr-12">
            <p className="text-xs font-medium text-muted">Para</p>
            <Combobox
              bare
              label="Para onde vamos?"
              placeholder="Para onde vamos?"
              options={OPTIONS}
              query={dq}
              onQueryChange={setDq}
              onSelect={(o) => {
                const p = findPlace(o.value);
                if (p) onDestination(placeToPoint(p));
                setDq(o.label);
              }}
              emptyText="Nenhum local da demonstração com esse nome."
            />
          </div>
        </div>
        <button
          type="button"
          onClick={swap}
          aria-label="Inverter origem e destino"
          className="tap absolute right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink shadow-soft ring-1 ring-border"
        >
          <ArrowUpDown className="h-[18px] w-[18px]" aria-hidden />
        </button>
      </div>

      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          className="tap flex shrink-0 items-center gap-1.5 rounded-full bg-primary-light px-3 py-2 text-xs font-semibold text-primary-pressed disabled:opacity-60"
        >
          <LocateFixed className="h-3.5 w-3.5" aria-hidden />
          {locating ? "Localizando..." : "Usar minha localização"}
        </button>
        {KNOWN_PLACES.slice(0, 8).map((p) => (
          <button key={p.id} type="button" onClick={() => pickQuick(p.id)} className="tap shrink-0 rounded-full bg-canvas px-3 py-2 text-xs font-medium text-ink">
            {p.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
