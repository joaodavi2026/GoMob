import { Bus, Footprints, ChevronRight, ArrowRightLeft } from "lucide-react";
import type { BusRouteOption } from "@/types/transit";
import { cn } from "@/lib/utils";
import { Badge, Card, DemoBadge } from "./primitives";
import { EtaIndicator, RiskIndicator } from "./indicators";

/** KPI tile. */
export function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "default" | "primary";
  className?: string;
}) {
  return (
    <Card className={cn("p-4", tone === "primary" && "border-primary/20 bg-primary-light", className)}>
      <div className="flex items-center justify-between gap-2 text-sm text-muted">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-ink">{value}</div>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

/** Line code chip (orange). */
export function LineChip({ code, className }: { code: string; className?: string }) {
  return <span className={cn("inline-flex min-w-12 items-center justify-center rounded-lg bg-primary px-2 py-1 text-xs font-bold text-white", className)}>{code}</span>;
}

/** Bus line summary row. Renders as a button when `onClick` is given. */
export function BusCard({
  code,
  name,
  meta,
  isDemo,
  trailing,
  onClick,
}: {
  code: string;
  name: string;
  meta?: string;
  isDemo?: boolean;
  trailing?: React.ReactNode;
  onClick?: () => void;
}) {
  const body = (
    <>
      <LineChip code={code} />
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-semibold text-ink">{name}</span>
        {(meta || isDemo) && (
          <span className="mt-0.5 flex items-center gap-2 text-xs text-muted">
            {meta}
            {isDemo && <Badge tone="primary" className="px-1.5 py-0 text-[10px]">Demo</Badge>}
          </span>
        )}
      </span>
      {trailing ?? (onClick && <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />)}
    </>
  );
  const cls = "flex w-full items-center gap-3 rounded-2xl border border-border bg-white p-3 shadow-soft";
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(cls, "transition-colors hover:border-primary/40 hover:bg-primary-light/40")}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Route option summary with walk/bus steps, duration and risk. */
export function RouteCard({
  route,
  selected,
  badges,
  onSelect,
}: {
  route: BusRouteOption;
  selected?: boolean;
  badges?: React.ReactNode;
  onSelect?: () => void;
}) {
  const Wrapper = onSelect ? "button" : "div";
  return (
    <Wrapper
      {...(onSelect ? { type: "button" as const, onClick: onSelect, "aria-pressed": !!selected } : {})}
      className={cn(
        "block w-full rounded-2xl border bg-white p-4 text-left shadow-soft transition-colors",
        selected ? "border-primary ring-2 ring-primary/20" : "border-border",
        onSelect && "hover:border-primary/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <EtaIndicator minutes={route.durationMinutes} />
        <div className="flex flex-wrap justify-end gap-1.5">
          {badges}
          {route.source === "DEMO" && <DemoBadge label="Demo" />}
        </div>
      </div>
      <ol className="mt-3 flex flex-wrap items-center gap-1.5 text-sm" aria-label="Route steps">
        {route.steps.map((s, i) => (
          <li key={i} className="inline-flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted" aria-hidden />}
            {s.kind === "WALK" ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-canvas px-2 py-1 text-muted">
                <Footprints className="h-3.5 w-3.5" aria-hidden /> {s.minutes} min
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Bus className="h-3.5 w-3.5 text-primary" aria-hidden />
                <LineChip code={s.lineCode} />
              </span>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-3 flex items-center justify-between gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden />
          {route.transfers === 0 ? "Direct" : `${route.transfers} ${route.transfers === 1 ? "transfer" : "transfers"}`} · {route.walkMinutes} min walking
        </span>
        {route.risk && <RiskIndicator level={route.risk.level} score={route.risk.score} compact className="w-28" />}
      </div>
    </Wrapper>
  );
}
