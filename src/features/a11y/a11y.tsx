"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { BellRing, Square, Volume2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Perfis de viagem: atalhos que ligam conjuntos de recursos. Ninguém precisa declarar deficiência. */
export type Profile = "mobility" | "blind" | "deaf" | "nonverbal" | "simple";

export type A11yPrefs = {
  profiles: Profile[];
  voice: boolean;
  rate: number;
  vibration: boolean;
  visualAlerts: boolean;
  textSize: 0 | 1 | 2;
  contrast: boolean;
  reduceMotion: boolean;
  accessibleOnly: boolean;
  simple: boolean;
};

export const DEFAULT_PREFS: A11yPrefs = {
  profiles: [],
  voice: false,
  rate: 1,
  vibration: false,
  visualAlerts: false,
  textSize: 0,
  contrast: false,
  reduceMotion: false,
  accessibleOnly: false,
  simple: false,
};

/** O que cada perfil liga. Desligar o perfil não desliga recursos que a pessoa ligou à mão. */
export const PRESETS: Record<Profile, Partial<A11yPrefs>> = {
  mobility: { accessibleOnly: true },
  blind: { voice: true, textSize: 1, contrast: true },
  deaf: { vibration: true, visualAlerts: true },
  nonverbal: {},
  simple: { simple: true, textSize: 1, reduceMotion: true },
};

// ---- store persistido no aparelho (localStorage) ---------------------------------------------
const KEY = "gomob.a11y.v1";
let current: A11yPrefs = DEFAULT_PREFS;
let loaded = false;
const listeners = new Set<() => void>();

function load(): A11yPrefs {
  if (loaded) return current;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) current = { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<A11yPrefs>) };
  } catch {
    /* armazenamento indisponível: usa o padrão nesta visita */
  }
  return current;
}
function save(next: A11yPrefs) {
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* sem armazenamento: vale só nesta visita */
  }
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

// ---- contexto -------------------------------------------------------------------------------
type Alert = { id: number; text: string };
type A11yApi = {
  prefs: A11yPrefs;
  update: (patch: Partial<A11yPrefs>) => void;
  toggleProfile: (p: Profile) => void;
  reset: () => void;
  speak: (text: string) => void;
  stop: () => void;
  speaking: boolean;
  /** Aviso importante por todos os canais escolhidos: texto, voz, vibração e flash visual. */
  notify: (text: string) => void;
  voiceSupported: boolean;
  vibrationSupported: boolean;
  active: boolean;
};

const Ctx = createContext<A11yApi | null>(null);

export function useA11y(): A11yApi {
  const c = useContext(Ctx);
  if (!c) throw new Error("useA11y must be used within A11yProvider");
  return c;
}

const noSupport = () => false;

export function A11yProvider({ children }: { children: React.ReactNode }) {
  const prefs = useSyncExternalStore(subscribe, load, () => DEFAULT_PREFS);
  const voiceSupported = useSyncExternalStore(subscribe, () => typeof window !== "undefined" && "speechSynthesis" in window, noSupport);
  const vibrationSupported = useSyncExternalStore(subscribe, () => typeof navigator !== "undefined" && "vibrate" in navigator, noSupport);
  const [speaking, setSpeaking] = useState(false);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [liveMsg, setLiveMsg] = useState("");
  const alertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // aplica classes globais (texto maior, contraste, menos movimento, modo simples)
  useEffect(() => {
    const c = document.documentElement.classList;
    c.toggle("a11y-text-lg", prefs.textSize === 1);
    c.toggle("a11y-text-xl", prefs.textSize === 2);
    c.toggle("a11y-contrast", prefs.contrast);
    c.toggle("a11y-reduce-motion", prefs.reduceMotion);
    c.toggle("a11y-simple", prefs.simple);
  }, [prefs]);

  const update = useCallback((patch: Partial<A11yPrefs>) => save({ ...load(), ...patch }), []);
  const toggleProfile = useCallback((p: Profile) => {
    const cur = load();
    const on = cur.profiles.includes(p);
    const profiles = on ? cur.profiles.filter((x) => x !== p) : [...cur.profiles, p];
    save(on ? { ...cur, profiles } : { ...cur, ...PRESETS[p], profiles });
  }, []);
  const reset = useCallback(() => save(DEFAULT_PREFS), []);

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !text.trim()) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-BR";
    u.rate = load().rate;
    const voice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith("pt-br")) ?? synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith("pt"));
    if (voice) u.voice = voice;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(u);
  }, []);

  const notify = useCallback(
    (text: string) => {
      const p = load();
      setLiveMsg(text);
      if (p.vibration && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate([300, 120, 300, 120, 300]);
      if (p.voice) speak(text);
      if (alertTimer.current) clearTimeout(alertTimer.current);
      setAlert({ id: Date.now(), text });
      alertTimer.current = setTimeout(() => setAlert(null), p.visualAlerts ? 6000 : 4000);
    },
    [speak],
  );

  const active =
    prefs.profiles.length > 0 ||
    prefs.voice ||
    prefs.vibration ||
    prefs.visualAlerts ||
    prefs.textSize > 0 ||
    prefs.contrast ||
    prefs.reduceMotion ||
    prefs.accessibleOnly ||
    prefs.simple;

  const api = useMemo<A11yApi>(
    () => ({ prefs, update, toggleProfile, reset, speak, stop, speaking, notify, voiceSupported, vibrationSupported, active }),
    [prefs, update, toggleProfile, reset, speak, stop, speaking, notify, voiceSupported, vibrationSupported, active],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      {/* região anunciada por leitores de tela (TalkBack / VoiceOver) */}
      <div className="sr-only" role="status" aria-live="assertive">
        {liveMsg}
      </div>
      {alert && <AlertOverlay key={alert.id} text={alert.text} strong={prefs.visualAlerts} onClose={() => setAlert(null)} />}
    </Ctx.Provider>
  );
}

