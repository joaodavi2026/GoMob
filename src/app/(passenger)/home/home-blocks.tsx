"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRight, Bell, Bus, ChevronRight, Clock, Compass, MapPin, Radio, Ticket, TrainFront, TramFront } from "lucide-react";
import { useMe } from "@/components/layout/hooks";
import { UserMenu } from "@/components/layout/passenger-shell";
import { configureMaplibreWorker } from "@/components/maps/maplibre-worker";
import { Skeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { BusArt } from "./bus-art";
import { networkHref, useHighlights, type LineSummary } from "./highlights";

const fmt = (n: number) => n.toLocaleString("pt-BR");
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function HomeHeader() {
  const { data: me } = useMe();
  const name = me?.name?.trim();
  return (
    <header className="flex items-center justify-between gap-3 pt-4">
      <div className="flex min-w-0 items-center gap-3">
        <UserMenu className="h-12 w-12" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">
            Olá{name ? `, ${name}` : ""} 👋
          </p>
          <p className="flex items-center gap-1 text-xs text-muted">
            <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden /> São Paulo, SP
          </p>
        </div>
      </div>
      <a href="#updates" aria-label="Avisos ao vivo" className="tap relative flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-soft">
        <Bell className="h-5 w-5 text-ink" aria-hidden />
        <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-primary ring-2 ring-white" />
      </a>
    </header>
  );
}

export function HomeTitle() {
  return (
    <h1 className="rise mt-6 text-[34px] leading-[1.08] tracking-tight text-ink">
      <span className="font-light text-muted">Explore</span>
      <br />
      <span className="font-extrabold">
        Vá a qualquer lugar de <span className="text-primary">SP</span>?
      </span>
    </h1>
  );
}

const MODES = [
  { href: "/network?mode=3", label: "Ônibus", icon: Bus },
  { href: "/network?mode=1", label: "Metrô", icon: TramFront },
  { href: "/network?mode=2", label: "Trem", icon: TrainFront },
  { href: "/map", label: "Ao vivo", icon: Radio },
];

export function ModePills() {
  return (
    <nav aria-label="Meios de transporte" className="no-scrollbar -mx-5 mt-5 flex gap-2 overflow-x-auto px-5">
      {MODES.map(({ href, label, icon: Icon }, i) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "tap flex h-12 shrink-0 items-center gap-2 rounded-full pl-1.5 pr-4 text-sm font-semibold shadow-soft",
            i === 0 ? "bg-primary text-white" : "bg-white text-ink",
          )}
        >
          <span className={cn("flex h-9 w-9 items-center justify-center rounded-full", i === 0 ? "bg-white text-primary" : "bg-canvas text-ink")}>
            <Icon className="h-[18px] w-[18px]" aria-hidden />
          </span>
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** Cartão escuro principal (inspirado em "Las Vegas Station"): a rede inteira em um toque. */
export function NetworkHero() {
  const h = useHighlights();
  const c = h.data?.counts;
  return (
    <Link
      href="/network"
      className="tap group relative mt-5 block overflow-hidden rounded-[28px] bg-night p-5 text-white shadow-float"
      aria-label="Explorar o mapa da rede de transporte de São Paulo"
    >
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-10 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex flex-wrap gap-2">
        <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium">{c ? `${fmt(c.bus)} linhas de ônibus` : "SPTrans GTFS"}</span>
        <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium">{c ? `${fmt(c.stops)} paradas` : "Mapa ao vivo"}</span>
      </div>
      <div className="relative mt-4 flex items-end justify-between gap-2">
        <h2 className="max-w-[55%] text-[26px] font-bold leading-[1.1] tracking-tight">
          Rede de
          <br />
          <span className="font-light text-white/70">São Paulo</span>
        </h2>
        <BusArt className="-mb-2 -mr-10 w-[62%] max-w-[260px] shrink-0 [animation:gomob-drive_2.4s_ease-in-out_infinite] motion-reduce:animate-none" />
      </div>
      <div className="relative mt-4 flex h-14 items-center gap-2 rounded-full bg-white/[0.08] p-1.5 pr-4 ring-1 ring-white/10">
        <span className="flex h-11 items-center gap-2 rounded-full bg-primary pl-1.5 pr-4 text-sm font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-primary">
            <Compass className="h-[18px] w-[18px]" aria-hidden />
          </span>
          Explorar mapa
        </span>
        <span className="flex flex-1 items-center gap-0.5 text-white" aria-hidden>
          {[0, 1, 2].map((i) => (
            <ChevronRight key={i} className="h-4 w-4 [animation:gomob-nudge_1.4s_ease-in-out_infinite] motion-reduce:animate-none" style={{ animationDelay: `${i * 0.18}s` }} />
          ))}
        </span>
        <ArrowRight className="h-5 w-5 text-white/70 transition-transform group-hover:translate-x-1" aria-hidden />
      </div>
    </Link>
  );
}

export function SectionTitle({ title, href, link = "Ver tudo", id }: { title: string; href?: string; link?: string; id?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 id={id} className="text-xl font-bold tracking-tight text-ink">
        {title}
      </h2>
      {href && (
        <Link href={href} className="flex items-center gap-0.5 text-sm font-semibold text-muted hover:text-ink">
          {link} <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function LineCode({ l, className }: { l: Pick<LineSummary, "code" | "color" | "textColor">; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-lg px-2 py-1 text-xs font-bold tabular-nums", className)} style={{ background: l.color, color: l.textColor }}>
      {l.code}
    </span>
  );
}

/** Carrossel horizontal das linhas de ônibus mais frequentes. */
export function PopularLines() {
  const h = useHighlights();
  return (
    <section aria-labelledby="pop-h" className="mt-8">
      <SectionTitle id="pop-h" title="Linhas mais frequentes" href="/network" link="Mapa" />
      <div className="no-scrollbar snap-row -mx-5 flex gap-3 overflow-x-auto px-5 pb-2">
        {!h.data
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[172px] w-[240px] shrink-0 rounded-3xl" />)
          : h.data.popular.map((l) => (
              <Link key={l.code} href={networkHref(l.code)} className="tap flex w-[240px] shrink-0 flex-col rounded-3xl bg-white p-4 shadow-soft">
                <div className="flex items-center justify-between">
                  <LineCode l={l} />
                  <span className="flex items-center gap-1 rounded-full bg-risk-low/10 px-2 py-1 text-[11px] font-semibold text-risk-low">
                    <Clock className="h-3 w-3" aria-hidden /> a cada {l.minHeadway} min
                  </span>
                </div>
                <div className="mt-4 flex gap-3">
                  <div className="flex flex-col items-center pt-1" aria-hidden>
                    <span className="h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: l.color }} />
                    <span className="my-1 w-0.5 flex-1 rounded-full" style={{ background: l.color, opacity: 0.35 }} />
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2.5">
                    <p className="truncate text-sm font-semibold text-ink">{l.from ?? l.name.split(" - ")[0]}</p>
                    <p className="truncate text-sm font-semibold text-ink">{l.to ?? l.name.split(" - ")[1]}</p>
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between border-t border-dashed border-border pt-3 text-xs text-muted">
                  <span>{l.stops} paradas{l.trip ? ` · ${l.trip} min` : ""}</span>
                  {l.fare !== null && <span className="text-base font-bold text-ink">{brl(l.fare)}</span>}
                </div>
              </Link>
            ))}
      </div>
    </section>
  );
}

/** Metrô e CPTM em chips no estilo de diagrama. */
export function RailLines() {
  const h = useHighlights();
  const rail = [...(h.data?.rail ?? [])].sort((a, b) => a.type - b.type || a.code.localeCompare(b.code, "pt-BR", { numeric: true }));
  return (
    <section aria-labelledby="rail-h" className="mt-8">
      <SectionTitle id="rail-h" title="Metrô e trem" href="/network?mode=1" link="No mapa" />
      <ul className="no-scrollbar snap-row -mx-5 flex gap-3 overflow-x-auto px-5 pb-2">
        {!h.data
          ? Array.from({ length: 3 }).map((_, i) => (
              <li key={i}>
                <Skeleton className="h-[148px] w-[150px] rounded-3xl" />
              </li>
            ))
          : rail.map((l) => {
              const num = l.code.replace(/^(METRÔ|CPTM)\s*/i, "").replace(/^L/, "").replace(/^0/, "");
              const [a, b] = l.name.toLowerCase().split(/\s+-\s+/);
              return (
                <li key={l.code} className="shrink-0">
                  <Link href={networkHref(l.code)} className="tap flex h-[148px] w-[150px] flex-col rounded-3xl bg-white p-3.5 shadow-soft">
                    <div className="flex items-center justify-between">
                      <span
                        className="flex h-10 min-w-10 items-center justify-center rounded-full px-2 text-sm font-extrabold"
                        style={{ background: l.color, color: l.color === "#FFFF00" ? "#12151B" : l.textColor }}
                      >
                        {num}
                      </span>
                      {l.type === 1 ? <TramFront className="h-4 w-4 text-muted" aria-label="Metrô" /> : <TrainFront className="h-4 w-4 text-muted" aria-label="Trem da CPTM" />}
                    </div>
                    <p className="mt-3 line-clamp-1 text-[13px] font-semibold capitalize text-ink">{a}</p>
                    {b && <p className="line-clamp-1 text-[13px] font-semibold capitalize text-muted">{b}</p>}
                    <p className="mt-auto text-[11px] text-muted">
                      {l.stops} estações{l.minHeadway ? ` · ${l.minHeadway} min` : ""}
                    </p>
                  </Link>
                </li>
              );
            })}
      </ul>
    </section>
  );
}

/** Mini mapa estático (metrô + trem) que leva ao mapa completo. */
export function MapPreview() {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: import("maplibre-gl").Map | null = null;
    let cancelled = false;
    (async () => {
      const mod = await import("maplibre-gl");
      if (cancelled || !box.current) return;
      const ml = (mod as unknown as { default?: typeof mod }).default ?? mod;
      configureMaplibreWorker(ml);
      map = new ml.Map({
        container: box.current,
        style: "https://tiles.openfreemap.org/styles/positron",
        center: [-46.64, -23.56],
        zoom: 10.2,
        interactive: false,
        attributionControl: false,
      });
      map.on("load", () => {
        map!.addSource("rail", { type: "geojson", data: "/gtfs/rail.geojson" });
        map!.addLayer({
          id: "rail-casing",
          type: "line",
          source: "rail",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#ffffff", "line-width": 6 },
        });
        map!.addLayer({
          id: "rail",
          type: "line",
          source: "rail",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": ["get", "c"], "line-width": 3.5 },
        });
      });
    })().catch(() => {});
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, []);

  return (
    <section aria-labelledby="map-h" className="mt-8">
      <SectionTitle id="map-h" title="Mapa da rede" href="/network" link="Abrir" />
      <Link href="/network" className="tap relative block h-52 overflow-hidden rounded-3xl bg-white shadow-soft" aria-label="Abrir o mapa completo da rede">
        <div ref={box} className="pointer-events-none h-full w-full" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-transparent" />
        <span className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-night py-1.5 pl-1.5 pr-3.5 text-xs font-semibold text-white shadow-float">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
          </span>
          Toque para explorar todas as linhas
        </span>
      </Link>
    </section>
  );
}

export function FareStrip() {
  const h = useHighlights();
  const bus = h.data?.popular[0]?.fare;
  const rail = h.data?.rail[0]?.fare;
  if (!bus && !rail) return null;
  return (
    <div className="mt-5 grid grid-cols-2 gap-3">
      {[
        { label: "Tarifa do ônibus", value: bus, icon: Bus },
        { label: "Metrô e trem", value: rail, icon: Ticket },
      ].map(({ label, value, icon: Icon }) => (
        <div key={label} className="flex items-center gap-3 rounded-3xl bg-white p-3.5 shadow-soft">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-light text-primary">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <span>
            <span className="block text-[11px] text-muted">{label}</span>
            <span className="block text-base font-bold text-ink">{value ? brl(value) : "—"}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
