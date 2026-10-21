import { Clock, WifiOff } from "lucide-react";
import type { IntegrationState, RiskLevel } from "@/types/transit";
import { cn } from "@/lib/utils";

const riskMeta: Record<RiskLevel, { label: string; bar: string; text: string; width: string }> = {
  LOW: { label: "Low", bar: "bg-risk-low", text: "text-risk-low", width: "w-1/3" },
  MODERATE: { label: "Moderate", bar: "bg-risk-moderate", text: "text-risk-moderate", width: "w-2/3" },
  HIGH: { label: "High", bar: "bg-risk-high", text: "text-risk-high", width: "w-full" },
  INSUFFICIENT_DATA: { label: "Insufficient data", bar: "bg-risk-unknown", text: "text-muted", width: "w-0" },
};

/** Crowding-risk meter. Always shows text next to colour (colour is never the only signal). */
export function RiskIndicator({ level, score, compact, className }: { level: RiskLevel; score?: number | null; compact?: boolean; className?: string }) {
  const m = riskMeta[level];
  return (
    <div className={cn("min-w-0", className)} role="img" aria-label={`Crowding risk: ${m.label}${score != null ? `, score ${Math.round(score)} of 100` : ""}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn("text-sm font-semibold", m.text)}>{m.label}</span>
        {score != null && level !== "INSUFFICIENT_DATA" && !compact && <span className="text-xs text-muted">{Math.round(score)}/100</span>}
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
        <div className={cn("h-full rounded-full transition-all", m.bar, m.width)} />
      </div>
    </div>
  );
}

/** Estimated time of arrival / duration. */
export function EtaIndicator({ minutes, label = "min", className }: { minutes: number | null | undefined; label?: string; className?: string }) {
  if (minutes == null) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-sm text-muted", className)}>
        <Clock className="h-4 w-4" aria-hidden /> ETA unavailable
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-baseline gap-1", className)}>
      <span className="text-2xl font-bold tabular-nums text-ink">{Math.round(minutes)}</span>
      <span className="text-sm text-muted">{label}</span>
    </span>
  );
}

const liveMeta: Record<IntegrationState, { label: string; dot: string; text: string }> = {
  CONNECTED: { label: "Live data", dot: "bg-risk-low", text: "text-ink" },
  UPDATING: { label: "Updating", dot: "bg-risk-moderate animate-pulse", text: "text-ink" },
  STALE: { label: "Data outdated", dot: "bg-risk-moderate", text: "text-ink" },
  UNAVAILABLE: { label: "Live data unavailable", dot: "bg-risk-unknown", text: "text-muted" },
  DEMO: { label: "Demo data", dot: "bg-primary", text: "text-ink" },
};

/** Compact connection status pill. */
export function LiveStatus({ state, label, className, hideLabelOnMobile }: { state: IntegrationState; label?: string; className?: string; hideLabelOnMobile?: boolean }) {
  const m = liveMeta[state];
  const text = label ?? m.label;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-2.5 py-1 text-xs font-medium", m.text, className)} role="status">
      {state === "UNAVAILABLE" ? <WifiOff className="h-3.5 w-3.5" aria-hidden /> : <span className={cn("h-2 w-2 rounded-full", m.dot)} aria-hidden />}
      <span className={cn(hideLabelOnMobile && "sr-only sm:not-sr-only")}>{text}</span>
    </span>
  );
}

/** "Last updated 2 minutes ago" helper text. */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "Not updated yet";
  const diff = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (diff < 60) return "Last updated just now";
  const m = Math.round(diff / 60);
  if (m < 60) return `Last updated ${m} ${m === 1 ? "minute" : "minutes"} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `Last updated ${h} ${h === 1 ? "hour" : "hours"} ago`;
  const d = Math.round(h / 24);
  return `Last updated ${d} ${d === 1 ? "day" : "days"} ago`;
}
