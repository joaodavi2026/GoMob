"use client";

import { useId, useState } from "react";
import { CheckCircle2, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useA11y } from "@/features/a11y/a11y";
import { cn } from "@/lib/utils";

const REASONS = [
  "O ponto não existe ou está em outro lugar",
  "O ônibus não passou",
  "Informação errada no trajeto",
  "Problema de acessibilidade (rampa, elevador, calçada)",
  "Outro motivo",
];

const KEY = "gomob.reports.v1";

/**
 * Reportar problema por texto (sem precisar falar): escolher o motivo e, se quiser, escrever.
 * Na demonstração o relato fica salvo neste aparelho; o texto deixa isso claro.
 */
export function ReportProblem({ context }: { context: string }) {
  const { announce } = useA11y();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) {
      const msg = "Escolha um motivo na lista para enviar o relato.";
      setError(msg);
      announce(msg);
      return;
    }
    try {
      const list = JSON.parse(localStorage.getItem(KEY) ?? "[]") as unknown[];
      list.push({ reason, text: text.trim().slice(0, 500), context, at: new Date().toISOString() });
      localStorage.setItem(KEY, JSON.stringify(list.slice(-50)));
    } catch {
      /* sem armazenamento: o relato vale só nesta visita */
    }
    setSent(true);
    setError(null);
    announce("Problema registrado. Obrigado por avisar.");
  }

  if (sent) {
    return (
      <div role="status" className="flex gap-2 rounded-2xl bg-risk-low/10 p-3 text-sm text-ink">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-risk-low" aria-hidden />
        <p>
          <strong>Problema registrado. Obrigado por avisar.</strong> Nesta demonstração o relato fica salvo neste aparelho.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Button variant="secondary" className="w-full" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={`${id}-form`}>
        <Flag className="h-4 w-4" aria-hidden /> Reportar problema
      </Button>
      {open && (
        <form id={`${id}-form`} onSubmit={submit} noValidate className="mt-3 space-y-3 rounded-2xl border border-border p-3">
          <fieldset aria-describedby={error ? `${id}-err` : undefined}>
            <legend className="mb-2 text-sm font-bold text-ink">O que aconteceu?</legend>
            <div className="space-y-1.5">
              {REASONS.map((r) => (
                <label
                  key={r}
                  className={cn(
                    "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm",
                    reason === r ? "border-primary bg-primary-light text-ink" : "border-border bg-white text-ink",
                  )}
                >
                  <input type="radio" name={`${id}-reason`} value={r} checked={reason === r} onChange={() => setReason(r)} className="h-5 w-5 accent-[#ff6b00]" />
                  {r}
                </label>
              ))}
            </div>
          </fieldset>
          {error && (
            <p id={`${id}-err`} className="text-sm font-semibold text-risk-high">
              {error}
            </p>
          )}
          <div>
            <label htmlFor={`${id}-text`} className="mb-1 block text-sm font-bold text-ink">
              Quer contar mais? <span className="font-normal text-muted">(opcional)</span>
            </label>
            <textarea
              id={`${id}-text`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full rounded-xl border border-border bg-white p-3 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Ex.: o ponto fica do outro lado da rua."
            />
          </div>
          <Button type="submit" className="w-full">
            Enviar relato
          </Button>
        </form>
      )}
    </div>
  );
}
