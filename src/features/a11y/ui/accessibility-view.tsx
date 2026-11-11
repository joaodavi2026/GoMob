"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useMemo, useState } from "react";
import {
  Accessibility,
  BellRing,
  Brain,
  Bus,
  ChevronRight,
  Contrast,
  Ear,
  ExternalLink,
  Eye,
  HandHelping,
  Landmark,
  ListChecks,
  MapPin,
  MessageSquareText,
  Phone,
  RotateCcw,
  Type,
  Vibrate,
  Volume2,
  Waves,
} from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/lib/utils";
import { SpeakButton, useA11y, type A11yPrefs, type Profile } from "../a11y";

const PROFILES: { id: Profile; title: string; desc: string; icon: typeof Eye; turnsOn: string }[] = [
  { id: "mobility", title: "Cadeira de rodas ou mobilidade reduzida", desc: "Destaca ônibus cadastrados como acessíveis.", icon: Accessibility, turnsOn: "Só veículos acessíveis" },
  { id: "blind", title: "Cego ou baixa visão", desc: "Leitura em voz alta, texto maior e alto contraste.", icon: Eye, turnsOn: "Voz · Texto maior · Contraste" },
  { id: "deaf", title: "Surdo ou deficiência auditiva", desc: "Todo aviso em texto, com vibração e alerta visual.", icon: Ear, turnsOn: "Vibração · Alerta visual" },
  { id: "nonverbal", title: "Não falo ou prefiro texto", desc: "Cartão de comunicação para mostrar ao motorista.", icon: MessageSquareText, turnsOn: "Cartão de comunicação" },
  { id: "simple", title: "Instruções mais simples", desc: "Uma coisa por vez, menos animação, letras maiores.", icon: Brain, turnsOn: "Modo simples · Texto maior" },
];

