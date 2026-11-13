"use client";

import Link from "next/link";
import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlan } from "./use-plan";

/** Etiqueta do plano ao lado do nome: "Premium" (com a coroa) ou "Gratuita". Leva à tela do plano. */
export function PlanTag({ className, link = true }: { className?: string; link?: boolean }) {
  const { premium, loaded } = usePlan();
  if (!loaded) return null;
  const style = cn(
    "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-extrabold uppercase tracking-wide",
    premium ? "bg-night text-white" : "border border-border bg-white text-muted",
    className,
  );
  const body = (
    <>
      {premium && <Crown className="h-3 w-3 text-[#ffc861]" aria-hidden />}
      <span className="sr-only">Conta: </span>
      {premium ? "Premium" : "Gratuita"}
    </>
  );
  if (!link) return <span className={style}>{body}</span>;
  return (
    <Link href="/premium" className={style} aria-label={premium ? "Conta Premium. Abrir o plano." : "Conta gratuita. Conhecer o Premium."}>
      {body}
    </Link>
  );
}
