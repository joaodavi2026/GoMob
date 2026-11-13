"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Crown, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useA11y } from "@/features/a11y/a11y";
import { usePlan } from "@/features/premium/use-plan";
import { CREATIVES, type Creative } from "./creatives";

/**
 * Anúncios simulados do plano grátis: um anúncio em tela cheia (com "Pular em 5 s") ao abrir o app,
 * de tempos em tempos ao trocar de tela e antes de iniciar um trajeto. Não há banners no meio das telas
 * (o componente AdBanner existe, mas não é usado).
 * No Premium nada disso aparece.
 */
type Ctx = { enabled: boolean; request: (after?: () => void) => void };
const AdsContext = createContext<Ctx>({ enabled: false, request: (after) => after?.() });
export const useAds = () => useContext(AdsContext);

const SKIP_SECONDS = 5;
const MIN_INTERVAL_MS = 90_000;
const NO_AUTO_ADS = ["/premium", "/convite", "/accessibility", "/assistant"];
const LAST_KEY = "gomob.ad.last";
const INDEX_KEY = "gomob.ad.index";

const session = {
  get(key: string): number {
    try {
      return Number(sessionStorage.getItem(key) ?? 0) || 0;
    } catch {
      return 0;
    }
  },
  set(key: string, v: number) {
    try {
      sessionStorage.setItem(key, String(v));
    } catch {
      // sem armazenamento de sessão
    }
  },
};

export function AdsProvider({ children }: { children: React.ReactNode }) {
  const plan = usePlan();
  const pathname = usePathname();
  const enabled = plan.loaded && !plan.premium;
  const enabledRef = useRef(enabled);
  const [ad, setAd] = useState<Creative | null>(null);
  const afterRef = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    enabledRef.current = enabled;
  });

  const show = useCallback((after?: () => void) => {
    // nunca por cima do modo em trajeto (a pessoa está na rua) nem de uma confirmação em andamento
    if (!enabledRef.current || document.querySelector("[data-no-ads]")) return after?.();
    const i = session.get(INDEX_KEY);
    session.set(INDEX_KEY, i + 1);
    session.set(LAST_KEY, Date.now());
    afterRef.current = after;
    setAd(CREATIVES[i % CREATIVES.length]);
  }, []);

  // ao abrir o app e, depois, no máximo a cada 90 s ao trocar de tela
  useEffect(() => {
    if (!enabled || NO_AUTO_ADS.some((p) => pathname.startsWith(p))) return;
    if (Date.now() - session.get(LAST_KEY) < MIN_INTERVAL_MS) return;
    const t = setTimeout(() => show(), 1600);
    return () => clearTimeout(t);
  }, [enabled, pathname, show]);

  const close = useCallback(() => {
    const after = afterRef.current;
    afterRef.current = undefined;
    setAd(null);
    after?.();
  }, []);

  // assinou o Premium com um anúncio aberto: some na hora
  useEffect(() => {
    if (!enabled && ad) queueMicrotask(close);
  }, [enabled, ad, close]);

  const value = useMemo(() => ({ enabled, request: show }), [enabled, show]);
  return (
    <AdsContext.Provider value={value}>
      {children}
      {ad && enabled && <Interstitial creative={ad} onClose={close} />}
    </AdsContext.Provider>
  );
}

