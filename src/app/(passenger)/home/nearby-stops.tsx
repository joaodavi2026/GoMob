"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Footprints, LocateFixed, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { useNetwork, useNetworkIndex } from "@/features/network/data";

type Here = { latitude: number; longitude: number; label: string; real: boolean };

/** Ponto de referência enquanto a localização não é ativada (deixado explícito na tela). */
const FALLBACK: Here = { latitude: -23.5616, longitude: -46.6557, label: "MASP - Av. Paulista", real: false };

function meters(a: { latitude: number; longitude: number }, lat: number, lon: number) {
  const R = 6_371_000;
  const dLat = ((lat - a.latitude) * Math.PI) / 180;
  const dLon = ((lon - a.longitude) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.latitude * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Pontos próximos: nome, distância a pé e linhas que passam (GTFS da SPTrans). */
export function NearbyStops() {
  const toast = useToast();
  // a rede GTFS é grande: só começa a carregar depois que a tela inicial já apareceu
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 600);
    return () => clearTimeout(t);
  }, []);
  const net = useNetwork(ready);
  const { stopLines } = useNetworkIndex(net.data);
  const [here, setHere] = useState<Here>(FALLBACK);
  const [locating, setLocating] = useState(false);

  const nearby = useMemo(() => {
    if (!net.data) return [];
    const out: { i: number; d: number }[] = [];
    net.data.stops.forEach((s, i) => {
      if (!stopLines[i]?.length) return;
      const d = meters(here, s[2], s[3]);
      if (d < 1500) out.push({ i, d });
    });
    return out.sort((a, b) => a.d - b.d).slice(0, 5);
  }, [net.data, stopLines, here]);

  function locate() {
    if (!("geolocation" in navigator)) return toast.error("Este aparelho não informa a localização.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        setHere({ latitude: p.coords.latitude, longitude: p.coords.longitude, label: "você", real: true });
      },
      () => {
        setLocating(false);
        toast.error("Não foi possível usar sua localização. Mostrando pontos perto do MASP.");
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  return (
    <section aria-labelledby="nearby-h" className="mt-8">
      <div className="mb-1 flex items-end justify-between gap-3">
        <h2 id="nearby-h" className="text-xl font-bold tracking-tight text-ink">
          Pontos próximos
        </h2>
        <Link href={`/network?stop=${nearby[0] ? net.data!.stops[nearby[0].i][0] : ""}`} className="text-sm font-semibold text-muted hover:text-ink">
          Ver no mapa
        </Link>
      </div>
      <p className="mb-3 flex flex-wrap items-center gap-x-2 text-xs text-muted">
        <span>{here.real ? "Perto de você" : `Perto de ${here.label} (localização não ativada)`}</span>
        {!here.real && (
          <button type="button" onClick={locate} disabled={locating} className="inline-flex items-center gap-1 font-semibold text-primary-pressed disabled:opacity-60">
            <LocateFixed className="h-3.5 w-3.5" aria-hidden /> {locating ? "Localizando..." : "Usar minha localização"}
          </button>
        )}
      </p>
      <ul className="overflow-hidden rounded-3xl bg-white shadow-soft">
        {!net.data
          ? Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="p-4">
                <Skeleton className="h-10 w-full rounded-2xl" />
              </li>
            ))
          : nearby.length === 0
            ? <li className="p-5 text-center text-sm text-muted">Nenhum ponto de ônibus a menos de 1,5 km.</li>
            : nearby.map(({ i, d }) => {
                const s = net.data!.stops[i];
                const lines = (stopLines[i] ?? []).map((li) => net.data!.lines[li]);
                const walk = Math.max(1, Math.round(d / 80));
                return (
                  <li key={s[0]} className="border-b border-border last:border-0">
                    <Link href={`/network?stop=${encodeURIComponent(s[0])}`} className="flex items-center gap-3 p-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-primary">
                        <MapPin className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-ink">{s[1]}</span>
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                          <Footprints className="h-3.5 w-3.5" aria-hidden /> {Math.round(d)} m · {walk} min a pé · {lines.length} {lines.length === 1 ? "linha" : "linhas"}
                        </span>
                        <span className="mt-1.5 flex flex-wrap gap-1">
                          {lines.slice(0, 4).map((l) => (
                            <span key={l.id} className="rounded-md px-1.5 py-0.5 text-[11px] font-bold" style={{ background: l.color, color: l.textColor }}>
                              {l.code}
                            </span>
                          ))}
                          {lines.length > 4 && <span className="px-1 text-[11px] font-semibold text-muted">+{lines.length - 4}</span>}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
      </ul>
    </section>
  );
}
