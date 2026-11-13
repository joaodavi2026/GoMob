"use client";

import { useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, BellRing, Check, CreditCard, Crown, Infinity as InfinityIcon, Megaphone, MoonStar, ShieldCheck, Users, X } from "lucide-react";
import { Button, ConfirmDialog, ErrorState, Skeleton } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { useMe } from "@/components/layout/hooks";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useA11y } from "@/features/a11y/a11y";
import { Checkout } from "./checkout";
import { IdentityCheck } from "./identity-check";
import { PLAN_KEY, brl, usePlan, type PlanView } from "./use-plan";
import { deviceKeyInfo, devicePlatform, forgetDeviceKey, getVerifyMode, providerLabel, setVerifyMode, subscribeDeviceKey, type DevicePlatform, type VerifyMode } from "./webauthn";

/** Os dois planos, lado a lado na tela. `ad`: item que fala dos anúncios (ganha destaque). */
const PLANS: { id: "FREE" | "PREMIUM"; name: string; tagline: string; items: { text: string; ad?: boolean }[] }[] = [
  {
    id: "FREE",
    name: "Plano Gratuito",
    tagline: "Tudo o que é essencial para andar de ônibus, com anúncios.",
    items: [{ text: "Com anúncios", ad: true }, { text: "Rotas, linhas e ônibus ao vivo" }, { text: "Modo em trajeto com voz" }, { text: "Atividade, Família e Gobi" }],
  },
  {
    id: "PREMIUM",
    name: "Plano Premium",
    tagline: "Sem anúncios e com viagens ilimitadas.",
    items: [{ text: "Sem anúncios", ad: true }, { text: "Viagens ilimitadas" }, { text: "Trajeto em segundo plano, com avisos por notificação" }, { text: "Vale para a sua família" }],
  },
];

const BENEFITS = [
  { icon: Megaphone, title: "Sem anúncios", text: "Nada de anúncio em tela cheia nem banners no meio do app." },
  { icon: InfinityIcon, title: "Viagens ilimitadas", text: "Use o modo em trajeto quantas vezes quiser, sem interrupções antes de começar." },
  { icon: MoonStar, title: "Trajeto em segundo plano", text: "A tela não apaga durante a viagem e os avisos chegam como notificação quando você sai do app." },
  { icon: BellRing, title: "Aviso para descer", text: "Notificação do sistema quando o seu ponto é o próximo, mesmo com o app minimizado." },
  { icon: Users, title: "Vale para a família", text: "As pessoas da sua família também ficam sem anúncios." },
];

const COMPARE: [string, boolean, boolean][] = [
  ["Rotas, mapa e ônibus ao vivo", true, true],
  ["Modo em trajeto com voz", true, true],
  ["Atividade e família", true, true],
  ["Sem anúncios", false, true],
  ["Trajeto em segundo plano", false, true],
  ["Notificação para descer", false, true],
];

const date = (d?: string) => (d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "—");

// preferência de verificação guardada no aparelho
const modeListeners = new Set<() => void>();
function useVerifyMode(): [VerifyMode, (m: VerifyMode) => void] {
  const mode = useSyncExternalStore<VerifyMode>(
    (cb) => {
      modeListeners.add(cb);
      return () => modeListeners.delete(cb);
    },
    getVerifyMode,
    () => "sim",
  );
  return [
    mode,
    (m) => {
      setVerifyMode(m);
      modeListeners.forEach((l) => l());
    },
  ];
}

const noop = () => () => {};
/** Tipo de aparelho (só no navegador; no servidor conta como computador). */
const usePlatform = () => useSyncExternalStore<DevicePlatform>(noop, () => devicePlatform().platform, () => "desktop");
/** Chave de confirmação registrada neste aparelho, se houver. */
const useDeviceKey = () => useSyncExternalStore(subscribeDeviceKey, deviceKeyInfo, () => null);