function Interstitial({ creative: c, onClose }: { creative: Creative; onClose: () => void }) {
  const [left, setLeft] = useState(SKIP_SECONDS);
  const { announce } = useA11y();
  const toast = useToast();
  const skipRef = useRef<HTMLButtonElement>(null);
  const canSkip = left <= 0;

  useEffect(() => {
    announce(`Anúncio de ${c.brand}. Você poderá pular em ${SKIP_SECONDS} segundos.`);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    return () => {
      clearInterval(t);
      document.body.style.overflow = prev;
    };
  }, [announce, c.brand]);

  useEffect(() => {
    if (!canSkip) return;
    skipRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [canSkip, onClose]);

  const R = 15;
  const LEN = 2 * Math.PI * R;

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex flex-col overflow-hidden text-white"
      style={{ background: `linear-gradient(160deg, ${c.from}, ${c.to})` }}
      role="dialog"
      aria-modal="true"
      aria-label={`Anúncio de ${c.brand}`}
    >
      <span className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/15" aria-hidden />
      <span className="pointer-events-none absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-black/15" aria-hidden />

      <div className="relative flex items-center justify-between gap-3 px-5 pt-[max(16px,env(safe-area-inset-top))]">
        <span className="rounded-full bg-black/30 px-3 py-1.5 text-xs font-bold">Anúncio</span>
        {canSkip ? (
          <button ref={skipRef} type="button" onClick={onClose} className="tap flex h-11 items-center gap-1.5 rounded-full bg-black/40 pl-4 pr-3 text-sm font-bold">
            Pular anúncio <X className="h-5 w-5" aria-hidden />
          </button>
        ) : (
          <span className="flex h-11 items-center gap-2 rounded-full bg-black/30 pl-3.5 pr-1.5 text-sm font-semibold" role="timer" aria-label={`Pular em ${left} segundos`}>
            Pular em
            <span className="relative flex h-8 w-8 items-center justify-center text-sm font-extrabold">
              <svg viewBox="0 0 36 36" className="ad-ring absolute inset-0 h-8 w-8" aria-hidden>
                <circle cx="18" cy="18" r={R} fill="none" stroke="rgb(255 255 255 / 0.25)" strokeWidth="3" />
                <circle cx="18" cy="18" r={R} fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeDasharray={LEN} strokeDashoffset={LEN * (1 - left / SKIP_SECONDS)} />
              </svg>
              {left}
            </span>
          </span>
        )}
      </div>

      <div className="ad-in relative flex min-h-0 flex-1 flex-col px-6 pb-[max(20px,env(safe-area-inset-bottom))] pt-5">
        <p className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white" style={{ color: c.accent }}>
            <c.Mark className="h-6 w-6" />
          </span>
          {c.brand}
          <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold">{c.category}</span>
        </p>

        <div className="relative flex min-h-0 flex-1 items-center justify-center py-2">
          <c.Art className="ad-float h-full max-h-[300px] w-auto max-w-full drop-shadow-2xl" />
          <span className="absolute right-0 top-4 flex h-24 w-24 rotate-12 items-center justify-center rounded-full bg-[#ffd34d] p-2 text-center text-lg font-extrabold leading-tight text-night shadow-float">{c.badge}</span>
        </div>

        <h2 className="text-[30px] font-extrabold leading-[1.1] tracking-tight">{c.headline}</h2>
        <p className="mt-2 text-base text-white/85">{c.text}</p>
        <button
          type="button"
          onClick={() => toast.success(`Anúncio de demonstração: ${c.brand} é uma marca fictícia.`)}
          className="tap mt-5 flex h-14 w-full items-center justify-center rounded-2xl bg-white text-base font-extrabold shadow-float"
          style={{ color: c.accent }}
        >
          {c.cta}
        </button>
        <Link href="/premium" onClick={onClose} className="mt-3 flex h-11 items-center justify-center gap-1.5 text-sm font-semibold text-white/90 underline underline-offset-4">
          <Crown className="h-4 w-4 text-[#ffd34d]" aria-hidden /> Cansou de anúncios? Conheça o Premium
        </Link>
        <p className="text-center text-[11px] text-white/60">Anúncio de demonstração · marca fictícia</p>
      </div>
    </div>,
    document.body,
  );
}

/** Banner no meio de uma tela. `index` escolhe a marca; some no Premium. */
export function AdBanner({ index = 0, className }: { index?: number; className?: string }) {
  const { enabled } = useAds();
  const toast = useToast();
  if (!enabled) return null;
  const c = CREATIVES[index % CREATIVES.length];
  return (
    <aside aria-label={`Anúncio de ${c.brand}`} className={cn("a11y-hide-simple", className)}>
      <div className="relative overflow-hidden rounded-3xl p-4 text-white shadow-soft" style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}>
        <span className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/15" aria-hidden />
        <div className="relative flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="rounded-full bg-black/30 px-2 py-0.5">Anúncio</span>
              <span className="truncate">
                {c.brand} · {c.category}
              </span>
            </p>
            <p className="mt-2 break-words text-base font-extrabold leading-snug">{c.headline}</p>
            <button
              type="button"
              onClick={() => toast.success(`Anúncio de demonstração: ${c.brand} é uma marca fictícia.`)}
              className="tap mt-3 inline-flex h-11 items-center rounded-full bg-white px-4 text-sm font-extrabold"
              style={{ color: c.accent }}
            >
              {c.cta}
            </button>
          </div>
          <c.Art className="h-24 w-24 shrink-0 drop-shadow-xl" />
        </div>
      </div>
      <Link href="/premium" className="mt-1 flex h-9 items-center justify-end gap-1 px-2 text-xs font-semibold text-muted underline underline-offset-4">
        <Crown className="h-3.5 w-3.5 text-primary" aria-hidden /> Remover anúncios com o Premium
      </Link>
    </aside>
  );
}
