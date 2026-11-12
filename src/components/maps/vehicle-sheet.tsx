"use client";

import Link from "next/link";
import { AlertTriangle, Bus, X } from "lucide-react";
import { DemoBadge, Badge } from "@/components/ui/primitives";
import { RiskIndicator } from "@/components/ui/indicators";
import { classifyFreshness, formatAge } from "@/server/transit/freshness";
import type { TransitLine, TransitVehicle } from "@/types/transit";
import { useLineRisk } from "./use-transit";

const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(iso));

/** Bottom sheet de detalhes do ônibus (mobile-first; vira cartão lateral em telas largas). */
export function VehicleSheet({ vehicle, line, now, onClose }: { vehicle: TransitVehicle; line?: TransitLine; now: number; onClose: () => void }) {
  const freshness = classifyFreshness(vehicle.observedAt, now);
  const risk = useLineRisk(vehicle.lineId);
  const stale = freshness !== "FRESH";
  return (
    <section
      role="dialog"
      aria-label="Detalhes do ônibus"
      className="safe-bottom absolute inset-x-0 bottom-0 z-20 max-h-[70%] overflow-y-auto rounded-t-2xl border-t border-border bg-white p-4 shadow-soft sm:inset-x-auto sm:bottom-3 sm:right-3 sm:top-auto sm:w-96 sm:rounded-2xl sm:border"
    >
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border sm:hidden" aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[3px] border-primary bg-white">
            <Bus className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{line ? `Linha ${line.displayCode}` : "Ônibus"}</h2>
            {line && <p className="truncate text-sm text-muted">{line.name}</p>}
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar detalhes" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-canvas">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {stale && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-risk-moderate/10 p-3 text-sm text-ink" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-risk-moderate" aria-hidden />
          {freshness === "UNAVAILABLE"
            ? "Esta posição tem um horário inválido e não pode ser confirmada."
            : `Última posição conhecida, observada ${formatAge(vehicle.observedAt, now)}. Pode não refletir onde o ônibus está agora.`}
        </p>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Sentido</dt>
          <dd className="font-medium">{line ? (line.direction === 1 ? "Terminal principal → secundário" : "Terminal secundário → principal") : "Desconhecido"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">ID do veículo</dt>
          <dd className="font-medium">{vehicle.id}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Horário da posição (São Paulo)</dt>
          <dd className="font-medium tabular-nums">{Number.isNaN(Date.parse(vehicle.observedAt)) ? "Desconhecido" : fmtTime(vehicle.observedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Situação da informação</dt>
          <dd>
            <Badge tone={stale ? "moderate" : "low"}>{stale ? "Desatualizada" : "Atualizada"}</Badge>
          </dd>
        </div>
      </dl>

      <div className="mt-3">
        <p className="text-xs text-muted">Risco de lotação estimado</p>
        {risk.isLoading ? (
          <p className="text-sm text-muted">Carregando…</p>
        ) : risk.data ? (
          <RiskIndicator level={risk.data.level} score={risk.data.score} />
        ) : (
          <p className="text-sm text-muted">Dados insuficientes para estimar o risco de lotação.</p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        {vehicle.source === "DEMO" ? <DemoBadge /> : <Badge tone="neutral">Fonte: SPTrans Olho Vivo</Badge>}
        <Link href={`/map?line=${encodeURIComponent(vehicle.lineId)}`} className="text-sm font-semibold text-primary-pressed hover:underline">
          Ver detalhes da linha
        </Link>
      </div>
    </section>
  );
}
