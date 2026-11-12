"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Badge, Card, DemoBadge, EmptyState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { RiskBadge } from "@/components/ui/risk-badge";
import { useToast } from "@/components/ui/toast";
import type { AdminLine } from "@/features/admin/lines";
import type { RiskResult } from "@/types/transit";
import { PageIntro, Section, formatDateTime } from "@/components/admin/ui";

type Prediction = { risk: RiskResult; dataQuality?: string | number | null; historicalSource?: string | null; limitations?: string[]; isDemo?: boolean };

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AdminPredictionsPage() {
  const toast = useToast();
  const [lineId, setLineId] = useState("");
  const [date, setDate] = useState(todayLocal);
  const [time, setTime] = useState("08:00");

  const lines = useQuery({ queryKey: ["admin", "lines", "all-100"], queryFn: () => apiFetch<{ lines: AdminLine[] }>("/api/admin/lines?pageSize=100") });

  const run = useMutation({
    mutationFn: () => apiFetch<{ prediction: Prediction }>(`/api/predict?${new URLSearchParams({ lineId, date, time })}`),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível calcular a previsão."),
  });

  const p = run.data?.prediction;
  const input = "h-11 rounded-xl border border-border bg-white px-3 text-sm";

  return (
    <div className="space-y-4">
      <PageIntro>
        <span>Execute uma previsão de risco para uma linha, data e horário. O resultado é uma estimativa hipotética baseada nos sinais disponíveis.</span>
      </PageIntro>

      <Section title="Parâmetros da previsão">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (lineId) run.mutate();
          }}
        >
          <label className="text-sm">
            <span className="mb-1 block text-muted">Linha</span>
            <select className={`${input} w-64 max-w-full`} value={lineId} onChange={(e) => setLineId(e.target.value)} required>
              <option value="">Selecione uma linha</option>
              {(lines.data?.lines ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.displayCode} — {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Data</span>
            <input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Horário</span>
            <input type="time" className={input} value={time} onChange={(e) => setTime(e.target.value)} required />
          </label>
          <Button type="submit" loading={run.isPending} disabled={!lineId}>
            Executar previsão
          </Button>
        </form>
      </Section>

      {!p ? (
        <EmptyState title="Nenhuma previsão ainda" description="Escolha uma linha e execute uma previsão para ver o resultado, a qualidade dos dados e as limitações." />
      ) : (
        <Card className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <RiskBadge level={p.risk.level} />
            {p.isDemo && <DemoBadge />}
            <Badge tone="neutral">Pontuação {p.risk.score != null ? Math.round(p.risk.score) : "—"}</Badge>
            <Badge tone="neutral">Confiança {p.risk.confidence != null ? `${Math.round(p.risk.confidence * 100)}%` : "—"}</Badge>
          </div>
          <p className="text-sm">{p.risk.explanation}</p>
          <dl className="grid gap-3 text-sm sm:grid-cols-4">
            {(
              [
                ["Demanda", p.risk.factors.demand],
                ["Intervalo", p.risk.factors.headway],
                ["Atraso", p.risk.factors.delay],
                ["Operação", p.risk.factors.operations],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-canvas p-3">
                <dt className="text-muted">{k}</dt>
                <dd className="text-lg font-semibold tabular-nums">{v == null ? "n/d" : Math.round(v)}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted">
            Calculado em {formatDateTime(p.risk.calculatedAt)} · Qualidade dos dados: {p.dataQuality ?? "n/d"} · Fonte histórica: {p.historicalSource ?? "n/d"}
          </p>
          {p.limitations && p.limitations.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
              {p.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
