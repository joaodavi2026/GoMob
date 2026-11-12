import type { RiskLevel } from "@/types/transit";
import { Badge } from "./primitives";

const map = {
  LOW: { tone: "low", label: "Risco baixo" },
  MODERATE: { tone: "moderate", label: "Risco moderado" },
  HIGH: { tone: "high", label: "Risco alto" },
  INSUFFICIENT_DATA: { tone: "unknown", label: "Dados insuficientes" },
} as const;

export function RiskBadge({ level }: { level: RiskLevel }) {
  const m = map[level];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
