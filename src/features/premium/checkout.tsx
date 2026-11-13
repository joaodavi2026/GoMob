"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, CreditCard, Loader2, Lock } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useA11y } from "@/features/a11y/a11y";
import { detectBrand, digits, formatExp, formatNumber, maskCard, validateCard, type CardErrors, type CardForm } from "./card";
import { IdentityCheck } from "./identity-check";
import { PLAN_KEY, brl, type PlanView, type SavedCardView } from "./use-plan";

type Step = "pay" | "processing" | "done";
const EMPTY: CardForm = { number: "", exp: "", cvv: "", holder: "" };

/** Cartão desenhado (só para a pessoa conferir o que digitou). */
export function CardFace({ brand, number, holder, exp }: { brand: string; number: string; holder: string; exp: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-night via-night-3 to-[#3a2a1c] p-5 text-white shadow-float" aria-hidden>
      <span className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary/30 blur-2xl" />
      <div className="relative flex items-center justify-between">
        <span className="h-8 w-11 rounded-md bg-gradient-to-br from-[#f3d27a] to-[#b98a2b]" />
        <span className="text-sm font-extrabold tracking-wide">{brand}</span>
      </div>
      <p className="relative mt-6 font-mono text-lg tracking-[0.12em]">{number}</p>
      <div className="relative mt-4 flex items-end justify-between gap-3 text-[11px] uppercase text-white/70">
        <span className="min-w-0">
          Nome
          <span className="block truncate text-sm font-semibold normal-case text-white">{holder || "NOME NO CARTÃO"}</span>
        </span>
        <span className="shrink-0 text-right">
          Validade
          <span className="block text-sm font-semibold text-white">{exp || "MM/AA"}</span>
        </span>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; error?: string }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-muted">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : undefined}
        className={cn("h-12 w-full rounded-2xl border bg-white px-4 text-base text-ink outline-none focus:border-primary", error ? "border-risk-high" : "border-border")}
        {...props}
      />
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1 text-xs font-semibold text-risk-high">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Compra SIMULADA do Premium: cartão -> confirmação de identidade (Face ID / PIN) -> "pagamento" -> recibo.
 * Nenhuma cobrança é feita; o número completo e o CVV ficam só nesta tela.
 */
export function Checkout({ open, onClose, plan, userName }: { open: boolean; onClose: () => void; plan: PlanView; userName: string }) {
  const qc = useQueryClient();
  const { announce } = useA11y();
  const [step, setStep] = useState<Step>("pay");
  const [useNew, setUseNew] = useState(!plan.card);
  const [form, setForm] = useState<CardForm>(EMPTY);
  const [errors, setErrors] = useState<CardErrors>({});
  const [verifying, setVerifying] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ card: SavedCardView; at: Date; renewsAt?: string } | null>(null);
  const price = brl(plan.priceCents);
  const saved = !useNew ? plan.card : null;

  const set = (k: keyof CardForm, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const close = () => {
    setStep("pay");
    setForm(EMPTY);
    setErrors({});
    setFailure(null);
    setVerifying(false);
    setUseNew(!plan.card);
    onClose();
  };

  const start = () => {
    setFailure(null);
    if (!saved) {
      const e = validateCard(form);
      setErrors(e);
      const firstError = Object.values(e).find(Boolean);
      if (firstError) return announce(`Confira os dados do cartão. ${firstError}`);
    }
    setVerifying(true);
  };

  const pay = async () => {
    setVerifying(false);
    setStep("processing");
    announce("Processando o pagamento.");
    const card = saved ?? maskCard(form);
    try {
      const [res] = await Promise.all([
        apiFetch<PlanView>("/api/premium", { method: "POST", body: JSON.stringify(saved ? { verified: true } : { verified: true, card }) }),
        new Promise((r) => setTimeout(r, 1400)),
      ]);
      qc.setQueryData(PLAN_KEY, res);
      setForm(EMPTY); // o número e o CVV digitados são descartados
      setReceipt({ card, at: new Date(), renewsAt: res.plan.renewsAt });
      setStep("done");
      announce("Pagamento aprovado. Você agora é Premium, sem anúncios.");
    } catch (e) {
      setStep("pay");
      const msg = `Não foi possível concluir a assinatura. ${(e as Error).message}`;
      setFailure(msg);
      announce(msg);
    }
  };

  const brand = detectBrand(form.number);
  const date = (d: Date | string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <>
      <Modal
        open={open}
        onClose={step === "processing" ? () => {} : close}
        title={step === "done" ? "Assinatura confirmada" : "Assinar GoMob Premium"}
        description={step === "pay" ? "Simulação de compra para a apresentação: nenhuma cobrança é feita." : undefined}
        className="sm:max-w-lg"
      >
        {step === "pay" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-canvas p-4">
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">GoMob Premium · mensal</p>
                <p className="text-xs text-muted">Renova todo mês. Cancele quando quiser.</p>
              </div>
              <p className="shrink-0 text-lg font-extrabold text-ink">
                {price}
                <span className="text-xs font-semibold text-muted">/mês</span>
              </p>
            </div>

            {saved ? (
              <div>
                <h3 className="mb-2 text-sm font-bold text-ink">Forma de pagamento</h3>
                <CardFace brand={saved.brand} number={`•••• •••• •••• ${saved.last4}`} holder={saved.holder} exp={saved.exp} />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <CreditCard className="h-4 w-4 text-primary" aria-hidden />
                    {saved.brand} final {saved.last4}
                  </p>
                  <button type="button" onClick={() => setUseNew(true)} className="h-11 text-sm font-semibold text-primary-pressed underline underline-offset-4">
                    Usar outro cartão
                  </button>
                </div>
              </div>
            ) : (
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  start();
                }}
                className="space-y-3"
              >
                <CardFace brand={brand} number={formatNumber(form.number) || "•••• •••• •••• ••••"} holder={form.holder.toUpperCase()} exp={form.exp} />
                <p className="rounded-2xl bg-primary-light px-3 py-2 text-xs font-semibold text-primary-pressed">Use um cartão de teste. Não digite um cartão de verdade: esta compra é uma simulação.</p>
                <Field
                  id="cc-number"
                  label="Número do cartão"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0000 0000 0000 0000"
                  value={formatNumber(form.number)}
                  onChange={(e) => set("number", digits(e.target.value).slice(0, 19))}
                  error={errors.number}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    id="cc-exp"
                    label="Validade (MM/AA)"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="MM/AA"
                    value={form.exp}
                    onChange={(e) => set("exp", formatExp(e.target.value))}
                    error={errors.exp}
                  />
                  <Field
                    id="cc-cvv"
                    label="Código de segurança (CVV)"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="•••"
                    value={form.cvv}
                    onChange={(e) => set("cvv", digits(e.target.value).slice(0, 4))}
                    error={errors.cvv}
                  />
                </div>
                <Field id="cc-holder" label="Nome como está no cartão" autoComplete="off" autoCapitalize="characters" value={form.holder} onChange={(e) => set("holder", e.target.value.slice(0, 40))} error={errors.holder} />
                {plan.card && (
                  <button type="button" onClick={() => setUseNew(false)} className="h-11 text-sm font-semibold text-primary-pressed underline underline-offset-4">
                    Voltar ao cartão cadastrado (final {plan.card.last4})
                  </button>
                )}
                {/* Enter no formulário também envia */}
                <button type="submit" className="sr-only" tabIndex={-1} aria-hidden>
                  Enviar
                </button>
              </form>
            )}

            {failure && (
              <p role="alert" className="rounded-2xl bg-risk-high/10 px-3 py-2 text-sm font-semibold text-risk-high">
                {failure}
              </p>
            )}
            <Button size="lg" className="w-full" onClick={start}>
              <Lock className="h-4 w-4" aria-hidden /> Assinar por {price}/mês
            </Button>
            <p className="text-center text-xs text-muted">Ao continuar, você confirma com o Face ID ou o PIN do aparelho. Só a bandeira e os 4 últimos dígitos do cartão ficam guardados.</p>
          </div>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center gap-4 py-12" role="status">
            <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
            <p className="text-base font-bold text-ink">Processando o pagamento…</p>
            <p className="text-sm text-muted">Não feche esta tela.</p>
          </div>
        )}

        {step === "done" && receipt && (
          <div className="space-y-4">
            <div className="flex flex-col items-center pt-2 text-center">
              <span className="idc-pop flex h-16 w-16 items-center justify-center rounded-full bg-risk-low text-white">
                <Check className="h-8 w-8" strokeWidth={3} aria-hidden />
              </span>
              <p className="mt-3 text-xl font-extrabold text-ink">Você agora é Premium</p>
              <p className="text-sm text-muted">Os anúncios já foram removidos.</p>
            </div>
            <dl className="divide-y divide-border rounded-2xl bg-canvas px-4 text-sm">
              {[
                ["Plano", "GoMob Premium · mensal"],
                ["Valor", price],
                ["Cartão", `${receipt.card.brand} final ${receipt.card.last4}`],
                ["Data", date(receipt.at)],
                ...(receipt.renewsAt ? [["Próxima cobrança", date(receipt.renewsAt)]] : []),
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3 py-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-semibold text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="text-center text-xs text-muted">Recibo de demonstração. Nenhum valor foi cobrado.</p>
            <Button size="lg" className="w-full" onClick={close} data-autofocus>
              Concluir
            </Button>
          </div>
        )}
      </Modal>
      <IdentityCheck open={verifying} reason={`Assinar GoMob Premium · ${price}/mês`} userName={userName} onSuccess={pay} onCancel={() => setVerifying(false)} />
    </>
  );
}
