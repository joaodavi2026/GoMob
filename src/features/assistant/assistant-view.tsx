"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, LocateFixed, Send } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useA11y } from "@/features/a11y/a11y";
import type { Reply } from "./brain";
import { Gobi } from "./gobi";

type Msg = { id: number; from: "user"; text: string } | { id: number; from: "gobi"; reply: Reply };
type Loc = { lat: number; lon: number };

const STARTERS = ["Como vou do Paraíso para a Sé?", "Quando passa o próximo ônibus perto de mim?", "Horário da linha 875A-10", "Quanto custa a passagem?"];
const LINE_STARTERS = (code: string) => [`Quando passa a linha ${code}?`, `Onde estão os ônibus da ${code}?`, `A linha ${code} está cheia?`, `Horário da linha ${code}`];

/** Texto corrido da resposta, para o leitor de tela e a voz. */
const spoken = (r: Reply) => [r.text, ...(r.items ?? []), r.note ?? ""].filter(Boolean).join(". ");

export function AssistantView() {
  const router = useRouter();
  const params = useSearchParams();
  const line = params.get("line")?.slice(0, 16) || undefined;
  const { prefs, speak, announce } = useA11y();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [loc, setLoc] = useState<Loc | null>(null);
  const [locating, setLocating] = useState(false);
  const expect = useRef<Reply["expect"]>(undefined);
  const lastQuestion = useRef("");
  const locRef = useRef<Loc | null>(null);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ask = useCallback(
    async (question: string, withLoc?: Loc) => {
      const q = question.trim();
      if (!q) return;
      lastQuestion.current = q;
      const at = withLoc ?? locRef.current;
      setMsgs((m) => [...m, { id: nextId.current++, from: "user", text: q }]);
      setText("");
      setBusy(true);
      let reply: Reply;
      try {
        const data = await apiFetch<{ reply: Reply }>("/api/assistant", {
          method: "POST",
          body: JSON.stringify({ message: q, line, expect: expect.current, ...(at ? { lat: at.lat, lon: at.lon } : {}) }),
        });
        reply = data.reply;
      } catch {
        reply = { text: "Não consegui falar com o servidor agora. Confira a conexão e tente de novo." };
      }
      expect.current = reply.expect;
      setMsgs((m) => [...m, { id: nextId.current++, from: "gobi", reply }]);
      setBusy(false);
      announce(`Gobi respondeu: ${spoken(reply)}`);
      if (prefs.voice) speak(spoken(reply));
    },
    [line, announce, prefs.voice, speak],
  );

  // pergunta vinda de outra tela (?q=...)
  const asked = useRef(false);
  useEffect(() => {
    const q = params.get("q");
    if (q && !asked.current) {
      asked.current = true;
      queueMicrotask(() => void ask(q.slice(0, 300)));
    }
  }, [params, ask]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  /** Pede a localização e refaz a última pergunta com ela. */
  const useLocation = () => {
    if (!("geolocation" in navigator)) {
      setMsgs((m) => [...m, { id: nextId.current++, from: "gobi", reply: { text: "Este aparelho não informa a localização. Diga o nome do lugar, por exemplo: do Paraíso para a Sé." } }]);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const at = { lat: p.coords.latitude, lon: p.coords.longitude };
        locRef.current = at;
        setLoc(at);
        setLocating(false);
        void ask(expect.current ? "minha localização" : lastQuestion.current || "Quando passa o próximo ônibus perto de mim?", at);
      },
      () => {
        setLocating(false);
        setMsgs((m) => [...m, { id: nextId.current++, from: "gobi", reply: { text: "Não consegui usar sua localização. Sem problema: diga o nome do lugar, de uma estação ou de um terminal." } }]);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const starters = line ? LINE_STARTERS(line) : STARTERS;
  const lastReply = [...msgs].reverse().find((m) => m.from === "gobi");
  const chips = busy ? [] : msgs.length === 0 ? starters : lastReply?.from === "gobi" ? (lastReply.reply.suggestions ?? []) : [];

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-13rem)] max-w-xl flex-col pt-1">
      <header className="flex items-center gap-3">
        <button type="button" onClick={() => router.back()} aria-label="Voltar" className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-soft">
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-light">
          <Gobi className="h-10 w-10" mood={busy ? "thinking" : "happy"} />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold leading-tight text-ink">Gobi</h1>
          <p className="truncate text-xs text-muted">Seu guia de ônibus · dados ao vivo da SPTrans</p>
        </div>
      </header>

      <div className="mt-4 flex-1 space-y-3" role="log" aria-label="Conversa com o Gobi" aria-live="off">
        {msgs.length === 0 && (
          <div className="rounded-3xl bg-white p-5 text-center shadow-soft">
            <Gobi className="mx-auto h-24 w-24" />
            <p className="mt-2 text-lg font-extrabold text-ink">Oi! Eu sou o Gobi.</p>
            <p className="mt-1 text-sm text-muted">
              {line ? `Pergunte o que quiser sobre a linha ${line}.` : "Pergunte como chegar a um lugar, quando passa o ônibus, o horário de uma linha ou se ela está cheia."}
            </p>
          </div>
        )}

        {msgs.map((m) =>
          m.from === "user" ? (
            <p key={m.id} className="ml-auto w-fit max-w-[85%] break-words rounded-3xl rounded-br-lg bg-primary px-4 py-2.5 text-[15px] font-semibold text-white">
              <span className="sr-only">Você: </span>
              {m.text}
            </p>
          ) : (
            <div key={m.id} className="flex items-end gap-2">
              <Gobi className="h-8 w-8 shrink-0" />
              <div className="min-w-0 max-w-[88%] rounded-3xl rounded-bl-lg bg-white px-4 py-3 shadow-soft">
                <span className="sr-only">Gobi: </span>
                <p className="break-words text-[15px] leading-relaxed text-ink">{m.reply.text}</p>
                {m.reply.items && (
                  <ul className="mt-2 space-y-1.5">
                    {m.reply.items.map((it, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm leading-snug text-ink">
                        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                        <span className="min-w-0 break-words">{it}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {m.reply.note && <p className="mt-2 break-words text-xs text-muted">{m.reply.note}</p>}
                {(m.reply.actions?.length || m.reply.needsLocation) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.reply.actions?.map((a) => (
                      <Link key={a.href} href={a.href} className="tap inline-flex h-11 items-center gap-1 rounded-full bg-night px-4 text-sm font-bold text-white">
                        {a.label} <ChevronRight className="h-4 w-4" aria-hidden />
                      </Link>
                    ))}
                    {m.reply.needsLocation && !loc && (
                      <button type="button" onClick={useLocation} disabled={locating} className="tap inline-flex h-11 items-center gap-1.5 rounded-full bg-primary-light px-4 text-sm font-bold text-primary-pressed disabled:opacity-60">
                        <LocateFixed className="h-4 w-4" aria-hidden /> {locating ? "Localizando…" : "Usar minha localização"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ),
        )}

        {busy && (
          <div className="flex items-end gap-2" role="status">
            <Gobi className="h-8 w-8 shrink-0" mood="thinking" />
            <p className="flex items-center gap-1.5 rounded-3xl rounded-bl-lg bg-white px-4 py-3.5 shadow-soft">
              <span className="sr-only">Gobi está buscando a resposta</span>
              {[0, 1, 2].map((i) => (
                <span key={i} className="gobi-dot h-2 w-2 rounded-full bg-primary" style={{ animationDelay: `${i * 0.15}s` }} aria-hidden />
              ))}
            </p>
          </div>
        )}
        <div ref={endRef} className="h-1" />
      </div>

      {/* sugestões e campo de pergunta: ficam acima da barra de navegação */}
      <div className="sticky bottom-24 z-20 mt-3 lg:bottom-4">
        {chips.length > 0 && (
          <div className="no-scrollbar -mx-5 mb-2 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Sugestões de pergunta">
            {chips.map((c) => (
              <button key={c} type="button" onClick={() => void ask(c)} className="tap h-11 shrink-0 rounded-full border border-border bg-white px-4 text-sm font-semibold text-ink shadow-soft">
                {c}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(text);
            inputRef.current?.focus();
          }}
          className={cn("flex items-center gap-2 rounded-full bg-white p-1.5 pl-5 shadow-float ring-1 ring-border")}
        >
          <label htmlFor="gobi-q" className="sr-only">
            Pergunte ao Gobi
          </label>
          <input
            id="gobi-q"
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 300))}
            placeholder="Pergunte ao Gobi…"
            autoComplete="off"
            enterKeyHint="send"
            className="h-11 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted"
          />
          <button type="submit" disabled={busy || !text.trim()} aria-label="Enviar pergunta" className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:opacity-40">
            <Send className="h-5 w-5" aria-hidden />
          </button>
        </form>
        <p className="mt-1.5 text-center text-[11px] text-muted">O Gobi responde só com dados do GoMob e da SPTrans. Horários programados são aproximados.</p>
      </div>
    </div>
  );
}
