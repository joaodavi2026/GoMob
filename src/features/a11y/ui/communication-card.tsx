"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { ArrowLeft, FlipVertical2, Plus, Trash2, Volume2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useA11y } from "../a11y";

const GROUPS: { title: string; phrases: string[] }[] = [
  {
    title: "No ponto",
    phrases: ["Este ônibus vai para o Terminal Lapa?", "Qual ônibus vai para o meu destino?", "Pode fazer sinal para o ônibus parar para mim?"],
  },
  {
    title: "Ao embarcar",
    phrases: ["Preciso da rampa para embarcar.", "Preciso de ajuda para subir.", "Pode esperar eu me sentar, por favor?"],
  },
  {
    title: "Durante a viagem",
    phrases: ["Pode me avisar quando chegar ao meu ponto?", "Eu sou surdo. Por favor, escreva ou aponte.", "Eu não falo, mas entendo tudo."],
  },
  {
    title: "Ajuda",
    phrases: ["Estou perdido. Pode me ajudar?", "Preciso de ajuda. Ligue 156, por favor.", "Emergência! Ligue 192, por favor."],
  },
];

// frases próprias, salvas neste aparelho
const KEY = "gomob.a11y.phrases.v1";
let mine: string[] = [];
let ready = false;
const subs = new Set<() => void>();
const read = () => {
  if (!ready) {
    ready = true;
    try {
      mine = JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
    } catch {
      mine = [];
    }
  }
  return mine;
};
const write = (next: string[]) => {
  mine = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* sem armazenamento */
  }
  subs.forEach((s) => s());
};
const EMPTY: string[] = [];

export function CommunicationCard() {
  const { speak, stop, speaking, voiceSupported } = useA11y();
  const custom = useSyncExternalStore(
    (s) => {
      subs.add(s);
      return () => subs.delete(s);
    },
    read,
    () => EMPTY,
  );
  const [shown, setShown] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [draft, setDraft] = useState("");

  if (shown) {
    return (
      <div className="fixed inset-0 z-[150] flex flex-col bg-white text-night" role="dialog" aria-modal="true" aria-label="Mensagem em tela cheia">
        <div className="flex items-center justify-between gap-2 p-4 pt-[max(16px,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => {
              stop();
              setShown(null);
              setFlipped(false);
            }}
            className="tap flex h-12 items-center gap-2 rounded-full bg-night px-4 text-sm font-bold text-white"
          >
            <X className="h-5 w-5" aria-hidden /> Fechar
          </button>
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            aria-pressed={flipped}
            className="tap flex h-12 items-center gap-2 rounded-full bg-canvas px-4 text-sm font-bold"
          >
            <FlipVertical2 className="h-5 w-5" aria-hidden /> Virar
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center px-6">
          <p
            className={cn("text-center text-[40px] font-extrabold leading-[1.15] tracking-tight transition-transform sm:text-6xl", flipped && "rotate-180")}
            aria-live="polite"
          >
            {shown}
          </p>
        </div>
        <div className="p-4 pb-[max(20px,env(safe-area-inset-bottom))]">
          {voiceSupported && (
            <button
              type="button"
              onClick={() => (speaking ? stop() : speak(shown))}
              className="tap flex h-16 w-full items-center justify-center gap-2 rounded-3xl bg-primary text-lg font-bold text-white"
            >
              <Volume2 className="h-6 w-6" aria-hidden /> {speaking ? "Parar" : "Falar em voz alta"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl pb-4 pt-2">
      <Link href="/accessibility" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Acessibilidade
      </Link>
      <h1 className="text-[30px] leading-tight tracking-tight">
        <span className="font-light text-muted">Cartão de</span> <span className="font-extrabold">comunicação</span>
      </h1>
      <p className="mt-2 text-sm text-muted">
        Toque numa frase para mostrá-la em letras grandes ao motorista ou a outra pessoa. As frases ficam no aparelho e funcionam sem internet depois que esta tela abre.
      </p>

      <form
        className="mt-5 flex gap-2 rounded-3xl bg-white p-2 shadow-soft"
        onSubmit={(e) => {
          e.preventDefault();
          const t = draft.trim();
          if (!t) return;
          write([t, ...custom.filter((x) => x !== t)].slice(0, 20));
          setDraft("");
        }}
      >
        <label htmlFor="own-msg" className="sr-only">
          Escrever minha própria mensagem
        </label>
        <input
          id="own-msg"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={140}
          placeholder="Escreva sua mensagem…"
          className="min-w-0 flex-1 rounded-2xl bg-canvas px-4 text-[15px] outline-none placeholder:text-muted"
        />
        <button type="submit" aria-label="Salvar mensagem" className="tap flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white disabled:opacity-50" disabled={!draft.trim()}>
          <Plus className="h-5 w-5" aria-hidden />
        </button>
        {draft.trim() && (
          <button type="button" onClick={() => setShown(draft.trim())} className="tap h-12 shrink-0 rounded-2xl bg-night px-4 text-sm font-bold text-white">
            Mostrar
          </button>
        )}
      </form>

      {custom.length > 0 && <PhraseGroup title="Minhas mensagens" phrases={custom} onShow={setShown} onRemove={(p) => write(custom.filter((x) => x !== p))} />}
      {GROUPS.map((g) => (
        <PhraseGroup key={g.title} title={g.title} phrases={g.phrases} onShow={setShown} />
      ))}
    </div>
  );
}

function PhraseGroup({ title, phrases, onShow, onRemove }: { title: string; phrases: string[]; onShow: (p: string) => void; onRemove?: (p: string) => void }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2.5 text-lg font-bold tracking-tight">{title}</h2>
      <ul className="space-y-2">
        {phrases.map((p) => (
          <li key={p} className="flex items-stretch gap-2">
            <button type="button" onClick={() => onShow(p)} className="tap flex-1 rounded-3xl bg-white p-4 text-left text-[17px] font-semibold leading-snug shadow-soft">
              {p}
            </button>
            {onRemove && (
              <button type="button" onClick={() => onRemove(p)} aria-label={`Apagar: ${p}`} className="tap flex w-12 shrink-0 items-center justify-center rounded-3xl bg-white text-muted shadow-soft">
                <Trash2 className="h-5 w-5" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
