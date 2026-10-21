"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Badge, EmptyState, ErrorState, Skeleton } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { RiskBadge } from "@/components/ui/risk-badge";
import { useToast } from "@/components/ui/toast";
import { FACTOR_DEFINITIONS, WEIGHT_KEYS, WEIGHT_TOLERANCE, sumWeights, validateWeights, type Weights } from "@/features/admin/weights";
import type { AdminLine } from "@/features/admin/lines";
import type { RiskResult } from "@/types/transit";
import { PageIntro, Section, TableWrap, formatDateTime, td, th } from "@/components/admin/ui";

type Settings = { weights: Weights; defaults: Weights; mode: "LIVE" | "DEMO"; editable: boolean; disclaimer: string };

export default function AdminIntelligencePage() {
  const toast = useToast();
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["admin", "settings"], queryFn: () => apiFetch<Settings>("/api/admin/settings") });
  const [draft, setDraft] = useState<Weights | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- inicializa o rascunho uma única vez a partir dos dados remotos
    if (settings.data && !draft) setDraft(settings.data.weights);
  }, [settings.data, draft]);

  const lines = useQuery({
    queryKey: ["admin", "lines", "monitored"],
    queryFn: () => apiFetch<{ lines: AdminLine[] }>("/api/admin/lines?active=true&pageSize=100"),
  });
  const monitored = (lines.data?.lines ?? []).slice(0, 12);

  const results = useQuery({
    queryKey: ["admin", "risk-results", monitored.map((l) => l.id).join(",")],
    enabled: monitored.length > 0,
    refetchInterval: 30_000,
    queryFn: async () =>
      Promise.all(
        monitored.map(async (l) => {
          try {
            const r = await apiFetch<{ risk: RiskResult }>(`/api/intelligence/risk?lineId=${encodeURIComponent(l.id)}`);
            return { line: l, risk: r.risk, error: null as string | null };
          } catch (e) {
            return { line: l, risk: null, error: e instanceof Error ? e.message : "Unavailable" };
          }
        }),
      ),
  });

  const save = useMutation({
    mutationFn: (weights: Weights) => apiFetch<{ weights: Weights }>("/api/admin/settings", { method: "PUT", body: JSON.stringify({ weights }) }),
    onSuccess: (r) => {
      toast.success("Weights saved and recorded in the audit log.");
      setDraft(r.weights);
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
      qc.invalidateQueries({ queryKey: ["admin", "risk-results"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save weights."),
  });

  const s = settings.data;
  const validation = draft ? validateWeights(draft) : null;
  const sum = draft ? sumWeights(draft) : 0;
  const valid = validation?.ok === true;
  const dirty = !!(s && draft && WEIGHT_KEYS.some((k) => Math.abs(s.weights[k] - draft[k]) > WEIGHT_TOLERANCE));

  return (
    <div className="space-y-4">
      <PageIntro demo={s?.mode === "DEMO"}>
        <span>The risk score is a hypothetical, non-calibrated estimate. It is not occupancy and not a probability.</span>
      </PageIntro>

      <Section
        title="Algorithm weights"
        subtitle="riskScore = wD·demand + wI·headway + wA·delay + wO·operations"
        action={s && <Badge tone={s.editable ? "primary" : "neutral"}>{s.editable ? "Editable (DEMO MODE)" : "Read-only (LIVE MODE)"}</Badge>}
      >
        {settings.isError ? (
          <ErrorState message="Could not load settings." onRetry={() => settings.refetch()} />
        ) : !s || !draft ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {FACTOR_DEFINITIONS.map((f) => (
                <label key={f.key} className="block rounded-xl border border-border p-3">
                  <span className="flex items-center justify-between text-sm font-medium">
                    <span>
                      {f.code} — {f.label}
                    </span>
                    <span className="tabular-nums text-muted">default {s.defaults[f.key].toFixed(2)}</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={Number.isFinite(draft[f.key]) ? draft[f.key] : ""}
                    disabled={!s.editable}
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value === "" ? NaN : Number(e.target.value) })}
                    className="mt-2 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm disabled:bg-canvas"
                  />
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={valid ? "low" : "high"}>Sum = {Number.isFinite(sum) ? sum.toFixed(2) : "invalid"}</Badge>
              {!valid && validation && !validation.ok && <span className="text-sm text-risk-high">{validation.error}</span>}
              <div className="ml-auto flex gap-2">
                <Button variant="secondary" size="sm" disabled={!s.editable} onClick={() => setDraft(s.defaults)}>
                  Restore defaults
                </Button>
                <Button size="sm" disabled={!s.editable || !valid || !dirty} loading={save.isPending} onClick={() => draft && save.mutate(draft)}>
                  Save weights
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted">{s.disclaimer}</p>
          </div>
        )}
      </Section>

      <Section title="Factor definitions">
        <dl className="grid gap-3 sm:grid-cols-2">
          {FACTOR_DEFINITIONS.map((f) => (
            <div key={f.key} className="rounded-xl bg-canvas p-3">
              <dt className="text-sm font-semibold">
                {f.code} — {f.label}
              </dt>
              <dd className="mt-1 text-sm text-muted">{f.description}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted">Missing data is never treated as zero: when essential factors are unavailable the result is &quot;insufficient data&quot;.</p>
      </Section>

      <div>
        <h2 className="mb-2 font-semibold">Calculated results (monitored lines)</h2>
        {lines.isSuccess && monitored.length === 0 ? (
          <EmptyState title="No monitored lines" description="Enable monitoring in Bus Lines to see calculated results." />
        ) : results.isLoading || lines.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <TableWrap>
            <table className="w-full min-w-[760px]">
              <thead className="border-b border-border bg-canvas">
                <tr>
                  <th className={th}>Line</th>
                  <th className={th}>Risk</th>
                  <th className={th}>Score</th>
                  <th className={th}>Data quality (confidence)</th>
                  <th className={th}>Source</th>
                  <th className={th}>Calculated at</th>
                  <th className={th}>Explanation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(results.data ?? []).map(({ line, risk, error }) => (
                  <tr key={line.id}>
                    <td className={`${td} font-semibold`}>{line.displayCode}</td>
                    <td className={td}>{risk ? <RiskBadge level={risk.level} /> : <Badge tone="unknown">Unavailable</Badge>}</td>
                    <td className={`${td} tabular-nums`}>{risk?.score != null ? Math.round(risk.score) : "—"}</td>
                    <td className={`${td} tabular-nums`}>{risk?.confidence != null ? `${Math.round(risk.confidence * 100)}%` : "—"}</td>
                    <td className={td}>{risk ? (risk.source === "OFFICIAL" ? "Official" : risk.source === "DERIVED" ? "Derived" : "Demo") : "—"}</td>
                    <td className={td}>{formatDateTime(risk?.calculatedAt)}</td>
                    <td className={`${td} max-w-sm text-muted`}>{risk ? risk.explanation : error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
        <p className="mt-2 text-xs text-muted">Confidence is a data-quality indicator, not proven statistical accuracy.</p>
      </div>
    </div>
  );
}