export function AccessibilityView() {
  const a = useA11y();
  const { prefs, update } = a;

  return (
    <div className="mx-auto max-w-xl pb-4 pt-2">
      <header>
        <p className="flex items-center gap-2 text-sm font-semibold text-primary-pressed">
          <Accessibility className="h-5 w-5" aria-hidden /> Acessibilidade
        </p>
        <h1 className="mt-1 text-[30px] leading-tight tracking-tight">
          <span className="font-light text-muted">Viaje do</span> <span className="font-extrabold">seu jeito</span>
        </h1>
        <p className="mt-2 text-sm text-muted">
          Escolha os recursos que quer usar. Você não precisa informar nenhuma deficiência nem criar conta: tudo fica salvo só neste celular.
        </p>
      </header>

      {/* Perfis */}
      <section aria-labelledby="perfis-h" className="mt-6">
        <h2 id="perfis-h" className="mb-3 text-xl font-bold tracking-tight">
          Como você quer viajar?
        </h2>
        <ul className="space-y-2.5">
          {PROFILES.map((p) => {
            const on = prefs.profiles.includes(p.id);
            const Icon = p.icon;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => a.toggleProfile(p.id)}
                  className={cn(
                    "tap flex w-full items-center gap-3.5 rounded-3xl p-4 text-left shadow-soft transition-colors",
                    on ? "bg-night text-white" : "bg-white text-ink",
                  )}
                >
                  <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", on ? "bg-primary text-white" : "bg-primary-light text-primary")}>
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold leading-snug">{p.title}</span>
                    <span className={cn("mt-0.5 block text-xs", on ? "text-white/70" : "text-muted")}>{on ? `Ligado: ${p.turnsOn}` : p.desc}</span>
                  </span>
                  <span
                    className={cn("flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors", on ? "justify-end bg-primary" : "justify-start bg-border")}
                    aria-hidden
                  >
                    <span className="h-5 w-5 rounded-full bg-white shadow" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Ações rápidas */}
      <section aria-labelledby="acoes-h" className="mt-8">
        <h2 id="acoes-h" className="mb-3 text-xl font-bold tracking-tight">
          Ações rápidas
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <BigAction href="/accessibility/card" icon={MessageSquareText} title="Cartão de comunicação" sub="Mostre uma frase ao motorista" dark />
          <BigAction href="/network" icon={Bus} title="Ônibus no mapa" sub={prefs.accessibleOnly ? "Só veículos acessíveis" : "Todas as linhas"} />
          <BigAction href="#terminais" icon={Landmark} title="Terminais e pontos" sub="Busque por nome" />
          <BigAction href="#ajuda" icon={HandHelping} title="Pedir ajuda" sub="156 · Atende+" />
        </div>
      </section>

      {/* Visão */}
      <Group id="visao" icon={Eye} title="Visão">
        <Toggle
          icon={Volume2}
          title="Leitura em voz alta"
          desc={a.voiceSupported ? "Mostra o botão “Ouvir tela” e lê linhas, rotas e avisos." : "Este navegador não tem voz. Use o leitor do celular (TalkBack ou VoiceOver)."}
          on={prefs.voice}
          onChange={(v) => update({ voice: v })}
          disabled={!a.voiceSupported}
        />
        {prefs.voice && (
          <Row>
            <span className="text-sm font-semibold">Velocidade da voz</span>
            <Segmented
              label="Velocidade da voz"
              value={prefs.rate}
              options={[
                [0.8, "Devagar"],
                [1, "Normal"],
                [1.25, "Rápida"],
              ]}
              onChange={(v) => update({ rate: v })}
            />
            <SpeakButton
              className="mt-1 w-full justify-center"
              label="Testar voz"
              text="Olá! Eu sou a voz do GoMob. Vou ler as linhas, as paradas e os avisos da sua viagem."
            />
          </Row>
        )}
        <Row>
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Type className="h-4 w-4" aria-hidden /> Tamanho do texto
          </span>
          <Segmented
            label="Tamanho do texto"
            value={prefs.textSize}
            options={[
              [0, "A"],
              [1, "A+"],
              [2, "A++"],
            ]}
            onChange={(v) => update({ textSize: v as A11yPrefs["textSize"] })}
            big
          />
        </Row>
        <Toggle icon={Contrast} title="Alto contraste" desc="Texto mais escuro, bordas visíveis e cores com contraste reforçado." on={prefs.contrast} onChange={(v) => update({ contrast: v })} />
      </Group>

      {/* Audição */}
      <Group id="audicao" icon={Ear} title="Audição">
        <Toggle
          icon={Vibrate}
          title="Vibrar nos avisos"
          desc={a.vibrationSupported ? "O celular vibra quando há um aviso importante." : "Este aparelho ou navegador não permite vibração."}
          on={prefs.vibration}
          onChange={(v) => update({ vibration: v })}
          disabled={!a.vibrationSupported}
        />
        <Toggle icon={Waves} title="Alerta visual em tela cheia" desc="A tela pisca com borda laranja e o aviso aparece em letras grandes." on={prefs.visualAlerts} onChange={(v) => update({ visualAlerts: v })} />
        <Row>
          <button
            type="button"
            onClick={() => a.notify("Teste de aviso: seu ônibus está chegando ao ponto.")}
            className="tap flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-night text-sm font-semibold text-white"
          >
            <BellRing className="h-4 w-4" aria-hidden /> Testar aviso
          </button>
          <p className="text-xs text-muted">Todo aviso do GoMob aparece em texto. A vibração e o alerta visual são somados quando estiverem ligados.</p>
        </Row>
      </Group>

      {/* Mobilidade */}
      <Group id="mobilidade" icon={Accessibility} title="Mobilidade">
        <Toggle
          icon={Accessibility}
          title="Mostrar só ônibus acessíveis"
          desc="No mapa ao vivo, aparecem apenas veículos cadastrados como acessíveis pela SPTrans (campo de acessibilidade do Olho Vivo)."
          on={prefs.accessibleOnly}
          onChange={(v) => update({ accessibleOnly: v })}
        />
        <p className="px-1 text-xs text-muted">
          “Veículo cadastrado como acessível” é a classificação do ônibus na SPTrans. Ela não garante que a rampa ou o elevador estejam funcionando agora.
        </p>
      </Group>

      {/* Compreensão */}
      <Group id="compreensao" icon={Brain} title="Compreensão">
        <Toggle icon={ListChecks} title="Modo simples" desc="Esconde blocos decorativos e mostra só as ações principais, com letras maiores." on={prefs.simple} onChange={(v) => update({ simple: v })} />
        <Toggle icon={Waves} title="Reduzir animações" desc="Desliga movimentos e transições na tela." on={prefs.reduceMotion} onChange={(v) => update({ reduceMotion: v })} />
      </Group>

      <Terminals />
      <Help />

      {a.active && (
        <button
          type="button"
          onClick={a.reset}
          className="tap mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-semibold text-ink shadow-soft"
        >
          <RotateCcw className="h-4 w-4" aria-hidden /> Voltar às configurações padrão
        </button>
      )}
      <p className="mt-4 text-center text-[11px] text-muted">
        Referência de projeto: WCAG 2.2 nível AA. Funciona junto com TalkBack (Android) e VoiceOver (iPhone).
      </p>
    </div>
  );
}

function BigAction({ href, icon: Icon, title, sub, dark }: { href: string; icon: typeof Eye; title: string; sub: string; dark?: boolean }) {
  return (
    <Link href={href} className={cn("tap flex min-h-[132px] flex-col rounded-3xl p-4 shadow-soft", dark ? "bg-night text-white" : "bg-white text-ink")}>
      <span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", dark ? "bg-primary text-white" : "bg-primary-light text-primary")}>
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <span className="mt-auto pt-3 text-[15px] font-bold leading-tight">{title}</span>
      <span className={cn("mt-0.5 text-xs", dark ? "text-white/70" : "text-muted")}>{sub}</span>
    </Link>
  );
}

function Group({ id, icon: Icon, title, children }: { id: string; icon: typeof Eye; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`${id}-h`} id={id} className="mt-8 scroll-mt-4">
      <h2 id={`${id}-h`} className="mb-3 flex items-center gap-2 text-xl font-bold tracking-tight">
        <Icon className="h-5 w-5 text-primary" aria-hidden /> {title}
      </h2>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2.5 rounded-3xl bg-white p-4 shadow-soft">{children}</div>;
}

function Toggle({
  icon: Icon,
  title,
  desc,
  on,
  onChange,
  disabled,
}: {
  icon: typeof Eye;
  title: string;
  desc: string;
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="tap flex w-full items-center gap-3 rounded-3xl bg-white p-4 text-left shadow-soft disabled:opacity-50"
    >
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", on ? "bg-primary text-white" : "bg-canvas text-ink")}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs text-muted">{desc}</span>
      </span>
      <span className={cn("flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors", on ? "justify-end bg-primary" : "justify-start bg-border")} aria-hidden>
        <span className="h-5 w-5 rounded-full bg-white shadow" />
      </span>
    </button>
  );
}

function Segmented<T extends number>({
  label,
  value,
  options,
  onChange,
  big,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  big?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-1 rounded-2xl bg-canvas p-1">
      {options.map(([v, l], i) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "tap h-11 rounded-xl font-bold transition-colors",
            value === v ? "bg-night text-white" : "text-ink",
            big ? ["text-sm", "text-base", "text-lg"][i] : "text-sm",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

// ---- Terminais --------------------------------------------------------------------------------
type Terminal = { name: string; lat: number; lon: number; stopId: string; platforms: number; lineCount: number; lines: string[] };

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function Terminals() {
  const q = useQuery({
    queryKey: ["gtfs", "terminals"],
    staleTime: Infinity,
    queryFn: async () => {
      const r = await fetch("/gtfs/terminals.json");
      if (!r.ok) throw new Error("terminals");
      return (await r.json()) as { terminals: Terminal[] };
    },
  });
  const [query, setQuery] = useState("");
  const dq = useDeferredValue(query);
  const [open, setOpen] = useState<string | null>(null);
  const list = useMemo(() => {
    const n = norm(dq.trim());
    return (q.data?.terminals ?? []).filter((t) => !n || norm(t.name).includes(n));
  }, [q.data, dq]);

  return (
    <section aria-labelledby="terminais-h" id="terminais" className="mt-8 scroll-mt-4">
      <h2 id="terminais-h" className="mb-1 flex items-center gap-2 text-xl font-bold tracking-tight">
        <Landmark className="h-5 w-5 text-primary" aria-hidden /> Terminais e pontos
      </h2>
      <p className="mb-3 text-xs text-muted">
        {q.data ? `${q.data.terminals.length} terminais de ônibus da SPTrans` : "Carregando terminais…"}, com as linhas que param em cada um.
      </p>
      <SearchInput value={query} onValueChange={setQuery} aria-label="Buscar terminal" placeholder="Buscar terminal (ex.: Lapa, Pinheiros)" className="h-12 rounded-2xl border-0 shadow-soft" />
      <ul className="mt-3 space-y-2">
        {list.slice(0, 30).map((t) => {
          const isOpen = open === t.name;
          return (
            <li key={t.name} className="overflow-hidden rounded-3xl bg-white shadow-soft">
              <button type="button" onClick={() => setOpen(isOpen ? null : t.name)} aria-expanded={isOpen} className="flex w-full items-center gap-3 p-4 text-left">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-primary">
                  <Landmark className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{t.name}</span>
                  <span className="block text-xs text-muted">
                    {t.lineCount} linhas · {t.platforms} pontos de embarque
                  </span>
                </span>
                <ChevronRight className={cn("h-5 w-5 shrink-0 text-muted transition-transform", isOpen && "rotate-90")} aria-hidden />
              </button>
              {isOpen && (
                <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
                  <div className="rounded-2xl bg-canvas p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted">Recursos de acessibilidade</p>
                    <ul className="mt-2 space-y-1.5 text-sm">
                      {["Entrada sem degraus", "Banheiro acessível", "Piso tátil até a plataforma", "Painel visual de partidas", "Posto de atendimento"].map((r) => (
                        <li key={r} className="flex items-center justify-between gap-2">
                          <span>{r}</span>
                          <span className="shrink-0 rounded-full bg-risk-unknown/15 px-2 py-0.5 text-[11px] font-semibold text-muted">Sem verificação</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-[11px] text-muted">
                      Ainda não temos verificação em campo deste terminal. Confirme com a SPTrans antes de sair.
                    </p>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-muted">Algumas linhas que param aqui</p>
                    <div className="flex flex-wrap gap-1.5">
                      {t.lines.slice(0, 12).map((c) => (
                        <Link key={c} href={`/network?line=${encodeURIComponent(c)}`} className="rounded-lg bg-night px-2 py-1 text-xs font-bold text-white">
                          {c}
                        </Link>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/network?stop=${encodeURIComponent(t.stopId)}`} className="tap inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-white">
                      <MapPin className="h-4 w-4" aria-hidden /> Ver no mapa
                    </Link>
                    <SpeakButton
                      text={`${t.name}. ${t.lineCount} linhas de ônibus e ${t.platforms} pontos de embarque. Os recursos de acessibilidade deste terminal ainda não foram verificados.`}
                    />
                  </div>
                </div>
              )}
            </li>
          );
        })}
        {q.data && list.length === 0 && <li className="rounded-3xl bg-white p-5 text-center text-sm text-muted shadow-soft">Nenhum terminal com esse nome.</li>}
      </ul>
      <a
        href="https://www.sptrans.com.br/terminais"
        target="_blank"
        rel="noreferrer"
        className="mt-3 flex items-center justify-center gap-1.5 text-sm font-semibold text-primary-pressed"
      >
        Lista oficial de terminais da SPTrans <ExternalLink className="h-4 w-4" aria-hidden />
      </a>
    </section>
  );
}

// ---- Ajuda ------------------------------------------------------------------------------------
function Help() {
  return (
    <section aria-labelledby="ajuda-h" id="ajuda" className="mt-8 scroll-mt-4">
      <h2 id="ajuda-h" className="mb-3 flex items-center gap-2 text-xl font-bold tracking-tight">
        <HandHelping className="h-5 w-5 text-primary" aria-hidden /> Pedir ajuda
      </h2>
      <div className="space-y-2.5">
        <a href="tel:156" className="tap flex items-center gap-3 rounded-3xl bg-night p-4 text-white shadow-soft">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary">
            <Phone className="h-5 w-5" aria-hidden />
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-bold">Ligar 156</span>
            <span className="block text-xs text-white/70">Central de atendimento da Prefeitura de São Paulo</span>
          </span>
        </a>
        <Link href="/accessibility/card" className="tap flex items-center gap-3 rounded-3xl bg-white p-4 shadow-soft">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-primary">
            <MessageSquareText className="h-5 w-5" aria-hidden />
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-bold">Mostrar uma mensagem</span>
            <span className="block text-xs text-muted">Cartão de comunicação em tela cheia</span>
          </span>
          <ChevronRight className="h-5 w-5 text-muted" aria-hidden />
        </Link>
        <a
          href="https://www.sptrans.com.br/atende/sobre-o-atende"
          target="_blank"
          rel="noreferrer"
          className="tap flex items-center gap-3 rounded-3xl bg-white p-4 shadow-soft"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-primary">
            <Accessibility className="h-5 w-5" aria-hidden />
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-bold">Atende+ (porta a porta)</span>
            <span className="block text-xs text-muted">Serviço municipal de transporte porta a porta da SPTrans. Regras e cadastro pelo 156.</span>
          </span>
          <ExternalLink className="h-4 w-4 text-muted" aria-hidden />
        </a>
        <a href="tel:192" className="tap flex items-center gap-3 rounded-3xl bg-white p-4 shadow-soft">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-risk-high/10 text-risk-high">
            <Phone className="h-5 w-5" aria-hidden />
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-bold">Emergência médica: 192</span>
            <span className="block text-xs text-muted">SAMU</span>
          </span>
        </a>
      </div>
    </section>
  );
}


