"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import qrcode from "qrcode-generator";
import { BusFront, ChevronRight, Copy, Link2, LogOut, MapPin, Share2, Trash2, UserPlus, Users, X } from "lucide-react";
import { BottomSheet, Button, ConfirmDialog, ErrorState, Skeleton } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { initials } from "@/components/layout/hooks";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useA11y } from "@/features/a11y/a11y";
import { FAMILY_KEY, ago, useFamily, type FamilyView as Family, type Share } from "./use-family";

const FamilyMap = dynamic(() => import("./family-map").then((m) => m.FamilyMap), { ssr: false });
const LIVE_SHEET = 190;

function Avatar({ name, tone = "orange" }: { name: string; tone?: "orange" | "dark" }) {
  return (
    <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white", tone === "orange" ? "bg-gradient-to-br from-primary to-primary-pressed" : "bg-night")} aria-hidden>
      {initials(name)}
    </span>
  );
}

/** QR code do link (para os amigos apontarem a câmera). */
function QrCode({ value }: { value: string }) {
  const { path, size } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { path: d, size: n };
  }, [value]);
  return (
    <svg viewBox={`-2 -2 ${size + 4} ${size + 4}`} className="h-48 w-48 rounded-2xl bg-white" role="img" aria-label="QR code do link de convite" shapeRendering="crispEdges">
      <path d={path} fill="#12151b" />
    </svg>
  );
}

