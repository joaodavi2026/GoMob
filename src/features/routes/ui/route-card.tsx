"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Bus, ChevronDown, Clock, Footprints, HelpCircle, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, DemoBadge } from "@/components/ui/primitives";
import { RiskBadge } from "@/components/ui/risk-badge";
import { cn } from "@/lib/utils";
import { busLineCodes } from "../risk";
import type { RouteResult } from "../types";

export type RouteTag = "Mais rápida" | "Menos baldeações" | "Menor risco estimado" | "Equilibrada";

const SOURCE_LABEL: Record<RouteResult["source"], string> = { DEMO: "Rota de demonstração", GTFS: "Horário programado da SPTrans (GTFS)", GOOGLE: "Google Routes" };

function time(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "desconhecido" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function RouteCard({
  route,
  tags,
  why = [],
  selected,
  onView,
  origin,
  destination,
}: {
  route: RouteResult;
  tags: RouteTag[];
  why?: string[];
  selected: boolean;
  onView: () => void;
  origin: string;
  destination: string;
}) {
  const codes = busLineCodes(route);
  const [whyOpen, setWhyOpen] = useState(false);
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
                <span className="flex items-center gap-1 whitespace-nowrap rounded-xl bg-night px-2 py-1 text-xs font-bold text-white">
                  <Bus className="h-3 w-3 text-primary" aria-hidden />
                  {c}
                </span>
              </span>
            ))}
          </div>
        </div>

        <p className="mt-3 truncate text-xs text-muted">
          {origin} → {destination}
        </p>

        {/* passo a passo direto no cartão: funciona mesmo sem mapa */}
        <ol className="mt-3 space-y-2" aria-label="Passo a passo">
          {route.steps.map((s, i) =>
            s.kind === "WALK" ? (
              <li key={i} className="flex items-center gap-2.5 text-sm text-muted">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-canvas">
                  <Footprints className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  Caminhe {s.minutes} min até <strong className="font-semibold text-ink">{s.to}</strong>
                </span>
              </li>
            ) : (
              <li key={i} className="rounded-2xl bg-primary-light/60 p-3">
                <p className="flex items-center gap-2 text-sm font-bold text-ink">
                  <span className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-night px-2 py-0.5 text-xs text-white">
                    <Bus className="h-3.5 w-3.5 text-primary" aria-hidden /> {s.lineCode}
                  </span>
                  <span className="min-w-0 truncate">{s.lineName}</span>
                </p>
                <p className="mt-2 flex items-start gap-1.5 text-sm text-ink">
                  <ArrowUpFromLine className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span>
                    <span className="text-muted">Embarque em</span> <strong className="font-semibold">{s.boardStop}</strong>
                  </span>
                </p>
                <p className="mt-1 flex items-start gap-1.5 text-sm text-ink">
                  <ArrowDownToLine className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span>
                    <span className="text-muted">Desça em</span> <strong className="font-semibold">{s.alightStop}</strong>
                    <span className="text-muted"> · {s.minutes} min</span>
                  </span>
                </p>
              </li>
            ),
          )}
        </ol>

        {why.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setWhyOpen((o) => !o)}
              aria-expanded={whyOpen}
              className="flex items-center gap-1 text-sm font-semibold text-primary-pressed"
            >
              <HelpCircle className="h-4 w-4" aria-hidden /> Por que esta rota?
              <ChevronDown className={cn("h-4 w-4 transition-transform", whyOpen && "rotate-180")} aria-hidden />
            </button>
            {whyOpen && (
              <ul className="mt-2 space-y-1.5 rounded-2xl bg-canvas p-3 text-sm text-muted">
                {why.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        )}
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
          {selected ? "Fechar detalhes" : "Ver rota e mapa"}
        </Button>
      </div>
    </Card>
  );
}
