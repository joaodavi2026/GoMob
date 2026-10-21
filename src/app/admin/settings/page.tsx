"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Badge, ErrorState, Skeleton } from "@/components/ui/primitives";
import { FACTOR_DEFINITIONS, type Weights } from "@/features/admin/weights";
import { PageIntro, Section } from "@/components/admin/ui";

type Settings = { weights: Weights; defaults: Weights; mode: "LIVE" | "DEMO"; editable: boolean; disclaimer: string };

export default function AdminSettingsPage() {
  const q = useQuery({ queryKey: ["admin", "settings"], queryFn: () => apiFetch<Settings>("/api/admin/settings") });

  return (
    <div className="space-y-4">
      <PageIntro demo={q.data?.mode === "DEMO"} />
      {q.isError ? (
        <ErrorState message="Could not load settings." onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <>
          <Section title="Operating mode">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge tone={q.data.mode === "LIVE" ? "low" : "primary"}>{q.data.mode === "LIVE" ? "LIVE MODE" : "DEMO MODE"}</Badge>
              <span className="text-muted">
                {q.data.mode === "LIVE"
                  ? "A SPTrans token is configured on the server. Weights are locked."
                  : "No SPTrans token configured: deterministic demonstration data is used and weights can be adjusted."}
              </span>
            </div>
            <p className="mt-3 text-sm text-muted">The mode is derived from server configuration and cannot be changed from this screen.</p>
          </Section>

          <Section title="Intelligence weights" subtitle="Current values" action={<Link href="/admin/intelligence" className="text-sm font-medium text-primary-pressed hover:underline">Edit in Intelligence</Link>}>
            <ul className="grid gap-2 sm:grid-cols-2">
              {FACTOR_DEFINITIONS.map((f) => (
                <li key={f.key} className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2 text-sm">
                  <span>{f.label}</span>
                  <span className="font-semibold tabular-nums">{q.data.weights[f.key].toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">{q.data.disclaimer}</p>
          </Section>

          <Section title="Demo data">
            <p className="text-sm text-muted">
              Scenarios and reset are available in the <Link href="/admin/demo" className="font-medium text-primary-pressed hover:underline">Demo Control Center</Link>. Demo actions never modify records received from SPTrans.
            </p>
          </Section>
        </>
      )}
    </div>
  );
}