/** Link do convite: QR code, copiar e compartilhar. Em localhost, usa o endereço do computador na rede. */
function InviteSheet({ code, memberName, lanOrigins, onClose }: { code: string | null; memberName?: string; lanOrigins: string[]; onClose: () => void }) {
  const toast = useToast();
  const { announce } = useA11y();
  const [origins, setOrigins] = useState<string[]>([]);
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    if (!code) return;
    const here = window.location.origin;
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
    // no computador (localhost), o celular precisa do endereço da rede local
    const list = local ? [...lanOrigins, here] : [here];
    queueMicrotask(() => {
      setOrigins(list);
      setOrigin(list[0]);
    });
  }, [code, lanOrigins]);

  if (!code) return null;
  const url = origin ? `${origin}/convite/${code}` : "";
  const insecureLan = origin.startsWith("http://") && !/localhost|127\.0\.0\.1/.test(origin);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado.");
      announce("Link de convite copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o link e copie manualmente.");
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: "Convite para a família no GoMob", text: "Entre na minha família no GoMob para acompanhar meus trajetos.", url });
    } catch {
      // a pessoa fechou a folha de compartilhamento
    }
  };

  return (
    <BottomSheet open onClose={onClose} title={memberName ? `Link de acesso de ${memberName}` : "Convite para a família"} description={memberName ? "Abre o GoMob já como essa pessoa, em qualquer aparelho." : "A pessoa abre o link, digita o nome e entra. Sem senha."}>
      <div className="flex flex-col items-center gap-4">
        {url && <QrCode value={url} />}
        <p className="text-center text-sm text-muted">Aponte a câmera do celular para o QR code ou envie o link.</p>
        <p className="w-full select-all break-all rounded-2xl bg-canvas px-4 py-3 text-center font-mono text-sm text-ink">{url}</p>
        {origins.length > 1 && (
          <fieldset className="w-full">
            <legend className="mb-1 text-xs font-semibold text-muted">Endereço usado no link</legend>
            <div className="space-y-1.5" role="radiogroup" aria-label="Endereço usado no link">
              {origins.map((o) => (
                <button key={o} type="button" role="radio" aria-checked={o === origin} onClick={() => setOrigin(o)} className={cn("flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-left text-xs", o === origin ? "border-primary bg-primary-light" : "border-border")}>
                  <span className="break-all font-mono">{o}</span>
                  <span className="shrink-0 font-semibold text-muted">{/localhost|127\.0\.0\.1/.test(o) ? "só neste computador" : "rede local (Wi-Fi)"}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {insecureLan && <p className="w-full rounded-2xl bg-primary-light px-3 py-2 text-xs font-semibold text-primary-pressed">O celular precisa estar no mesmo Wi-Fi deste computador.</p>}
        <div className="grid w-full grid-cols-2 gap-2">
          <Button onClick={copy}>
            <Copy className="h-4 w-4" aria-hidden /> Copiar link
          </Button>
          <Button variant="dark" onClick={share} disabled={typeof navigator === "undefined" || !("share" in navigator)}>
            <Share2 className="h-4 w-4" aria-hidden /> Compartilhar
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}

/** Tela cheia acompanhando o trajeto de alguém da família. */
function LiveDialog({ share, nowMs, mine, onClose }: { share: Share; nowMs: number; mine: boolean; onClose: () => void }) {
  const stale = nowMs - Date.parse(share.updatedAt) > 25_000;
  const first = share.name.split(" ")[0];
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] overflow-hidden bg-canvas" role="dialog" aria-modal="true" aria-labelledby="live-title" data-no-ads>
      <FamilyMap share={share} bottomPad={LIVE_SHEET} />
      <div className="absolute inset-x-0 top-0 z-10 p-3 pt-[max(12px,env(safe-area-inset-top))]">
        <div className={cn("flex items-start gap-3 rounded-3xl p-4 text-white shadow-float", share.arrived ? "bg-risk-low" : "bg-night")}>
          <Avatar name={share.name} />
          <div className="min-w-0 flex-1" aria-live="polite">
            <h2 id="live-title" className="break-words text-lg font-extrabold leading-tight">
              {mine ? "Seu trajeto" : share.arrived ? `${first} chegou` : `${first} está a caminho`}
            </h2>
            <p className="mt-0.5 break-words text-sm text-white/80">{share.arrived ? share.destination : share.title}</p>
          </div>
          <button type="button" onClick={onClose} autoFocus aria-label="Fechar acompanhamento" className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>
      <section aria-label="Resumo do trajeto" className="absolute inset-x-0 bottom-0 z-20 rounded-t-[28px] bg-white px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_40px_rgb(18_21_27/0.18)]">
        <span className="mx-auto block h-1.5 w-10 rounded-full bg-border" aria-hidden />
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-2xl font-extrabold leading-tight text-ink">{share.arrived ? "Chegou" : `${share.minutes} min`}</p>
            <p className="text-sm font-semibold text-muted">{share.arrived ? "Trajeto concluído" : "para chegar · estimativa"}</p>
          </div>
          <p className={cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-bold", stale ? "bg-risk-moderate/15 text-[#92500a]" : "bg-risk-low/10 text-[#0f7a37]")} role="status">
            {stale ? `Sem sinal ${ago(share.updatedAt, nowMs)}` : `Ao vivo · ${ago(share.updatedAt, nowMs)}`}
          </p>
        </div>
        <p className="mt-3 flex items-start gap-2 text-sm text-ink">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 break-words">
            {share.origin} <span className="text-muted">para</span> {share.destination}
          </span>
        </p>
        {share.lines.length > 0 && (
          <p className="mt-2 flex flex-wrap items-center gap-1.5">
            <BusFront className="h-4 w-4 text-muted" aria-hidden />
            <span className="sr-only">Linhas: </span>
            {share.lines.map((l) => (
              <span key={l} className="rounded-lg bg-night px-2 py-0.5 text-xs font-bold text-white">
                {l}
              </span>
            ))}
          </p>
        )}
      </section>
    </div>
  );
}

export function FamilyView() {
  const fam = useFamily(true);
  const qc = useQueryClient();
  const toast = useToast();
  const { announce } = useA11y();
  const [invite, setInvite] = useState<{ code: string; memberName?: string } | null>(null);
  const [watching, setWatching] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: FAMILY_KEY });

  const createInvite = useMutation({
    mutationFn: () => apiFetch<{ invite: { code: string } }>("/api/family/invite", { method: "POST" }),
    onSuccess: (d) => {
      refresh();
      setInvite({ code: d.invite.code });
      announce("Convite criado. Envie o link ou mostre o QR code.");
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const revoke = useMutation({
    mutationFn: (code: string) => apiFetch("/api/family/invite", { method: "DELETE", body: JSON.stringify({ code }) }),
    onSuccess: () => {
      refresh();
      toast.success("Convite cancelado.");
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/family/members/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setRemoving(null);
      refresh();
      toast.success("Pessoa removida da família.");
      announce("Pessoa removida da família.");
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const leave = useMutation({
    mutationFn: () => apiFetch("/api/family/leave", { method: "POST" }),
    // recarrega tudo: o aparelho volta a ser o usuário aberto
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    onSuccess: () => window.location.assign("/home"),
    onError: (e) => toast.error((e as Error).message),
  });

  if (fam.isPending) {
    return (
      <div className="mx-auto max-w-xl space-y-4 pt-2" aria-busy="true">
        <Skeleton className="h-28 w-full rounded-3xl" />
        <Skeleton className="h-48 w-full rounded-3xl" />
      </div>
    );
  }
  if (fam.isError || !fam.data) return <ErrorState message="Não foi possível carregar a família agora." onRetry={() => fam.refetch()} />;

  const f: Family = fam.data;
  const nowMs = fam.dataUpdatedAt;
  const people = 1 + f.members.length;
  const freeSlots = f.max - f.members.length - f.invites.length;
  const live = watching ? f.shares.find((s) => s.userId === watching) : undefined;

  return (
    <div className="mx-auto max-w-xl space-y-5 pb-4 pt-2">
      <header>
        <h1 className="text-[30px] font-extrabold leading-tight tracking-tight">Família</h1>
        <p className="mt-1 text-sm text-muted">Compartilhe seu trajeto ao vivo com até {f.max} pessoas e acompanhe o delas. Sem senha: basta o link de convite.</p>
      </header>

      {/* quem está em trajeto agora */}
      <section aria-labelledby="fam-live">
        <h2 id="fam-live" className="mb-2 flex items-center gap-2 text-lg font-extrabold text-ink">
          Em trajeto agora
          {f.shares.length > 0 && <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-risk-low" aria-hidden />}
        </h2>
        {f.shares.length === 0 ? (
          <p className="rounded-3xl bg-white p-4 text-sm text-muted shadow-soft">Ninguém em trajeto agora. Quando alguém da família tocar em Iniciar trajeto, a viagem aparece aqui em tempo real.</p>
        ) : (
          <ul className="space-y-3">
            {f.shares.map((s) => {
              const mine = s.userId === f.me.id;
              const stale = nowMs - Date.parse(s.updatedAt) > 25_000;
              return (
                <li key={s.userId}>
                  <button type="button" onClick={() => setWatching(s.userId)} className="tap flex w-full items-center gap-3 rounded-3xl bg-night p-4 text-left text-white shadow-float">
                    <Avatar name={s.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-base font-extrabold leading-snug">
                        {mine ? "Você" : s.name} {s.arrived ? "chegou" : "· a caminho"}
                      </span>
                      <span className="block break-words text-sm text-white/75">
                        {s.arrived ? s.destination : `Para ${s.destination} · ${s.minutes} min`}
                      </span>
                      <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold", stale ? "bg-white/15 text-white/80" : "bg-risk-low/25 text-[#8df0b1]")}>
                        {stale ? `Sem sinal ${ago(s.updatedAt, nowMs)}` : `Ao vivo · ${ago(s.updatedAt, nowMs)}`}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-primary">
                      Ver no mapa <ChevronRight className="h-4 w-4" aria-hidden />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* pessoas */}
      <section aria-labelledby="fam-people" className="rounded-3xl bg-white p-4 shadow-soft">
        <h2 id="fam-people" className="flex items-center justify-between gap-2 text-lg font-extrabold text-ink">
          Pessoas
          <span className="text-sm font-semibold text-muted">
            {people} de {f.max + 1}
          </span>
        </h2>
        <ul className="mt-2 divide-y divide-border">
          <li className="flex items-center gap-3 py-3">
            <Avatar name={f.owner.name} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-ink">
                {f.owner.name} {f.me.isOwner && <span className="font-semibold text-muted">(você)</span>}
              </span>
              <span className="block text-xs text-muted">Responsável pela família</span>
            </span>
          </li>
          {f.members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
              <Avatar name={m.name} tone="dark" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-ink">
                  {m.name} {m.userId === f.me.id && <span className="font-semibold text-muted">(você)</span>}
                </span>
                <span className="block text-xs text-muted">Entrou em {new Date(m.joinedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
              </span>
              {f.me.isOwner && (
                <span className="flex shrink-0 gap-1.5">
                  {m.code && (
                    <button type="button" onClick={() => setInvite({ code: m.code!, memberName: m.name })} aria-label={`Link de acesso de ${m.name}`} className="tap flex h-11 w-11 items-center justify-center rounded-full bg-canvas text-ink">
                      <Link2 className="h-5 w-5" aria-hidden />
                    </button>
                  )}
                  <button type="button" onClick={() => setRemoving({ id: m.id, name: m.name })} aria-label={`Remover ${m.name} da família`} className="tap flex h-11 w-11 items-center justify-center rounded-full bg-canvas text-risk-high">
                    <Trash2 className="h-5 w-5" aria-hidden />
                  </button>
                </span>
              )}
            </li>
          ))}
          {f.invites.map((i) => (
            <li key={i.code} className="flex flex-wrap items-center gap-3 py-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-border text-muted" aria-hidden>
                <UserPlus className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-ink">Convite pendente</span>
                <span className="block font-mono text-xs text-muted">Código {i.code}</span>
              </span>
              <span className="flex shrink-0 gap-1.5">
                <button type="button" onClick={() => setInvite({ code: i.code })} className="tap h-11 rounded-full bg-primary-light px-3.5 text-sm font-bold text-primary-pressed">
                  Ver link
                </button>
                <button type="button" onClick={() => revoke.mutate(i.code)} aria-label={`Cancelar convite ${i.code}`} className="tap flex h-11 w-11 items-center justify-center rounded-full bg-canvas text-muted">
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>

        {f.me.isOwner ? (
          freeSlots > 0 ? (
            <Button className="mt-2 w-full" onClick={() => createInvite.mutate()} loading={createInvite.isPending}>
              <UserPlus className="h-4 w-4" aria-hidden /> Convidar pessoa
            </Button>
          ) : (
            <p className="mt-2 rounded-2xl bg-canvas px-3 py-2 text-center text-sm text-muted">{f.members.length >= f.max ? "A família está completa." : "Todas as vagas têm convite pendente."}</p>
          )
        ) : (
          <Button variant="secondary" className="mt-2 w-full" onClick={() => setLeaving(true)}>
            <LogOut className="h-4 w-4" aria-hidden /> Sair da família
          </Button>
        )}
      </section>

      {/* como funciona */}
      <section aria-labelledby="fam-how" className="rounded-3xl bg-white p-4 shadow-soft">
        <h2 id="fam-how" className="flex items-center gap-2 text-lg font-extrabold text-ink">
          <Users className="h-5 w-5 text-primary" aria-hidden /> Como funciona
        </h2>
        <ol className="mt-2 space-y-2 text-sm text-ink">
          {[
            "Toque em Convidar pessoa e envie o link ou mostre o QR code.",
            "A pessoa abre o link no celular, digita o nome e entra. Não tem senha.",
            "Quem tocar em Iniciar trajeto compartilha a viagem; os outros acompanham aqui, ao vivo no mapa.",
          ].map((t, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white" aria-hidden>
                {i + 1}
              </span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      </section>

      <InviteSheet code={invite?.code ?? null} memberName={invite?.memberName} lanOrigins={f.lanOrigins} onClose={() => setInvite(null)} />
      {live && <LiveDialog share={live} nowMs={nowMs} mine={live.userId === f.me.id} onClose={() => setWatching(null)} />}
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing.id)}
        loading={remove.isPending}
        title={`Remover ${removing?.name ?? ""} da família?`}
        description="A pessoa deixa de ver seus trajetos e o link de acesso dela para de funcionar."
        confirmLabel="Remover"
        destructive
      />
      <ConfirmDialog
        open={leaving}
        onClose={() => setLeaving(false)}
        onConfirm={() => leave.mutate()}
        loading={leave.isPending}
        title="Sair da família?"
        description="Você deixa de ver os trajetos da família neste aparelho. Para voltar, peça um novo convite."
        confirmLabel="Sair"
        destructive
      />
    </div>
  );
}
