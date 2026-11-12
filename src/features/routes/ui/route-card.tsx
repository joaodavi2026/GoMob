"use client";

import { Bus, Clock, Footprints, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, DemoBadge } from "@/components/ui/primitives";
import { RiskBadge } from "@/components/ui/risk-badge";
import { cn } from "@/lib/utils";
import { busLineCodes } from "../risk";
import type { RouteResult } from "../types";

export type RouteTag = "Mais rápida" | "Menos baldeações" | "Menor risco estimado" | "Equilibrada";

const SOURCE_LABEL: Record<RouteResult["source"], string> = { DEMO: "Rota de demonstração", GTFS: "Horário GTFS", GOOGLE: "Google Routes" };

function time(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "desconhecido" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function RouteCard({
  route,
  tags,
  selected,
  onView,
  origin,
  destination,
}: {
  route: RouteResult;
  tags: RouteTag[];
  selected: boolean;
  onView: () => void;
  origin: string;
  destination: string;
}) {
  const codes = busLineCodes(route);
  return (
    <Card className={cn("overflow-hidden p-0 transition-shadow", selected && "ring-2 ring-primary")}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[28px] font-extrabold leading-none tracking-tight text-ink">
              {route.durationMinutes !== null ? route.durationMinutes : "—"}
              <span className="ml-1 text-sm font-semibold text-muted">min</span>
            </p>
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {tags.map((t) => (
                  <Badge key={t} tone="primary" className="border-0 px-2 py-0.5 text-[11px]">{t}</Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1">
            {codes.map((c, i) => (
              <span key={c} className="flex items-center gap-1">
                {i > 0 && <span className="text-xs text-muted" aria-hidden>›</span>}
                <span className="flex items-center gap-1 rounded-xl bg-night px-2 py-1 text-xs font-bold text-white">
                  <Bus className="h-3 w-3 text-primary" aria-hidden />
                  {c}
                </span>
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <div className="flex flex-col items-center pt-1" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full border-2 border-primary" />
            <span className="my-1 w-0.5 flex-1 rounded-full bg-primary/30" />
            <span className="h-2.5 w-2.5 rounded-full bg-night" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="truncate text-sm font-semibold text-ink">{origin}</p>
            <p className="truncate text-sm font-semibold text-ink">{destination}</p>
          </div>
        </div>
      </div>

      <div className="relative border-t border-dashed border-border px-4 py-3">
        <span className="absolute -left-2.5 -top-2.5 h-5 w-5 rounded-full bg-canvas" aria-hidden />
        <span className="absolute -right-2.5 -top-2.5 h-5 w-5 rounded-full bg-canvas" aria-hidden />
        <dl className="flex items-center gap-4 text-xs text-muted">
          <div className="flex items-center gap-1">
            <dt><Footprints className="h-3.5 w-3.5" aria-label="Caminhada" /></dt>
            <dd className="font-semibold text-ink">{route.walkMinutes} min</dd>
          </div>
          <div className="flex items-center gap-1">
            <dt><Repeat className="h-3.5 w-3.5" aria-label="Baldeações" /></dt>
            <dd className="font-semibold text-ink">{route.transfers} {route.transfers === 1 ? "baldeação" : "baldeações"}</dd>
          </div>
          <div className="ml-auto">{route.risk ? <RiskBadge level={route.risk.level} /> : <RiskBadge level="INSUFFICIENT_DATA" />}</div>
        </dl>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted">
          <Clock className="h-3 w-3" aria-hidden /> Dados de {time(route.dataTimestamp)} · {SOURCE_LABEL[route.source]}
          {route.source === "DEMO" && <DemoBadge label="Demonstração" />}
        </div>
        <Button className="mt-3 w-full" variant={selected ? "primary" : "dark"} onClick={onView} aria-pressed={selected}>
          {selected ? "Vendo rota" : "Ver rota"}
        </Button>
      </div>
    </Card>
  );
}
