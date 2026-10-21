"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BellOff, Clock, TrendingUp, WifiOff } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Badge, Card, DemoBadge, EmptyState, ErrorState, Skeleton } from "@/components/ui/primitives";
import type { AlertType, GomobAlert } from "../derive";

const ICONS: Record<AlertType, React.ReactNode> = {
  API_FAILURE: <WifiOff className="h-4 w-4" aria-hidden />,
  STALE_DATA: <Clock className="h-4 w-4" aria-hidden />,
  HIGH_INTERVALS: <AlertTriangle className="h-4 w-4" aria-hidden />,
  DELAY_INFERRED: <Clock className="h-4 w-4" aria-hidden />,
  RISK_CHANGE: <TrendingUp className="h-4 w-4" aria-hidden />,
  INFO: <AlertTriangle className="h-4 w-4" aria-hidden />,
};

function timeLabel(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

/** Lista apresentacional de alertas (sem fetch). */
export function AlertsListView({ alerts, compact = false, limit }: { alerts: GomobAlert[]; compact?: boolean; limit?: number }) {
  const items = limit ? alerts.slice(0, limit) : alerts;
  if (items.length === 0) {
    return <EmptyState icon={<BellOff className="h-8 w-8" aria-hidden />} title="No alerts right now" description="Alerts appear here when data is outdated, a source fails, or estimated risk changes." />;
  }
  return (
    <ul className="space-y-2" aria-label="Alerts">
      {items.map((a) => (
        <li key={a.id}>
          <Card className={compact ? "p-3" : "p-4"}>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-primary">{ICONS[a.type] ?? ICONS.INFO}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{a.title}</p>
                  {a.isDemo && <DemoBadge />}
                </div>
                {!compact && <p className="mt-1 text-sm text-muted">{a.description}</p>}
                <p className="mt-1 flex items-center gap-2 text-xs text-muted">
                  <Badge>Estimated, not official</Badge>
                  <span>{timeLabel(a.createdAt)}</span>
                </p>
              </div>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

/** Alertas contextuais; busca /api/alerts (opcionalmente por linha) com polling leve. */
export function AlertsList({ lineId, compact, limit, pollMs = 60_000 }: { lineId?: string; compact?: boolean; limit?: number; pollMs?: number }) {
  const q = useQuery({
    queryKey: ["alerts", lineId ?? "all"],
    queryFn: () => apiFetch<{ alerts: GomobAlert[] }>(`/api/alerts${lineId ? `?lineId=${encodeURIComponent(lineId)}` : ""}`),
    refetchInterval: pollMs,
  });
  if (q.isPending) return <Skeleton className="h-16 w-full" />;
  if (q.isError) return <ErrorState message="Alerts could not be loaded." onRetry={() => q.refetch()} />;
  return <AlertsListView alerts={q.data.alerts} compact={compact} limit={limit} />;
}
