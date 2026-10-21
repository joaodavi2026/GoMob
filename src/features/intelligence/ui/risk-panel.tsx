import { RiskBadge } from "@/components/ui/risk-badge";
import { DemoBadge } from "@/components/ui/primitives";
import type { RiskResult } from "@/types/transit";

const FACTORS: { key: keyof RiskResult["factors"]; label: string }[] = [
  { key: "demand", label: "Historical demand" },
  { key: "headway", label: "Headway irregularity" },
  { key: "delay", label: "Operational delay" },
  { key: "operations", label: "Operational irregularity" },
];

function Bar({ value }: { value: number }) {
  const tone = value >= 70 ? "bg-risk-high" : value >= 35 ? "bg-risk-moderate" : "bg-risk-low";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border" aria-hidden>
      <div className={`h-full ${tone}`} style={{ width: `${value}%` }} />
    </div>
  );
}

/** Classificação + "Why this risk?" com apenas os fatores efetivamente calculados. */
export function RiskPanel({ risk, compact = false }: { risk: RiskResult; compact?: boolean }) {
  const calculated = FACTORS.filter((f) => risk.factors[f.key] !== null);
  const missing = FACTORS.filter((f) => risk.factors[f.key] === null);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <RiskBadge level={risk.level} />
        {risk.source === "DEMO" && <DemoBadge />}
        {risk.score !== null && <span className="text-xs text-muted">Index {risk.score}/100 (not an occupancy percentage)</span>}
        {risk.confidence !== null && <span className="text-xs text-muted">Data confidence {Math.round(risk.confidence * 100)}%</span>}
      </div>
      <details className="group rounded-xl border border-border bg-canvas px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium text-primary-pressed">Why this risk?</summary>
        <p className="mt-2 text-muted">{risk.explanation}</p>
        {!compact && calculated.length > 0 && (
          <ul className="mt-3 space-y-2">
            {calculated.map((f) => (
              <li key={f.key}>
                <div className="flex justify-between text-xs">
                  <span>{f.label}</span>
                  <span className="font-medium">{risk.factors[f.key]}/100</span>
                </div>
                <Bar value={risk.factors[f.key] as number} />
              </li>
            ))}
          </ul>
        )}
        {!compact && missing.length > 0 && (
          <p className="mt-2 text-xs text-muted">Not available: {missing.map((m) => m.label.toLowerCase()).join(", ")}.</p>
        )}
        <p className="mt-2 text-xs text-muted">Calculated {new Date(risk.calculatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}.</p>
      </details>
    </div>
  );
}
