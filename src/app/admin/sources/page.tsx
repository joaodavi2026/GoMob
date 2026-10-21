"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Badge, ErrorState, Skeleton } from "@/components/ui/primitives";
import type { IntegrationState } from "@/types/transit";
import { PageIntro, TableWrap, formatDateTime, td, th } from "@/components/admin/ui";

type Integration = { key: string; label: string; configured: boolean; state: IntegrationState; lastQueryAt: string | null; lastFailureAt: string | null };
type Status = { mode: "LIVE" | "DEMO"; scenario: string | null; integrations: Integration[] };

const STATE: Record<IntegrationState, { text: string; tone: "low" | "moderate" | "high" | "primary" | "unknown" }> = {
  CONNECTED: { text: "Connected", tone: "low" },
  UPDATING: { text: "Updating", tone: "primary" },
  STALE: { text: "Stale", tone: "moderate" },
  UNAVAILABLE: { text: "Unavailable", tone: "high" },
  DEMO: { text: "Demo", tone: "primary" },
};

const EXPECTED = ["SPTrans API", "Historical Data", "Route Provider", "Map Provider", "Demo Provider"];

export default function AdminSourcesPage() {
  const q = useQuery({ queryKey: ["admin", "system-status"], queryFn: () => apiFetch<Status>("/api/system/status"), refetchInterval: 30_000 });

  return (
    <div className="space-y-4">
      <PageIntro demo={q.data?.mode === "DEMO"}>
        <span>Only configuration state is shown. Secrets and tokens are never displayed.</span>
      </PageIntro>

      {q.isError ? (
        <ErrorState message="Could not load integration status." onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <TableWrap>
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-border bg-canvas">
              <tr>
                <th className={th}>Integration</th>
                <th className={th}>Configured</th>
                <th className={th}>Available</th>
                <th className={th}>Last query</th>
                <th className={th}>Last failure</th>
                <th className={th}>State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(q.data?.integrations.length ? q.data.integrations : EXPECTED.map((label) => ({ key: label, label, configured: false, state: "UNAVAILABLE" as const, lastQueryAt: null, lastFailureAt: null }))).map((i) => {
                const s = STATE[i.state] ?? STATE.UNAVAILABLE;
                return (
                  <tr key={i.key}>
                    <td className={`${td} font-semibold`}>{i.label}</td>
                    <td className={td}>
                      <Badge tone={i.configured ? "low" : "neutral"}>{i.configured ? "Yes" : "No"}</Badge>
                    </td>
                    <td className={td}>{i.state === "UNAVAILABLE" ? "No" : "Yes"}</td>
                    <td className={td}>{formatDateTime(i.lastQueryAt)}</td>
                    <td className={td}>{formatDateTime(i.lastFailureAt)}</td>
                    <td className={td}>
                      <Badge tone={s.tone}>{s.text}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      )}
    </div>
  );
}
