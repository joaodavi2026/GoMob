"use client";

import Link from "next/link";
import { ChevronRight, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { brl, usePlan } from "./use-plan";

/** Chamada para o Premium (grátis) ou selo de plano ativo (Premium). */
export function PremiumTeaser({ className }: { className?: string }) {
  const { data, premium, loaded } = usePlan();
  if (!loaded || !data) return null;
  return (
    <Link
      href="/premium"
      className={cn(
        "tap flex items-center gap-3 rounded-3xl p-4 shadow-soft",
        premium ? "bg-white text-ink" : "bg-night text-white",
        className,
      )}
    >
      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", premium ? "bg-primary-light" : "bg-white/10")}>
        <Crown className={cn("h-5 w-5", premium ? "text-primary" : "text-[#ffc861]")} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold">{premium ? "Premium ativo" : "GoMob Premium"}</span>
        <span className={cn("block text-xs", premium ? "text-muted" : "text-white/70")}>
          {premium ? "Sem anúncios e com trajeto em segundo plano." : `Sem anúncios e trajeto em segundo plano por ${brl(data.priceCents)}/mês.`}
        </span>
      </span>
      <ChevronRight className={cn("h-5 w-5 shrink-0", premium ? "text-muted" : "text-white/70")} aria-hidden />
    </Link>
  );
}
