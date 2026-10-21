import { Card, DemoBadge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function Section({ title, subtitle, action, children, className }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

export function PageIntro({ children, demo }: { children?: React.ReactNode; demo?: boolean }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-muted">
      {demo && <DemoBadge label="Demonstration mode — not official data" />}
      {children}
    </div>
  );
}

export function Metric({ label, value, hint, loading }: { label: string; value: React.ReactNode; hint?: string; loading?: boolean }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className={cn("mt-1 text-3xl font-bold tabular-nums", loading && "opacity-30")}>{loading ? "—" : value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

/** Tabela responsiva: rolagem horizontal contida no card. */
export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">{children}</div>
    </Card>
  );
}

export const th = "whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted";
export const td = "px-4 py-3 text-sm";

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "medium" });
}
