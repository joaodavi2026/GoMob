"use client";

import Link from "next/link";
import { Accessibility, Bus, ChevronRight, HandHelping, Landmark, Route } from "lucide-react";
import { useA11y } from "@/features/a11y/a11y";
import { cn } from "@/lib/utils";

const LABELS: [keyof ReturnType<typeof useA11y>["prefs"], string][] = [
  ["voice", "Voz"],
  ["vibration", "Vibração"],
  ["visualAlerts", "Alerta visual"],
  ["contrast", "Contraste"],
  ["accessibleOnly", "Só acessíveis"],
  ["simple", "Modo simples"],
];

/** Entrada sempre visível para a área de Acessibilidade. */
export function AccessibilityBanner() {
  const { prefs, active } = useA11y();
  const on = LABELS.filter(([k]) => prefs[k]).map(([, l]) => l);
  if (prefs.textSize > 0) on.push("Texto maior");
  return (
    <Link
      href="/accessibility"
      className={cn("tap mt-5 flex items-center gap-3 rounded-3xl p-3.5 pr-4 shadow-soft", active ? "bg-night text-white" : "bg-white text-ink")}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white">
        <Accessibility className="h-7 w-7" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-extrabold leading-tight">Acessibilidade</span>
        <span className={cn("mt-0.5 block truncate text-xs", active ? "text-white/70" : "text-muted")}>
          {on.length ? `Ligado: ${on.join(" · ")}` : "PCD, voz para cegos, avisos para surdos e cartão de comunicação"}
        </span>
      </span>
      <ChevronRight className={cn("h-5 w-5 shrink-0", active ? "text-white/70" : "text-muted")} aria-hidden />
    </Link>
  );
}

const ACTIONS = [
  { href: "/routes", label: "Planejar viagem", icon: Route },
  { href: "/map", label: "Próximos ônibus", icon: Bus },
  { href: "/accessibility#terminais", label: "Terminais e pontos", icon: Landmark },
  { href: "/accessibility#ajuda", label: "Pedir ajuda", icon: HandHelping },
];

/** Quatro ações grandes, mostradas quando algum recurso de acessibilidade está ligado. */
export function BigActions() {
  const { active } = useA11y();
  if (!active) return null;
  return (
    <nav aria-label="Ações principais" className="mt-4 grid grid-cols-2 gap-3">
      {ACTIONS.map(({ href, label, icon: Icon }, i) => (
        <Link
          key={href}
          href={href}
          className={cn("tap flex min-h-[112px] flex-col justify-between rounded-3xl p-4 shadow-soft", i === 0 ? "bg-primary text-white" : "bg-white text-ink")}
        >
          <Icon className={cn("h-8 w-8", i === 0 ? "text-white" : "text-primary")} aria-hidden />
          <span className="text-[17px] font-bold leading-tight">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
