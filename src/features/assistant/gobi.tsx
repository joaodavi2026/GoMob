import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Gobi, o mascote-guia do GoMob: um onibuzinho laranja de olhos atentos (pisca e balança a antena). */
export function Gobi({ className, mood = "happy" }: { className?: string; mood?: "happy" | "thinking" }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("gobi h-12 w-12", className)} role="img" aria-label="Gobi, o guia do GoMob">
      <g className="gobi-antenna">
        <path d="M32 13V6" stroke="#12151b" strokeWidth="3" strokeLinecap="round" />
        <circle cx="32" cy="5" r="3.6" fill="#ffb14a" stroke="#12151b" strokeWidth="1.5" />
      </g>
      <rect x="13" y="51" width="10" height="9" rx="3.5" fill="#12151b" />
      <rect x="41" y="51" width="10" height="9" rx="3.5" fill="#12151b" />
      <rect x="7" y="12" width="50" height="43" rx="15" fill="#ff6b00" />
      <path d="M7 40h50v0a15 15 0 01-15 15H22A15 15 0 017 40z" fill="#e85d00" />
      <rect x="13" y="18" width="38" height="21" rx="10" fill="#ffffff" />
      <g className="gobi-eyes" fill="#12151b">
        <circle cx="25" cy="28" r="3.8" />
        <circle cx="39" cy="28" r="3.8" />
      </g>
      <circle cx="26.3" cy="26.7" r="1.2" fill="#fff" />
      <circle cx="40.3" cy="26.7" r="1.2" fill="#fff" />
      {mood === "thinking" ? (
        <circle cx="32" cy="34.5" r="1.8" fill="#12151b" />
      ) : (
        <path d="M27.5 33c2.3 2.6 6.7 2.6 9 0" stroke="#12151b" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      )}
      <circle cx="16" cy="47" r="3" fill="#ffd34d" />
      <circle cx="48" cy="47" r="3" fill="#ffd34d" />
      <rect x="26" y="45" width="12" height="4" rx="2" fill="#12151b" opacity=".35" />
    </svg>
  );
}

/** Chamada para conversar com o Gobi. `q` já abre a conversa com uma pergunta; `line` dá o contexto da linha. */
export function AskGobi({ className, title = "Pergunte ao Gobi", text = "Trajetos, horários e chegadas com dados ao vivo.", line, compact }: { className?: string; title?: string; text?: string; line?: string; compact?: boolean }) {
  const href = line ? `/assistant?line=${encodeURIComponent(line)}` : "/assistant";
  if (compact) {
    return (
      <Link href={href} className={cn("tap inline-flex h-12 items-center gap-2 rounded-full bg-night pl-1.5 pr-4 text-sm font-bold text-white shadow-soft", className)}>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white">
          <Gobi className="h-7 w-7" />
        </span>
        {title}
      </Link>
    );
  }
  return (
    <Link href={href} className={cn("tap flex items-center gap-3 rounded-3xl bg-white p-3.5 shadow-soft", className)}>
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-light">
        <Gobi className="h-11 w-11" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-extrabold uppercase tracking-wide text-primary-pressed">Novo</span>
        <span className="block text-base font-extrabold leading-tight text-ink">{title}</span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white">
        <ChevronRight className="h-5 w-5" aria-hidden />
      </span>
    </Link>
  );
}
