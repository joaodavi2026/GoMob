"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Badge, ErrorState, Skeleton } from "@/components/ui/primitives";
import type { Overview, ApiStatusLevel } from "@/features/admin/overview";
import { Donut, Legend, Columns, StackedBar, type Slice } from "@/components/admin/charts";
import { Metric, PageIntro, Section, formatDateTime } from "@/components/admin/ui";

type OverviewData = Overview & { dbAvailable: boolean };

const STATUS_LABEL: Record<ApiStatusLevel, { text: string; tone: "low" | "moderate" | "high" | "primary" }> = {
  OK: { text: "Operational", tone: "low" },
  DEGRADED: { text: "Degraded", tone: "moderate" },
  DOWN: { text: "Unavailable", tone: "high" },
  DEMO: { text: "Demo provider", tone: "primary" },
};

export default function AdminOverviewPage() {
  const q = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => apiFetch<OverviewData>("/api/admin/overview"),
    refetchInterval: 20_000,
  });

  if (q.isError) return <ErrorState message={q.error instanceof Error ? q.error.message : "Could not load the overview."} onRetry={() => q.refetch()} />;
  const d = q.data;

  const risk: Slice[] = d
    ? [
        { label: "Low", value: d.riskDistribution.LOW, color: "var(--color-risk-low)" },
        { label: "Moderate", value: d.riskDistribution.MODERATE, color: "var(--color-risk-moderate)" },
        { label: "High", value: d.riskDistribution.HIGH, color: "var(--color-risk-high)" },
        { label: "Unknown / insufficient data", value: d.riskDistribution.INSUFFICIENT_DATA, color: "var(--color-risk-unknown)" },
      ]
    : [];
  const fresh: Slice[] = d
    ? [
        { label: "Fresh (≤ 2 min)", value: d.dataFreshness.FRESH, color: "var(--color-risk-low)" },
        { label: "Stale (≤ 10 min)", value: d.dataFreshness.STALE, color: "var(--color-risk-moderate)" },
        { label: "Unavailable", value: d.dataFreshness.UNAVAILABLE, color: "var(--color-risk-unknown)" },
      ]
    : [];
  const sources = d ? Object.entries(d.linesBySource) : [];
  const status = d ? STATUS_LABEL[d.metrics.apiStatus] : null;

  return (
    <div>
      <PageIntro demo={d?.isDemo}>
        {d && !d.dbAvailable && <Badge tone="moderate">Database unavailable — values shown as zero</Badge>}
        {d && <span>Updated {formatDateTime(d.generatedAt)}</span>}
      </PageIntro>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Metric label="Monitored Lines" value={d?.metrics.monitoredLines} hint={d ? `of ${d.metrics.totalLines} configured` : undefined} loading={!d} />
        <Metric label="Tracked Vehicles" value={d?.metrics.trackedVehicles} hint="With observations in the last 10 min" loading={!d} />
        <Metric label="Available Estimates" value={d?.metrics.availableEstimates} hint="Valid, non-expired risk estimates" loading={!d} />
        <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
          <p className="text-sm text-muted">API Status</p>
          <div className="mt-2 min-h-9">{status ? <Badge tone={status.tone} className="text-sm">{status.text}</Badge> : <Skeleton className="h-7 w-24" />}</div>
          <p className="mt-2 text-xs text-muted">{d?.mode === "LIVE" ? "LIVE MODE" : "DEMO MODE"}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Section title="Risk Distribution" subtitle="Non-expired estimates by level (hypothetical score, not occupancy)">
          {d ? (
            <div className="flex flex-wrap items-center gap-6">
              <Donut slices={risk} centerLabel="estimates" />
              <div className="min-w-44 flex-1">
                <Legend slices={risk} />
              </div>
            </div>
          ) : (
            <Skeleton className="h-36 w-full" />
          )}
        </Section>

        <Section title="Latest Observations" subtitle="Vehicle observations per 10-minute window (last hour)">
          {d ? <Columns data={d.latestObservations} /> : <Skeleton className="h-36 w-full" />}
        </Section>

        <Section title="Monitored Lines" subtitle="Active vs. inactive monitoring, by source">
          {!d ? (
            <Skeleton className="h-24 w-full" />
          ) : sources.length === 0 ? (
            <p className="text-sm text-muted">No lines configured yet.</p>
          ) : (
            <ul className="space-y-4">
              {sources.map(([src, v]) => (
                <li key={src}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium">{src === "DEMO" ? "Demo" : src}</span>
                    <span className="text-muted tabular-nums">
                      {v.active} active / {v.active + v.inactive}
                    </span>
                  </div>
                  <StackedBar
                    slices={[
                      { label: "Active", value: v.active, color: "var(--color-primary)" },
                      { label: "Inactive", value: v.inactive, color: "var(--color-border)" },
                    ]}
                  />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Data Freshness" subtitle="Age of the latest observation per vehicle">
          {d ? (
            <div className="space-y-4">
              <StackedBar slices={fresh} />
              <Legend slices={fresh} />
              <p className="text-xs text-muted">Last estimate calculated: {formatDateTime(d.latestEstimateAt)}</p>
            </div>
          ) : (
            <Skeleton className="h-24 w-full" />
          )}
        </Section>
      </div>
    </div>
  );
}