function AlertOverlay({ text, strong, onClose }: { text: string; strong: boolean; onClose: () => void }) {
  return (
    <div className={cn("fixed inset-0 z-[300] flex items-start justify-center p-4 pt-[max(16px,env(safe-area-inset-top))]", !strong && "pointer-events-none")}>
      {strong && <div className="a11y-flash absolute inset-0 border-[10px] border-primary" aria-hidden />}
      <div
        className={cn(
          "pointer-events-auto relative flex w-full max-w-md items-start gap-3 rounded-3xl bg-night p-4 text-white shadow-float",
          strong && "p-5 ring-4 ring-primary",
        )}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary">
          <BellRing className="h-5 w-5" aria-hidden />
        </span>
        <p className={cn("flex-1 font-semibold leading-snug", strong ? "text-xl" : "text-base")}>{text}</p>
        <button type="button" onClick={onClose} aria-label="Fechar aviso" className="rounded-full p-1.5 text-white/70 hover:bg-white/10">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

/** Botão flutuante "Ouvir esta tela", visível quando a leitura em voz alta está ligada. */
export function ReadScreenButton() {
  const { prefs, speak, stop, speaking, voiceSupported } = useA11y();
  const pathname = usePathname();
  // no mapa (Explore) cada linha já tem o próprio botão "Ouvir linha"
  if (!prefs.voice || !voiceSupported || pathname.startsWith("/network")) return null;
  function read() {
    if (speaking) return stop();
    const main = document.getElementById("main");
    const text = (main?.innerText ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .join(". ")
      .slice(0, 2500);
    speak(text || "Nada para ler nesta tela.");
  }
  return (
    <button
      type="button"
      onClick={read}
      aria-label={speaking ? "Parar leitura" : "Ouvir esta tela"}
      className="tap fixed bottom-[calc(96px+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-primary pl-4 pr-5 text-sm font-bold text-white shadow-float lg:bottom-6"
    >
      {speaking ? <Square className="h-5 w-5 fill-white" aria-hidden /> : <Volume2 className="h-5 w-5" aria-hidden />}
      {speaking ? "Parar" : "Ouvir tela"}
    </button>
  );
}

/** Botão "Ouvir" para um trecho específico (linha, rota, parada). */
export function SpeakButton({ text, label = "Ouvir", className }: { text: string; label?: string; className?: string }) {
  const { speak, stop, speaking, voiceSupported } = useA11y();
  if (!voiceSupported) return null;
  return (
    <button
      type="button"
      onClick={() => (speaking ? stop() : speak(text))}
      aria-label={speaking ? "Parar leitura" : `${label} em voz alta`}
      className={cn("tap inline-flex h-10 items-center gap-1.5 rounded-full bg-night px-3.5 text-xs font-semibold text-white", className)}
    >
      {speaking ? <Square className="h-3.5 w-3.5 fill-white" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
      {speaking ? "Parar" : label}
    </button>
  );
}
