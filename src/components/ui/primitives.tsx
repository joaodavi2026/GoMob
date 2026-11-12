import { AlertTriangle, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-3xl border border-black/[0.04] bg-white shadow-soft", className)} {...props} />;
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-border/70", className)} aria-hidden>
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/70 to-transparent [animation:gomob-shimmer_1.4s_infinite]" />
    </div>
  );
}

type BadgeTone = "neutral" | "primary" | "low" | "moderate" | "high" | "unknown";
const tones: Record<BadgeTone, string> = {
  neutral: "bg-canvas text-muted border-border",
  primary: "bg-primary-light text-primary-pressed border-primary/20",
  low: "bg-risk-low/10 text-risk-low border-risk-low/20",
  moderate: "bg-risk-moderate/10 text-risk-moderate border-risk-moderate/20",
  high: "bg-risk-high/10 text-risk-high border-risk-high/20",
  unknown: "bg-risk-unknown/15 text-muted border-risk-unknown/30",
};

export function Badge({ tone = "neutral", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}
      {...props}
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-3xl bg-white px-6 py-8 text-center shadow-soft">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-primary [&_svg]:h-6 [&_svg]:w-6">{icon ?? <Inbox className="h-6 w-6" aria-hidden />}</span>
      <p className="font-semibold">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action && (
        <Button variant="secondary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function ErrorState({ message = "Algo deu errado.", onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2.5 rounded-3xl bg-white px-6 py-7 text-center shadow-soft">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-risk-moderate/10 text-risk-moderate">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </span>
      <p className="max-w-xs text-sm text-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

export function DemoBadge({ label = "Dados de demonstração acadêmica" }: { label?: string }) {
  return <Badge tone="primary">{label}</Badge>;
}
