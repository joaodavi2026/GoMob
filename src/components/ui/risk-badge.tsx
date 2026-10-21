import type { RiskLevel } from "@/types/transit";
import { Badge } from "./primitives";

const map = {
  LOW: { tone: "low", label: "Low risk" },
  MODERATE: { tone: "moderate", label: "Moderate risk" },
  HIGH: { tone: "high", label: "High risk" },
  INSUFFICIENT_DATA: { tone: "unknown", label: "Insufficient data" },
} as const;

export function RiskBadge({ level }: { level: RiskLevel }) {
  const m = map[level];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
