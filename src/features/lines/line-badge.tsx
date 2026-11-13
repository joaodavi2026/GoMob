import { BusFront } from "lucide-react";
import { cn } from "@/lib/utils";
import { railInfo, readableOn } from "@/features/network/rail";

/**
 * Selo da linha. Ônibus: código com a faixa na cor da área de operação. Metrô e trem: número na cor da linha.
 */
export function LineBadge({ code, color, type, className, size = "md" }: { code: string; color: string; type?: number; className?: string; size?: "sm" | "md" }) {
  const rail = railInfo(code);
  const small = size === "sm";
  if (rail || (type !== undefined && type !== 3)) {
    return (
      <span
        className={cn("inline-flex shrink-0 items-center justify-center rounded-lg font-extrabold", small ? "h-7 min-w-7 px-1 text-sm" : "h-9 min-w-9 px-1.5 text-lg", className)}
        style={{ background: color, color: readableOn(color) }}
      >
        {rail?.number ?? code}
      </span>
    );
  }
  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-white font-extrabold text-ink", small ? "h-7 px-1.5 text-xs" : "h-9 px-2 text-sm", className)}
      style={{ borderBottom: `3px solid ${color}` }}
    >
      <BusFront className={small ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
      {code}
    </span>
  );
}
