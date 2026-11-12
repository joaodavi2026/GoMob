"use client";

import Link from "next/link";
import { Accessibility, ChevronRight, Power } from "lucide-react";
import { useA11y } from "@/features/a11y/a11y";
import { cn } from "@/lib/utils";
import { BusIcon, HelpIcon, RouteIcon, TerminalIcon } from "@/components/icons/animated-icons";

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
  const { prefs, active, reset } = useA11y();
  // a entrada principal é o botão Acessibilidade no topo; o banner só aparece com algo ligado
  if (!active) return null;
  const on = LABELS.filter(([k]) => prefs[k]).map(([, l]) => l);
  if (prefs.textSize > 0) on.push("Texto maior");
  return (
    <div className="mt-5">
    <Link
      href="/accessibility"
      className={cn("tap flex items-center gap-3 rounded-3xl p-3.5 pr-4 shadow-soft", active ? "bg-night text-white" : "bg-white text-ink")}
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
    {active && (
      <button
        type="button"
        onClick={reset}
        className="tap mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-bold text-ink shadow-soft"
      >
        <Power className="h-4 w-4 text-primary" aria-hidden /> Desligar acessibilidade
      </button>
    )}
    </div>
  );
}

const ACTIONS = [
  { href: "/routes", label: "Planejar viagem", icon: RouteIcon },
  { href: "/map", label: "Próximos ônibus", icon: BusIcon },
  { href: "/accessibility#terminais", label: "Terminais e pontos", icon: TerminalIcon },
  { href: "/accessibility#ajuda", label: "Pedir ajuda", icon: HelpIcon },
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
          className={cn("tap flex min-h-[132px] flex-col justify-between gap-3 rounded-3xl p-4 shadow-soft", i === 0 ? "bg-primary text-white" : "bg-white text-ink")}
        >
          <span
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-2xl",
              i === 0 ? "bg-white/20 text-white ring-1 ring-white/30" : "bg-primary-light text-primary",
            )}
          >
            <Icon className="h-11 w-11" />
          </span>
          <span className="text-[17px] font-bold leading-tight">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
