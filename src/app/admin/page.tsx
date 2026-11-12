"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Badge, ErrorState, Skeleton } from "@/components/ui/primitives";
import type { Overview, ApiStatusLevel } from "@/features/admin/overview";
import { Donut, Legend, Columns, StackedBar, type Slice } from "@/components/admin/charts";
import { Metric, PageIntro, Section, formatDateTime } from "@/components/admin/ui";

type OverviewData = Overview & { dbAvailable: boolean };

const STATUS_LABEL: Record<ApiStatusLevel, { text: string; tone: "low" | "moderate" | "high" | "primary" }> = {
  OK: { text: "Operacional", tone: "low" },
  DEGRADED: { text: "Degradado", tone: "moderate" },
  DOWN: { text: "Indisponível", tone: "high" },
  DEMO: { text: "Provedor de demonstração", tone: "primary" },
};

export default function AdminOverviewPage() {
  const q = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => apiFetch<OverviewData>("/api/admin/overview"),
    refetchInterval: 20_000,
  });

  if (q.isError) return <ErrorState message={q.error instanceof Error ? q.error.message : "Não foi possível carregar a visão geral."} onRetry={() => q.refetch()} />;
  const d = q.data;

  const risk: Slice[] = d
    ? [
        { label: "Baixo", value: d.riskDistribution.LOW, color: "var(--color-risk-low)" },
        { label: "Moderado", value: d.riskDistribution.MODERATE, color: "var(--color-risk-moderate)" },
        { label: "Alto", value: d.riskDistribution.HIGH, color: "var(--color-risk-high)" },
        { label: "Desconhecido / dados insuficientes", value: d.riskDistribution.INSUFFICIENT_DATA, color: "var(--color-risk-unknown)" },
      ]
    : [];
  const fresh: Slice[] = d
    ? [
        { label: "Atualizado (≤ 2 min)", value: d.dataFreshness.FRESH, color: "var(--color-risk-low)" },
        { label: "Desatualizado (≤ 10 min)", value: d.dataFreshness.STALE, color: "var(--color-risk-moderate)" },
        { label: "Indisponível", value: d.dataFreshness.UNAVAILABLE, color: "var(--color-risk-unknown)" },
      ]
    : [];
  const sources = d ? Object.entries(d.linesBySource) : [];
  const status = d ? STATUS_LABEL[d.metrics.apiStatus] : null;

  return (
    <div>
      <PageIntro demo={d?.isDemo}>
        {d && !d.dbAvailable && <Badge tone="moderate">Banco de dados indisponível — valores exibidos como zero</Badge>}
        {d && <span>Última atualização: {formatDateTime(d.generatedAt)}</span>}
      </PageIntro>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Metric label="Linhas monitoradas" value={d?.metrics.monitoredLines} hint={d ? `de ${d.metrics.totalLines} configuradas` : undefined} loading={!d} />
        <Metric label="Veículos rastreados" value={d?.metrics.trackedVehicles} hint="Com observações nos últimos 10 min" loading={!d} />
        <Metric label="Estimativas disponíveis" value={d?.metrics.availableEstimates} hint="Estimativas de risco válidas e não expiradas" loading={!d} />
        <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
          <p className="text-sm text-muted">Status da API</p>
          <div className="mt-2 min-h-9">{status ? <Badge tone={status.tone} className="text-sm">{status.text}</Badge> : <Skeleton className="h-7 w-24" />}</div>
          <p className="mt-2 text-xs text-muted">{d?.mode === "LIVE" ? "MODO AO VIVO" : "MODO DEMONSTRAÇÃO"}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Section title="Distribuição de risco" subtitle="Estimativas não expiradas por nível (pontuação hipotética, não lotação)">
          {d ? (
            <div className="flex flex-wrap items-center gap-6">
              <Donut slices={risk} centerLabel="estimativas" />
              <div className="min-w-44 flex-1">
                <Legend slices={risk} />
              </div>
            </div>
          ) : (
            <Skeleton className="h-36 w-full" />
          )}
        </Section>

        <Section title="Observações recentes" subtitle="Observações de veículos por janela de 10 minutos (última hora)">
          {d ? <Columns data={d.latestObservations} /> : <Skeleton className="h-36 w-full" />}
        </Section>

        <Section title="Linhas monitoradas" subtitle="Monitoramento ativo vs. inativo, por fonte">
          {!d ? (
            <Skeleton className="h-24 w-full" />
          ) : sources.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma linha configurada ainda.</p>
          ) : (
            <ul className="space-y-4">
              {sources.map(([src, v]) => (
                <li key={src}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium">{src === "DEMO" ? "Demonstração" : src}</span>
                    <span className="text-muted tabular-nums">
                      {v.active} ativas / {v.active + v.inactive}
                    </span>
                  </div>
                  <StackedBar
                    slices={[
                      { label: "Ativas", value: v.active, color: "var(--color-primary)" },
                      { label: "Inativas", value: v.inactive, color: "var(--color-border)" },
                    ]}
                  />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Atualidade dos dados" subtitle="Idade da observação mais recente por veículo">
          {d ? (
            <div className="space-y-4">
              <StackedBar slices={fresh} />
              <Legend slices={fresh} />
              <p className="text-xs text-muted">Última estimativa calculada: {formatDateTime(d.latestEstimateAt)}</p>
            </div>
          ) : (
            <Skeleton className="h-24 w-full" />
          )}
        </Section>
      </div>
    </div>
  );
}