export function PremiumView() {
  const plan = usePlan();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const { announce } = useA11y();
  const [buying, setBuying] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [verifyCancel, setVerifyCancel] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [mode, setMode] = useVerifyMode();
  const platform = usePlatform();
  const deviceKey = useDeviceKey();

  if (plan.isPending) {
    return (
      <div className="mx-auto max-w-xl space-y-4 pt-2" aria-busy="true">
        <Skeleton className="h-56 w-full rounded-[28px]" />
        <Skeleton className="h-40 w-full rounded-3xl" />
      </div>
    );
  }
  if (plan.isError || !plan.data) return <ErrorState message="Não foi possível carregar o plano agora." onRetry={() => plan.refetch()} />;

  const p: PlanView = plan.data;
  const premium = p.plan.status === "PREMIUM";
  const price = brl(p.priceCents);
  const name = me?.name ?? "João Davi";

  const cancelPlan = async () => {
    setVerifyCancel(false);
    setCanceling(true);
    try {
      const res = await apiFetch<PlanView>("/api/premium", { method: "DELETE", body: JSON.stringify({ verified: true }) });
      qc.setQueryData(PLAN_KEY, res);
      toast.success("Plano cancelado. Os anúncios voltam a aparecer.");
      announce("Plano Premium cancelado. Os anúncios voltam a aparecer. Você pode assinar de novo quando quiser.");
    } catch (e) {
      const msg = `Não foi possível cancelar o plano. ${(e as Error).message}`;
      toast.error(msg);
      announce(msg);
    } finally {
      setCanceling(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-5 pb-4 pt-2">
      {/* destaque */}
      <section className="relative overflow-hidden rounded-[28px] bg-night p-6 text-white shadow-float">
        <span className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/35 blur-3xl" aria-hidden />
        <span className="absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-[#ffb14a]/20 blur-3xl" aria-hidden />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold">
            <Crown className="h-4 w-4 text-[#ffc861]" aria-hidden /> GoMob Premium
          </span>
          {premium ? (
            <>
              <h1 className="mt-4 text-[28px] font-extrabold leading-tight tracking-tight">Seu Premium está ativo</h1>
              <p className="mt-2 text-sm text-white/75">{p.canManage ? `Ativo desde ${date(p.plan.since)}. Próxima cobrança em ${date(p.plan.renewsAt)}.` : `Plano da família, gerenciado por ${p.ownerName}.`}</p>
              <p className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-risk-low/20 px-3 py-2 text-sm font-bold">
                <ShieldCheck className="h-5 w-5 text-[#6ee7a0]" aria-hidden /> Sem anúncios neste app
              </p>
              {/* cancelar fica à vista logo no topo (o mesmo botão existe em Pagamento, mais abaixo) */}
              {p.canManage && (
                <button
                  type="button"
                  onClick={() => setConfirmCancel(true)}
                  disabled={canceling}
                  className="tap mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/10 text-sm font-bold text-white disabled:opacity-60"
                >
                  <Ban className="h-4 w-4" aria-hidden /> Cancelar plano
                </button>
              )}
            </>
          ) : (
            <>
              <h1 className="mt-4 text-[28px] font-extrabold leading-tight tracking-tight">Viaje sem anúncios e com o trajeto em segundo plano</h1>
              <p className="mt-2 text-sm text-white/75">{p.canManage ? "Tudo do GoMob, sem interrupções." : `O plano da família é assinado por ${p.ownerName}.`}</p>
              <p className="mt-5 flex items-end gap-1">
                <span className="text-4xl font-extrabold">{price}</span>
                <span className="pb-1 text-sm font-semibold text-white/70">por mês</span>
              </p>
              {p.canManage && (
                <Button size="lg" className="mt-5 w-full" onClick={() => setBuying(true)}>
                  <Crown className="h-5 w-5" aria-hidden /> Assinar Premium
                </Button>
              )}
              <p className="mt-3 text-center text-xs text-white/55">Simulação para a apresentação: nenhuma cobrança é feita.</p>
            </>
          )}
        </div>
      </section>

      {/* os dois planos */}
      <section aria-labelledby="pm-plans">
        <h2 id="pm-plans" className="mb-3 text-lg font-extrabold text-ink">
          Planos
        </h2>
        <ul className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2">
          {PLANS.map((pl) => {
            const current = (pl.id === "PREMIUM") === premium;
            const gold = pl.id === "PREMIUM";
            return (
              <li key={pl.id} className={cn("flex flex-col rounded-3xl p-4 shadow-soft", gold ? "bg-night text-white" : "bg-white text-ink", current && "ring-2 ring-primary")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-1.5 text-base font-extrabold">
                    {gold && <Crown className="h-4 w-4 text-[#ffc861]" aria-hidden />}
                    {pl.name}
                  </h3>
                  {current && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-white">Seu plano</span>}
                </div>
                <p className="mt-1 flex items-end gap-1">
                  <span className="text-2xl font-extrabold">{gold ? price : "R$ 0"}</span>
                  <span className={cn("pb-0.5 text-xs font-semibold", gold ? "text-white/70" : "text-muted")}>{gold ? "por mês" : "para sempre"}</span>
                </p>
                <p className={cn("mt-1 text-sm", gold ? "text-white/75" : "text-muted")}>{pl.tagline}</p>
                <ul className="mt-3 flex-1 space-y-2 text-sm">
                  {pl.items.map((it) => (
                    <li key={it.text} className={cn("flex items-start gap-2", it.ad && "font-extrabold")}>
                      {it.ad && !gold ? (
                        <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                      ) : (
                        <Check className={cn("mt-0.5 h-4 w-4 shrink-0", gold ? "text-[#6ee7a0]" : "text-risk-low")} aria-hidden />
                      )}
                      <span>{it.text}</span>
                    </li>
                  ))}
                </ul>
                {gold && p.canManage && !premium && (
                  <Button className="mt-4 w-full" onClick={() => setBuying(true)}>
                    <Crown className="h-4 w-4" aria-hidden /> Assinar Premium
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* benefícios */}
      <section aria-labelledby="pm-benefits">
        <h2 id="pm-benefits" className="mb-3 text-lg font-extrabold text-ink">
          {premium ? "O que você tem" : "O que você ganha"}
        </h2>
        <ul className="space-y-3">
          {BENEFITS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-3 rounded-3xl bg-white p-4 shadow-soft">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-primary">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-ink">{title}</span>
                <span className="block text-sm text-muted">{text}</span>
              </span>
              {premium && <Check className="ml-auto h-5 w-5 shrink-0 text-risk-low" aria-label="Ativo" />}
            </li>
          ))}
        </ul>
      </section>

      {/* comparação */}
      {!premium && (
        <section aria-labelledby="pm-compare" className="rounded-3xl bg-white p-4 shadow-soft">
          <h2 id="pm-compare" className="text-lg font-extrabold text-ink">
            Gratuita ou Premium
          </h2>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th scope="col" className="py-2 text-left font-semibold">
                  Recurso
                </th>
                <th scope="col" className="w-20 py-2 font-semibold">
                  Gratuita
                </th>
                <th scope="col" className="w-20 py-2 font-semibold text-primary-pressed">
                  Premium
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {COMPARE.map(([label, free, prem]) => (
                <tr key={label}>
                  <th scope="row" className="py-3 pr-2 text-left font-medium text-ink">
                    {label}
                  </th>
                  {[free, prem].map((on, i) => (
                    <td key={i} className="py-3 text-center">
                      {on ? <Check className="mx-auto h-5 w-5 text-risk-low" aria-label="Incluído" /> : <X className="mx-auto h-5 w-5 text-risk-unknown" aria-label="Não incluído" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* gerenciar */}
      {p.canManage && (
        <section aria-labelledby="pm-manage" className="space-y-3 rounded-3xl bg-white p-4 shadow-soft">
          <h2 id="pm-manage" className="text-lg font-extrabold text-ink">
            Pagamento
          </h2>
          <p className="flex items-center gap-3 text-sm text-ink">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-canvas">
              <CreditCard className="h-5 w-5 text-muted" aria-hidden />
            </span>
            {p.card ? (
              <span className="min-w-0">
                <span className="block font-bold">
                  {p.card.brand} final {p.card.last4}
                </span>
                <span className="block truncate text-muted">
                  Validade {p.card.exp} · {p.card.holder}
                </span>
              </span>
            ) : (
              <span className="text-muted">Nenhum cartão cadastrado.</span>
            )}
          </p>
          {premium ? (
            <Button variant="secondary" className="w-full border-risk-high/40 text-risk-high" onClick={() => setConfirmCancel(true)} loading={canceling}>
              <Ban className="h-4 w-4" aria-hidden /> Cancelar plano
            </Button>
          ) : (
            <Button className="w-full" onClick={() => setBuying(true)}>
              <Crown className="h-4 w-4" aria-hidden /> Assinar por {price}/mês
            </Button>
          )}

          {p.events.length > 0 && (
            <div>
              <h3 className="mb-1 mt-2 text-sm font-bold text-ink">Histórico</h3>
              <ul className="divide-y divide-border text-sm">
                {p.events.map((e) => (
                  <li key={e.at} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block font-semibold text-ink">{e.type === "SUBSCRIBED" ? "Assinatura" : "Cancelamento"}</span>
                      <span className="block truncate text-xs text-muted">
                        {new Date(e.at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        {e.card ? ` · ${e.card}` : ""}
                      </span>
                    </span>
                    <span className={cn("shrink-0 font-bold", e.type === "SUBSCRIBED" ? "text-ink" : "text-muted")}>{e.amountCents ? brl(e.amountCents) : "—"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <fieldset className="mt-2 border-t border-border pt-3">
            <legend className="sr-only">Como confirmar compras e cancelamentos</legend>
            <p className="text-sm font-bold text-ink">Confirmação de segurança</p>
            <p className="text-xs text-muted">Usada ao assinar e ao cancelar.</p>
            <div className="mt-2 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2" role="radiogroup" aria-label="Como confirmar">
              {(
                (platform === "desktop"
                  ? [
                      ["sim", "PIN de segurança", "Um PIN do GoMob, digitado no teclado"],
                      ["device", "Windows Hello", "PIN, rosto ou digital do Windows"],
                    ]
                  : [
                      ["device", "Biometria do aparelho", "Face ID, digital ou PIN do celular"],
                      ["sim", "Simulada", "Face ID ou PIN de demonstração"],
                    ]) as [VerifyMode, string, string][]
              ).map(([value, label, hint]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={mode === value}
                  onClick={() => setMode(value)}
                  className={cn("tap rounded-2xl border p-3 text-left", mode === value ? "border-primary bg-primary-light" : "border-border bg-white")}
                >
                  <span className="block text-sm font-bold text-ink">{label}</span>
                  <span className="block text-xs text-muted">{hint}</span>
                </button>
              ))}
            </div>
            {platform === "desktop" && mode === "device" && (
              <div className="mt-2 rounded-2xl bg-canvas px-3 py-2 text-xs text-muted">
                <p>
                  Um site não consegue pedir a senha da conta do Windows. Com o Windows Hello configurado (Configurações do Windows, Contas, Opções de entrada, PIN), o Windows pede o mesmo PIN, rosto ou digital da tela de bloqueio. Sem ele, o navegador oferece o Gerenciador de senhas do Google.
                </p>
              </div>
            )}
            {mode === "device" && deviceKey && (
              <div className={cn("mt-2 rounded-2xl px-3 py-2 text-xs", deviceKey.provider === "google" && platform === "desktop" ? "bg-primary-light text-primary-pressed" : "bg-canvas text-muted")} role="status">
                <p>
                  Neste aparelho a confirmação está sendo feita por: <strong>{providerLabel(deviceKey.provider)}</strong>.
                  {deviceKey.provider === "google" && platform === "desktop" && " Para usar o Windows, configure o Windows Hello e refaça a configuração; na janela do navegador, escolha salvar de outra forma e depois Windows Hello."}
                </p>
                <button type="button" onClick={forgetDeviceKey} className="mt-1 h-9 font-bold underline underline-offset-4">
                  Refazer a configuração
                </button>
              </div>
            )}
          </fieldset>
        </section>
      )}

      <Checkout open={buying} onClose={() => setBuying(false)} plan={p} userName={name} />
      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => {
          setConfirmCancel(false);
          setVerifyCancel(true);
        }}
        title="Deseja mesmo cancelar o Premium?"
        description="Os anúncios voltam a aparecer e o trajeto em segundo plano é desligado. Você pode assinar de novo quando quiser."
        confirmLabel="Sim, cancelar"
        cancelLabel="Manter o plano"
        destructive
      />
      <IdentityCheck open={verifyCancel} reason="Cancelar o GoMob Premium" userName={name} onSuccess={cancelPlan} onCancel={() => setVerifyCancel(false)} />
    </div>
  );
}
